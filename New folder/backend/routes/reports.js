import express from 'express'
import rateLimit from 'express-rate-limit'
import Report from '../models/Report.js'
import Post from '../models/Post.js'
import User from '../models/User.js'
import Comment from '../models/Comment.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { notify } from '../lib/notify.js'

const router = express.Router()

const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { message: 'Terlalu banyak permintaan laporan. Coba lagi dalam 15 menit.' },
})

const REASON_LABELS = {
  spam: 'Spam',
  scam: 'Penipuan / Scam',
  inappropriate: 'Konten tidak pantas',
  fake: 'Informasi palsu',
  harassment: 'Pelecehan',
  other: 'Lainnya',
}

async function buildSnapshot(targetType, targetId) {
  if (targetType === 'post') {
    const post = await Post.findById(targetId).populate('seller', 'username')
    if (!post) return null
    return { title: post.title, seller: post.seller?.username, status: post.status }
  }
  if (targetType === 'user') {
    const user = await User.findById(targetId).select('username role')
    if (!user) return null
    return { username: user.username, role: user.role }
  }
  if (targetType === 'comment') {
    const comment = await Comment.findById(targetId).populate('author', 'username')
    if (!comment) return null
    return { content: comment.content?.slice(0, 100), author: comment.author?.username }
  }
  return null
}

// POST /api/reports
router.post('/', reportLimiter, authenticate, async (req, res) => {
  try {
    const { targetType, targetId, reason, description } = req.body

    if (!['post', 'user', 'comment'].includes(targetType)) {
      return res.status(400).json({ message: 'Tipe laporan tidak valid' })
    }
    if (!targetId || !reason) {
      return res.status(400).json({ message: 'Target dan alasan wajib diisi' })
    }
    if (!REASON_LABELS[reason]) {
      return res.status(400).json({ message: 'Alasan tidak valid' })
    }

    if (targetType === 'user' && targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Tidak bisa melaporkan diri sendiri' })
    }

    const snapshot = await buildSnapshot(targetType, targetId)
    if (!snapshot) return res.status(404).json({ message: 'Target tidak ditemukan' })

    if (targetType === 'post') {
      const post = await Post.findById(targetId)
      if (post?.seller.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: 'Tidak bisa melaporkan postingan sendiri' })
      }
    }

    const recent = await Report.findOne({
      reporter: req.user._id,
      targetType,
      targetId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
    if (recent) {
      return res.status(429).json({ message: 'Anda sudah melaporkan ini dalam 24 jam terakhir' })
    }

    const report = await Report.create({
      reporter: req.user._id,
      targetType,
      targetId,
      reason,
      description: description?.trim(),
      targetSnapshot: snapshot,
    })

    await report.populate('reporter', 'username avatar')

    // Notify all admins and moderators
    const moderators = await User.find({ role: { $in: ['admin', 'moderator'] } }, '_id username')
    const label = REASON_LABELS[reason]
    for (const mod of moderators) {
      await notify(req.io, {
        recipient: mod._id,
        actor: req.user._id,
        type: 'new_report',
        title: 'Laporan baru',
        body: `${req.user.username} melaporkan ${targetType} — ${label}`,
        link: '/admin/reports',
        meta: { reportId: report._id, targetType },
      })
    }

    res.status(201).json({ message: 'Laporan berhasil dikirim', report })
  } catch (err) {
    console.error('Create report error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/reports/reasons
router.get('/reasons', (req, res) => {
  res.json(Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label })))
})

// Admin routes
router.get('/admin', authenticate, requireRole('admin', 'moderator'), async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const query = status === 'all' ? {} : { status }

    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('reporter', 'username avatar')
        .populate('reviewedBy', 'username'),
      Report.countDocuments(query),
    ])

    res.json({ reports, total, page: Number(page), hasMore: skip + reports.length < total })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

router.patch('/admin/:id', authenticate, requireRole('admin', 'moderator'), async (req, res) => {
  try {
    const { status, reviewNotes } = req.body
    const valid = ['reviewed', 'dismissed', 'action_taken']
    if (!valid.includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid' })
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, reviewNotes, reviewedBy: req.user._id },
      { new: true }
    ).populate('reporter', 'username')

    if (!report) return res.status(404).json({ message: 'Laporan tidak ditemukan' })

    await notify(req.io, {
      recipient: report.reporter._id,
      actor: req.user._id,
      type: 'report_resolved',
      title: 'Laporan Anda ditinjau',
      body: `Laporan Anda telah ${status === 'dismissed' ? 'ditolak' : 'ditindaklanjuti'} oleh moderator.`,
      link: '/',
    })

    res.json(report)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

export default router
