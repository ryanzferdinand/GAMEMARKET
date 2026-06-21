import express from 'express'
import mongoose from 'mongoose'
import Message from '../models/Message.js'
import { authenticate } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { messagesForClient, messageForClient } from '../lib/chatCrypto.js'
import { storeImage } from '../lib/cloudinaryStorage.js'

const router = express.Router()

// GET /api/chat/history/:userId
router.get('/history/:userId', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: 'ID pengguna tidak valid' })
    }

    const { page = 1, limit = 50 } = req.query
    const pageNum = Number(page)
    const limitNum = Number(limit)
    const skip = (pageNum - 1) * limitNum

    const [messages, total] = await Promise.all([
      Message.find({
        $or: [
          { sender: req.user._id, receiver: req.params.userId },
          { sender: req.params.userId, receiver: req.user._id },
        ],
      })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('sender', 'username avatar'),
      Message.countDocuments({
        $or: [
          { sender: req.user._id, receiver: req.params.userId },
          { sender: req.params.userId, receiver: req.user._id },
        ],
      })
    ])

    await Message.updateMany(
      { sender: req.params.userId, receiver: req.user._id, read: false },
      { read: true }
    )

    res.json({
      messages: messagesForClient(messages),
      total,
      page: pageNum,
      hasMore: skip + messages.length < total
    })
  } catch {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/chat/upload-image
router.post('/upload-image', authenticate, ...upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File tidak ada' })
    const url = await storeImage(req.file, 'chat')
    res.json({ url })
  } catch (err) {
    console.error('Chat image upload error:', err)
    res.status(500).json({ message: 'Gagal upload gambar' })
  }
})

// GET /api/chat/conversations
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }],
    })
      .sort({ createdAt: -1 })
      .populate('sender', 'username avatar isOnline')
      .populate('receiver', 'username avatar isOnline')

    const convMap = new Map()
    messages.forEach((msg) => {
      const partnerId =
        msg.sender._id.toString() === req.user._id.toString()
          ? msg.receiver._id.toString()
          : msg.sender._id.toString()
      if (!convMap.has(partnerId)) {
        const partner =
          msg.sender._id.toString() === req.user._id.toString()
            ? msg.receiver
            : msg.sender
        convMap.set(partnerId, { partner, lastMessage: messageForClient(msg), unreadCount: 0 })
      }
    })

    const unreadCounts = await Message.aggregate([
      { $match: { receiver: req.user._id, read: false } },
      { $group: { _id: '$sender', count: { $sum: 1 } } },
    ])
    unreadCounts.forEach(({ _id, count }) => {
      const conv = convMap.get(_id.toString())
      if (conv) conv.unreadCount = count
    })

    res.json(Array.from(convMap.values()))
  } catch {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

export default router
