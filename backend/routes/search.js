import express from 'express'
import rateLimit from 'express-rate-limit'
import Post from '../models/Post.js'
import User from '../models/User.js'

const router = express.Router()

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: { message: 'Terlalu banyak permintaan pencarian. Coba lagi dalam 15 menit.' },
})

/**
 * GET /api/search/suggestions?q=keyword
 * Returns up to 5 matching posts + 4 matching users for autocomplete.
 */
router.get('/suggestions', searchLimiter, async (req, res) => {
  try {
    const raw = (req.query.q || '').trim()
    if (!raw || raw.length < 2) return res.json({ posts: [], users: [] })

    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped, 'i')

    const [posts, users] = await Promise.all([
      Post.find({
        status: 'approved',
        $or: [
          { title: re },
          { gameCategory: re },
          { description: re },
        ],
      })
        .select('_id title price gameCategory images')
        .limit(5)
        .lean(),

      User.find({ username: re })
        .select('_id username avatar role rating ratingCount totalSales')
        .limit(4)
        .lean(),
    ])

    res.json({ posts, users })
  } catch (err) {
    console.error('Search suggestions error:', err)
    res.status(500).json({ posts: [], users: [] })
  }
})

/**
 * GET /api/search/mention-users?q=keyword
 * Autocomplete users for @mentions (forum, comments, etc.)
 */
router.get('/mention-users', searchLimiter, async (req, res) => {
  try {
    const raw = (req.query.q || '').trim()
    if (!raw) return res.json([])

    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const users = await User.find({ username: new RegExp(`^${escaped}`, 'i') })
      .select('_id username avatar role')
      .limit(8)
      .lean()

    res.json(users)
  } catch {
    res.status(500).json([])
  }
})

/**
 * GET /api/search/users?q=keyword
 * Full user search for the SearchPage users tab.
 */
router.get('/users', searchLimiter, async (req, res) => {
  try {
    const raw = (req.query.q || '').trim()
    if (!raw) return res.json([])

    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped, 'i')

    const users = await User.find({ username: re })
      .select('_id username avatar role rating ratingCount totalSales bio verified')
      .limit(20)
      .lean()

    res.json(users)
  } catch {
    res.status(500).json([])
  }
})

export default router
