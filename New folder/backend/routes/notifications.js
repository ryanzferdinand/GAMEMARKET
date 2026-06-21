import express from 'express'
import Notification from '../models/Notification.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

// GET /api/notifications  — list for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const notifs = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('actor', 'username avatar')
      .lean() // PERF-004
    res.json(notifs)
  } catch { res.status(500).json({ message: 'Server error' }) }
})

// GET /api/notifications/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, read: false })
    res.json({ count })
  } catch { res.status(500).json({ message: 'Server error' }) }
})

// POST /api/notifications/read-all — mark all read
router.post('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true })
    res.json({ ok: true })
  } catch { res.status(500).json({ message: 'Server error' }) }
})

// POST /api/notifications/:id/read
router.post('/:id/read', authenticate, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true }
    )
    res.json({ ok: true })
  } catch { res.status(500).json({ message: 'Server error' }) }
})

export default router
