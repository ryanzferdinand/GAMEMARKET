import express from 'express'
import rateLimit from 'express-rate-limit'
import { ForumThread, ForumReply } from '../models/ForumThread.js'
import User from '../models/User.js'
import { authenticate, optionalAuth } from '../middleware/auth.js'
import { shouldCountView } from '../lib/viewTracker.js'
import { resolveTaggedUsers } from '../lib/mentions.js'
import { notify } from '../lib/notify.js'

const router = express.Router()

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: { message: 'Terlalu banyak permintaan. Coba lagi dalam 15 menit.' },
})

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { message: 'Terlalu banyak permintaan buat thread/balasan. Coba lagi dalam 15 menit.' },
})

async function notifyForumMentions(io, { content, actor, threadId, replyId, isReply }) {
  const tagged = await resolveTaggedUsers(content, User, actor._id)
  const link = `/forum/${threadId}`
  const preview = content.trim().slice(0, 80)

  await Promise.all(
    tagged.map((user) =>
      notify(io, {
        recipient: user._id,
        actor: actor._id,
        type: 'forum_mention',
        title: isReply ? 'Anda ditag di forum' : 'Anda ditag di thread forum',
        body: `${actor.username} menyebut Anda: "${preview}${content.length > 80 ? '…' : ''}"`,
        link,
        meta: { threadId, replyId, taggedUsername: user.username },
      })
    )
  )

  return tagged.map((u) => u._id)
}

// GET /api/forum
router.get('/', generalLimiter, optionalAuth, async (req, res) => {
  try {
    const { category, page = 1, limit = 10 } = req.query
    const query = {}
    if (category) query.category = category

    const pageNum = Number(page)
    const limitNum = Number(limit)
    const skip = (pageNum - 1) * limitNum

    const [threads, total] = await Promise.all([
      ForumThread.find(query)
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('author', 'username avatar role')
        .lean(), // PERF-004
      ForumThread.countDocuments(query),
    ])

    res.json({
      threads,
      total,
      page: pageNum,
      hasMore: skip + threads.length < total,
    })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/forum
router.post('/', createLimiter, authenticate, async (req, res) => {
  try {
    const { title, content, category } = req.body
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ message: 'Judul dan konten wajib diisi' })
    }

    const thread = await ForumThread.create({
      title: title.trim(),
      content: content.trim(),
      category: category || 'discussion',
      author: req.user._id,
      taggedUsers: await resolveTaggedUsers(content, User, req.user._id).then((u) => u.map((x) => x._id)),
    })
    await thread.populate('author', 'username avatar role')

    await notifyForumMentions(req.io, {
      content: content.trim(),
      actor: req.user,
      threadId: thread._id,
      isReply: false,
    })

    res.status(201).json(thread)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/forum/:id
router.get('/:id', generalLimiter, optionalAuth, async (req, res) => {
  try {
    const thread = await ForumThread.findById(req.params.id)
      .populate('author', 'username avatar role')

    if (!thread) return res.status(404).json({ message: 'Thread tidak ditemukan' })

    // Increment views — once per viewer per 4-hour window, never for the thread author
    if (shouldCountView(req, 'forum', req.params.id, thread.author._id)) {
      await ForumThread.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } })
    }

    const { page = 1, limit = 5 } = req.query
    const pageNum = Number(page)
    const limitNum = Number(limit)
    const skip = (pageNum - 1) * limitNum
    const replyQuery = { thread: req.params.id, parentReply: null }

    const [replies, replyTotal] = await Promise.all([
      ForumReply.find(replyQuery)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('author', 'username avatar role'),
      ForumReply.countDocuments(replyQuery),
    ])

    const repliesWithChildren = await Promise.all(
      replies.map(async (reply) => {
        const children = await ForumReply.find({ parentReply: reply._id })
          .sort({ createdAt: 1 })
          .populate('author', 'username avatar role')
        const grandchildren = await Promise.all(
          children.map(async (child) => {
            const gc = await ForumReply.find({ parentReply: child._id })
              .sort({ createdAt: 1 })
              .populate('author', 'username avatar role')
            return { ...child.toObject(), replies: gc }
          })
        )
        return { ...reply.toObject(), replies: grandchildren }
      })
    )

    res.json({
      thread,
      replies: repliesWithChildren,
      replyTotal,
      replyPage: pageNum,
      replyHasMore: skip + replies.length < replyTotal,
    })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/forum/:id/vote
router.post('/:id/vote', authenticate, async (req, res) => {
  try {
    const { type } = req.body
    if (!['up', 'down'].includes(type)) {
      return res.status(400).json({ message: 'Tipe vote tidak valid' })
    }

    const thread = await ForumThread.findById(req.params.id)
    if (!thread) return res.status(404).json({ message: 'Thread tidak ditemukan' })

    const userId = req.user._id.toString()
    const existing = thread.votes.find((v) => v.user.toString() === userId)

    if (existing) {
      if (existing.type === type) {
        thread.votes = thread.votes.filter((v) => v.user.toString() !== userId)
      } else {
        // Use markModified to ensure MongoDB detects the nested change
        existing.type = type
        thread.markModified('votes')
      }
    } else {
      thread.votes.push({ user: req.user._id, type })
    }

    await thread.save()
    res.json({ votes: thread.votes })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/forum/:id/replies
router.post('/:id/replies', authenticate, async (req, res) => {
  try {
    const { content, parentReply } = req.body
    if (!content?.trim()) return res.status(400).json({ message: 'Konten wajib diisi' })

    const thread = await ForumThread.findById(req.params.id)
    if (!thread) return res.status(404).json({ message: 'Thread tidak ditemukan' })
    if (thread.isLocked) return res.status(403).json({ message: 'Thread ini dikunci' })

    const reply = await ForumReply.create({
      thread: req.params.id,
      author: req.user._id,
      content: content.trim(),
      parentReply: parentReply || null,
      taggedUsers: await resolveTaggedUsers(content, User, req.user._id).then((u) => u.map((x) => x._id)),
    })

    await ForumThread.findByIdAndUpdate(req.params.id, { $inc: { replyCount: 1 } })
    await reply.populate('author', 'username avatar role')

    await notifyForumMentions(req.io, {
      content: content.trim(),
      actor: req.user,
      threadId: req.params.id,
      replyId: reply._id,
      isReply: true,
    })

    res.status(201).json(reply)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/forum/:id/replies/:replyId/vote
router.post('/:id/replies/:replyId/vote', authenticate, async (req, res) => {
  try {
    const { type } = req.body
    const reply = await ForumReply.findById(req.params.replyId)
    if (!reply) return res.status(404).json({ message: 'Balasan tidak ditemukan' })

    const userId = req.user._id.toString()
    const existing = reply.votes.find((v) => v.user.toString() === userId)

    if (existing) {
      if (existing.type === type) {
        reply.votes = reply.votes.filter((v) => v.user.toString() !== userId)
      } else {
        // Use markModified to ensure MongoDB detects the nested change
        existing.type = type
        reply.markModified('votes')
      }
    } else {
      reply.votes.push({ user: req.user._id, type })
    }

    await reply.save()
    res.json({ votes: reply.votes })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

export default router
