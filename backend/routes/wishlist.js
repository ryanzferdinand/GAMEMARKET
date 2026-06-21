import express from 'express'
import Wishlist from '../models/Wishlist.js'
import Post from '../models/Post.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

router.use(authenticate)

// GET /api/wishlist
router.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 12
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      Wishlist.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'post',
          populate: { path: 'seller', select: 'username avatar role verified totalSales rating' },
        }),
      Wishlist.countDocuments({ user: req.user._id }),
    ])

    const posts = items.map((i) => i.post).filter(Boolean)

    res.json({
      posts,
      total,
      page,
      pages: Math.ceil(total / limit),
      hasMore: skip + items.length < total,
    })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/wishlist/ids — all saved post IDs for quick checks
router.get('/ids', async (req, res) => {
  try {
    const items = await Wishlist.find({ user: req.user._id }).select('post')
    res.json({ ids: items.map((i) => i.post.toString()) })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/wishlist/check/:postId
router.get('/check/:postId', async (req, res) => {
  try {
    const exists = await Wishlist.exists({
      user: req.user._id,
      post: req.params.postId,
    })
    res.json({ saved: !!exists })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/wishlist/:postId
router.post('/:postId', async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
    if (!post) return res.status(404).json({ message: 'Postingan tidak ditemukan' })
    if (!['approved', 'sold'].includes(post.status)) {
      return res.status(400).json({ message: 'Postingan tidak tersedia' })
    }

    await Wishlist.findOneAndUpdate(
      { user: req.user._id, post: req.params.postId },
      { user: req.user._id, post: req.params.postId },
      { upsert: true, new: true }
    )

    res.json({ saved: true })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// DELETE /api/wishlist/:postId
router.delete('/:postId', async (req, res) => {
  try {
    await Wishlist.deleteOne({ user: req.user._id, post: req.params.postId })
    res.json({ saved: false })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

export default router
