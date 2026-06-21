import express from 'express'
import Review from '../models/Review.js'
import Post from '../models/Post.js'
import User from '../models/User.js'
import Message from '../models/Message.js'
import { authenticate, optionalAuth } from '../middleware/auth.js'
import { recalculateSellerRating, getSellerRatingStats, emitRatingUpdate } from '../lib/ratings.js'
import { evaluateRolePromotion } from '../lib/rolePromotion.js'
import { notify } from '../lib/notify.js'

const router = express.Router()

// GET /api/reviews/seller/:username
router.get('/seller/:username', optionalAuth, async (req, res) => {
  try {
    const seller = await User.findOne({ username: req.params.username })
    if (!seller) return res.status(404).json({ message: 'Penjual tidak ditemukan' })

    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10
    const skip = (page - 1) * limit

    const [reviews, total, stats] = await Promise.all([
      Review.find({ reviewee: seller._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reviewer', 'username avatar role')
        .populate('post', 'title images gameCategory'),
      Review.countDocuments({ reviewee: seller._id }),
      getSellerRatingStats(seller._id),
    ])

    res.json({
      reviews,
      total,
      page,
      pages: Math.ceil(total / limit),
      hasMore: skip + reviews.length < total,
      stats,
    })
  } catch (err) {
    console.error('Get reviews error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/reviews/post/:postId
router.get('/post/:postId', optionalAuth, async (req, res) => {
  try {
    const reviews = await Review.find({ post: req.params.postId })
      .sort({ createdAt: -1 })
      .populate('reviewer', 'username avatar role')

    res.json(reviews)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/reviews/my/:postId — check if current user reviewed this post
router.get('/my/:postId', authenticate, async (req, res) => {
  try {
    const review = await Review.findOne({
      reviewer: req.user._id,
      post: req.params.postId,
    })
    res.json({ review })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/reviews
router.post('/', authenticate, async (req, res) => {
  try {
    const { revieweeId, postId, rating, comment } = req.body

    if (!revieweeId || !rating) {
      return res.status(400).json({ message: 'Penjual dan rating wajib diisi' })
    }

    const numRating = Number(rating)
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: 'Rating harus 1–5' })
    }

    if (revieweeId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Tidak bisa review diri sendiri' })
    }

    const reviewee = await User.findById(revieweeId)
    if (!reviewee) return res.status(404).json({ message: 'Penjual tidak ditemukan' })

    let post = null
    if (postId) {
      post = await Post.findById(postId)
      if (!post) return res.status(404).json({ message: 'Postingan tidak ditemukan' })
      if (post.seller.toString() !== revieweeId) {
        return res.status(400).json({ message: 'Postingan tidak milik penjual ini' })
      }

      const existing = await Review.findOne({ reviewer: req.user._id, post: postId })
      if (existing) return res.status(409).json({ message: 'Anda sudah review postingan ini' })

      const isSeller = post.seller.toString() === req.user._id.toString()
      if (isSeller) return res.status(400).json({ message: 'Tidak bisa review postingan sendiri' })

      // Allow review on sold posts, or if buyer chatted with seller about this listing
      if (post.status !== 'sold') {
        const hasChatted = await Message.exists({
          $or: [
            { sender: req.user._id, receiver: revieweeId },
            { sender: revieweeId, receiver: req.user._id },
          ],
        })
        if (!hasChatted) {
          return res.status(403).json({
            message: 'Review hanya bisa diberikan setelah transaksi atau interaksi chat dengan penjual',
          })
        }
      }
    } else {
      const existing = await Review.findOne({
        reviewer: req.user._id,
        reviewee: revieweeId,
        post: { $exists: false },
      })
      if (existing) return res.status(409).json({ message: 'Anda sudah review penjual ini' })
    }

    const review = await Review.create({
      reviewer: req.user._id,
      reviewee: revieweeId,
      post: postId || undefined,
      rating: numRating,
      comment: comment?.trim(),
    })

    const stats = await recalculateSellerRating(revieweeId)
    await review.populate('reviewer', 'username avatar role')
    if (postId) await review.populate('post', 'title')

    emitRatingUpdate(req.io, {
      userId: revieweeId,
      username: reviewee.username,
      stats,
      review,
    })

    // Evaluate role promotion — rating just changed
    await evaluateRolePromotion(revieweeId, req.io)

    await notify(req.io, {
      recipient: revieweeId,
      actor: req.user._id,
      type: 'new_review',
      title: 'Review baru untuk Anda',
      body: `${req.user.username} memberi rating ${numRating}/5${comment ? `: "${comment.slice(0, 50)}"` : ''}`,
      link: `/profile/${reviewee.username}`,
      meta: { rating: numRating, postId, stats },
    })

    res.status(201).json({ review, stats, seller: { rating: stats.rating, ratingCount: stats.ratingCount } })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Anda sudah memberikan review ini' })
    }
    console.error('Create review error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// PATCH /api/reviews/:id — reviewer edits their own review
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { rating, comment } = req.body

    const review = await Review.findById(req.params.id)
    if (!review) return res.status(404).json({ message: 'Review tidak ditemukan' })

    if (review.reviewer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Hanya pemberi review yang bisa mengedit' })
    }

    if (rating !== undefined) {
      const numRating = Number(rating)
      if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ message: 'Rating harus 1–5' })
      }
      review.rating = numRating
    }

    if (comment !== undefined) {
      review.comment = comment?.trim() || ''
    }

    await review.save()

    const reviewee = await User.findById(review.reviewee)
    const stats = await recalculateSellerRating(review.reviewee)
    await review.populate('reviewer', 'username avatar role')
    if (review.post) await review.populate('post', 'title images gameCategory')

    emitRatingUpdate(req.io, {
      userId: review.reviewee,
      username: reviewee?.username,
      stats,
      review,
    })

    // Re-evaluate role promotion after rating edit
    await evaluateRolePromotion(review.reviewee, req.io)

    res.json({ review, stats })
  } catch (err) {
    console.error('Edit review error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// PATCH /api/reviews/:id/reply — seller reply
router.patch('/:id/reply', authenticate, async (req, res) => {
  try {
    const { reply } = req.body
    if (!reply?.trim()) return res.status(400).json({ message: 'Balasan tidak boleh kosong' })

    const review = await Review.findById(req.params.id)
    if (!review) return res.status(404).json({ message: 'Review tidak ditemukan' })

    if (review.reviewee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Hanya penjual yang bisa membalas' })
    }

    review.sellerReply = reply.trim()
    review.sellerReplyAt = new Date()
    await review.save()
    await review.populate('reviewer', 'username avatar role')

    res.json(review)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

export default router
