import express from 'express'
import Post from '../models/Post.js'
import Comment from '../models/Comment.js'
import User from '../models/User.js'
import Order from '../models/Order.js'
import { getWalletSummary } from '../lib/walletService.js'
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { storeImage, storeImages } from '../lib/cloudinaryStorage.js'
import { GAME_CATEGORIES, ROLE_CONFIG } from '../lib/constants.js'
import { notify } from '../lib/notify.js'
import { shouldCountView } from '../lib/viewTracker.js'

const router = express.Router()

async function getCommentsWithReplies(postId, { page = 1, limit = 5 } = {}) {
  const skip = (page - 1) * limit
  const query = { post: postId, parentComment: null }
  const total = await Comment.countDocuments(query)

  const comments = await Comment.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'username avatar role')
    .lean()

  // BUG-004: single query for all replies instead of N+1
  const commentIds = comments.map((c) => c._id)
  const allReplies = await Comment.find({ parentComment: { $in: commentIds } })
    .sort({ createdAt: 1 })
    .populate('author', 'username avatar role')
    .lean()

  const repliesByParent = allReplies.reduce((acc, r) => {
    const key = r.parentComment.toString()
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  const commentsWithReplies = comments.map((c) => ({
    ...c,
    replies: repliesByParent[c._id.toString()] || [],
  }))

  return {
    comments: commentsWithReplies,
    total,
    page,
    hasMore: skip + comments.length < total,
  }
}

// GET /api/posts
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      sort = 'newest',
      category,
      search,
      minPrice,
      maxPrice,
      sellerRank,
      seller,
      status,
      myPosts,
    } = req.query

    const query = {}

    // Status filtering
    if (myPosts && req.user) {
      query.seller = req.user._id
      if (status && status !== 'all') query.status = status
    } else if (seller) {
      const sellerUser = await User.findOne({ username: seller })
      if (sellerUser) query.seller = sellerUser._id
      query.status = 'approved'
    } else {
      query.status = status || 'approved'
    }

    if (category) query.gameCategoryId = category
    if (search) query.$text = { $search: search }

    if (minPrice || maxPrice) {
      query.price = {}
      if (minPrice) query.price.$gte = Number(minPrice)
      if (maxPrice) query.price.$lte = Number(maxPrice)
    }

    // BUG-005: filter on denormalized sellerRole field
    if (sellerRank) {
      query.sellerRole = sellerRank
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      popular: { views: -1, likes: -1 },
    }

    const sortOption = sortMap[sort] || { createdAt: -1 }
    const skip = (Number(page) - 1) * Number(limit)

    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .populate('seller', 'username avatar role verified totalSales rating ratingCount')
        .lean(), // PERF-004
      Post.countDocuments(query),
    ])

    res.json({
      posts,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      hasMore: skip + posts.length < total,
    })
  } catch (err) {
    console.error('Get posts error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/posts
router.post('/', authenticate, ...upload.array('images', 5), async (req, res) => {
  try {
    const { title, description, price, gameCategoryId, details } = req.body

    if (!title || !price || !gameCategoryId) {
      return res.status(400).json({ message: 'Judul, harga, dan kategori wajib diisi' })
    }

    const category = GAME_CATEGORIES.find((c) => c.id === gameCategoryId)
    if (!category) {
      return res.status(400).json({ message: 'Kategori tidak valid' })
    }

    const roleConfig = ROLE_CONFIG[req.user.role]
    const status = roleConfig?.canPostWithoutApproval ? 'approved' : 'pending'

    const images = req.files?.length
      ? await storeImages(req.files, 'posts')
      : []

    const post = await Post.create({
      title: title.trim(),
      description: description?.trim(),
      price: Number(price),
      seller: req.user._id,
      sellerRole: req.user.role,
      images,
      gameCategoryId,
      gameCategory: category.name,
      gameCategoryColor: category.color,
      gameIcon: category.icon,
      details: details ? JSON.parse(details) : {},
      status,
    })

    await post.populate('seller', 'username avatar role verified')

    res.status(201).json({ post })
  } catch (err) {
    console.error('Create post error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/posts/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('seller', 'username avatar role verified totalSales rating ratingCount bio createdAt')

    if (!post) return res.status(404).json({ message: 'Postingan tidak ditemukan' })

    // Only show pending posts to the seller, admin, or moderator
    if (post.status !== 'approved' && post.status !== 'sold') {
      if (!req.user) return res.status(404).json({ message: 'Postingan tidak ditemukan' })
      const isOwner = post.seller._id.toString() === req.user._id.toString()
      const canModerate = ['admin', 'moderator'].includes(req.user.role)
      if (!isOwner && !canModerate) {
        return res.status(404).json({ message: 'Postingan tidak ditemukan' })
      }
    }

    // Increment views — only once per viewer per 4-hour window, never for the owner
    if (shouldCountView(req, 'post', req.params.id, post.seller._id)) {
      await Post.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } })
    }

    let marketplace = null
    if (req.user) {
      const [wallet, activeOrder, anyActiveOrder] = await Promise.all([
        getWalletSummary(req.user._id),
        Order.findOne({
          post: post._id,
          buyer: req.user._id,
          status: { $in: ['escrow_active', 'delivered', 'disputed'] },
        }).select('_id orderNumber status amount'),
        Order.findOne({
          post: post._id,
          status: { $in: ['escrow_active', 'delivered', 'disputed'] },
        }).select('_id buyer'),
      ])
      marketplace = {
        wallet,
        activeOrder,
        inTransaction: Boolean(anyActiveOrder),
        canPurchase:
          post.status === 'approved' &&
          post.seller._id.toString() !== req.user._id.toString() &&
          !anyActiveOrder &&
          wallet.availableBalance >= post.price,
        insufficientBalance:
          post.status === 'approved' &&
          post.seller._id.toString() !== req.user._id.toString() &&
          !anyActiveOrder &&
          wallet.availableBalance < post.price,
      }
    }

    res.json({ post, marketplace })
  } catch (err) {
    console.error('Get post error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// PATCH /api/posts/:id
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Postingan tidak ditemukan' })

    const isOwner = post.seller.toString() === req.user._id.toString()
    const canModerate = ['admin', 'moderator'].includes(req.user.role)

    if (!isOwner && !canModerate) {
      return res.status(403).json({ message: 'Tidak memiliki izin' })
    }

    const allowed = ['status']
    if (isOwner) allowed.push('title', 'description', 'price', 'details')

    const updates = {}
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        if (key === 'details' && typeof req.body.details === 'string') {
          updates[key] = JSON.parse(req.body.details)
        } else {
          updates[key] = req.body[key]
        }
      }
    })

    if (isOwner && updates.status === 'sold' && post.status !== 'sold') {
      // Block manual "sold" if there is an active escrow order on this post
      const activeOrder = await Order.findOne({
        post: post._id,
        status: { $in: ['escrow_active', 'delivered', 'disputed'] },
      }).select('_id orderNumber status')

      if (activeOrder) {
        return res.status(409).json({
          message: 'Tidak bisa ditandai terjual — postingan sedang dalam transaksi escrow aktif. Tunggu hingga pesanan selesai atau direfund.',
          orderId: activeOrder._id,
          orderStatus: activeOrder.status,
        })
      }

      // Increment totalSales and get updated seller
      const updatedSeller = await User.findByIdAndUpdate(
        post.seller,
        { $inc: { totalSales: 1 } },
        { new: true }
      )

      const updatedPost = await Post.findByIdAndUpdate(
        req.params.id,
        { status: 'sold' },
        { new: true }
      ).populate('seller', 'username avatar role verified totalSales rating ratingCount')

      // Notify the seller (themselves) and emit a real-time event
      await notify(req.io, {
        recipient: post.seller,
        actor: req.user._id,
        type: 'post_sold',
        title: 'Postingan berhasil terjual',
        body: `"${post.title}" telah ditandai sebagai terjual.`,
        link: `/my-posts`,
      })

      // SEC-008: only notify seller room + seller's own session
      req.io.to(`user:${updatedSeller._id}`).emit('seller:stats-updated', {
        sellerId: updatedSeller._id.toString(),
        totalSales: updatedSeller.totalSales,
      })
      req.io.to(`seller:${updatedSeller._id}`).emit('seller:stats-updated', {
        sellerId: updatedSeller._id.toString(),
        totalSales: updatedSeller.totalSales,
      })

      return res.json({ post: updatedPost })
    }

    const updated = await Post.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('seller', 'username avatar role verified totalSales rating')
    res.json({ post: updated })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// PUT /api/posts/:id — full edit with images (owner only)
router.put('/:id', authenticate, ...upload.array('images', 5), async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Postingan tidak ditemukan' })

    if (post.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Tidak memiliki izin' })
    }

    if (post.status === 'sold') {
      return res.status(400).json({ message: 'Postingan terjual tidak bisa diedit' })
    }

    // Allow editing pending posts — owner can update while awaiting review
    const { title, description, price, gameCategoryId, details, existingImages } = req.body

    if (!title?.trim()) return res.status(400).json({ message: 'Judul wajib diisi' })
    if (!price || Number(price) <= 0) return res.status(400).json({ message: 'Harga tidak valid' })
    if (!gameCategoryId) return res.status(400).json({ message: 'Kategori wajib diisi' })

    const category = GAME_CATEGORIES.find((c) => c.id === gameCategoryId)
    if (!category) return res.status(400).json({ message: 'Kategori tidak valid' })

    let keptImages = []
    try {
      keptImages = existingImages ? JSON.parse(existingImages) : post.images
    } catch {
      keptImages = post.images
    }

    const newImages = req.files?.length
      ? await storeImages(req.files, 'posts')
      : []
    const allImages = [...keptImages, ...newImages]

    if (allImages.length === 0) {
      return res.status(400).json({ message: 'Minimal 1 gambar diperlukan' })
    }
    if (allImages.length > 5) {
      return res.status(400).json({ message: 'Maksimal 5 gambar' })
    }

    const roleConfig = ROLE_CONFIG[req.user.role]
    const wasApproved = post.status === 'approved'
    const needsReapproval = wasApproved && !roleConfig?.canPostWithoutApproval

    const updates = {
      title: title.trim(),
      description: description?.trim(),
      price: Number(price),
      gameCategoryId,
      gameCategory: category.name,
      gameCategoryColor: category.color,
      gameIcon: category.icon,
      details: details ? JSON.parse(details) : post.details,
      images: allImages,
    }

    if (needsReapproval) {
      updates.status = 'pending'
    }

    const updated = await Post.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('seller', 'username avatar role verified totalSales rating')

    if (needsReapproval) {
      await notify(req.io, {
        recipient: req.user._id,
        actor: req.user._id,
        type: 'post_updated',
        title: 'Postingan dikirim ulang untuk ditinjau',
        body: `"${updated.title}" menunggu persetujuan setelah diedit.`,
        link: `/my-posts`,
      })
    }

    res.json({
      post: updated,
      needsReapproval,
      message: needsReapproval
        ? 'Perubahan disimpan. Postingan menunggu persetujuan ulang.'
        : 'Postingan berhasil diperbarui',
    })
  } catch (err) {
    console.error('Edit post error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// DELETE /api/posts/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Postingan tidak ditemukan' })

    const isOwner = post.seller.toString() === req.user._id.toString()
    const canModerate = ['admin', 'moderator'].includes(req.user.role)

    if (!isOwner && !canModerate) {
      return res.status(403).json({ message: 'Tidak memiliki izin' })
    }

    await Post.findByIdAndDelete(req.params.id)
    await Comment.deleteMany({ post: req.params.id })

    res.json({ message: 'Postingan dihapus' })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/posts/:id/vote
router.post('/:id/vote', authenticate, async (req, res) => {
  try {
    const { type } = req.body
    if (!['like', 'dislike'].includes(type)) {
      return res.status(400).json({ message: 'Tipe vote tidak valid' })
    }

    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Postingan tidak ditemukan' })

    // Cannot vote on pending or sold posts (but owner CAN vote on their own approved post)
    if (post.status !== 'approved') {
      return res.status(403).json({ message: 'Voting hanya tersedia pada postingan aktif' })
    }

    const userId = req.user._id
    const likeIdx = post.likes.indexOf(userId)
    const dislikeIdx = post.dislikes.indexOf(userId)

    if (type === 'like') {
      if (likeIdx !== -1) {
        post.likes.splice(likeIdx, 1) // Toggle off
      } else {
        post.likes.push(userId)
        if (dislikeIdx !== -1) post.dislikes.splice(dislikeIdx, 1)
      }
    } else {
      if (dislikeIdx !== -1) {
        post.dislikes.splice(dislikeIdx, 1)
      } else {
        post.dislikes.push(userId)
        if (likeIdx !== -1) post.likes.splice(likeIdx, 1)
      }
    }

    await post.save()

    // Notify post owner on like (not dislike, not self)
    if (type === 'like' && likeIdx === -1) {
      await notify(req.io, {
        recipient: post.seller,
        actor: userId,
        type: 'post_like',
        title: 'Postingan kamu disukai',
        body: `${req.user.username} menyukai "${post.title}"`,
        link: `/post/${post._id}`,
      })
    }

    // Re-populate seller so the frontend always gets the full seller object
    await post.populate('seller', 'username avatar role verified totalSales rating ratingCount')

    res.json({ post })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/posts/:id/comments
router.get('/:id/comments', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 5
    const result = await getCommentsWithReplies(req.params.id, { page, limit })
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/posts/:id/comments
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const { content, parentComment } = req.body
    if (!content?.trim()) {
      return res.status(400).json({ message: 'Komentar tidak boleh kosong' })
    }

    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Postingan tidak ditemukan' })

    // Cannot comment on pending or sold posts (owner CAN comment on their own approved post)
    if (post.status !== 'approved') {
      return res.status(403).json({ message: 'Komentar hanya tersedia pada postingan aktif' })
    }

    const comment = await Comment.create({
      post: req.params.id,
      author: req.user._id,
      content: content.trim(),
      parentComment: parentComment || null,
    })

    await Post.findByIdAndUpdate(req.params.id, { $inc: { commentCount: 1 } })
    await comment.populate('author', 'username avatar role')

    // Notify post owner about new comment (not self)
    await notify(req.io, {
      recipient: post.seller,
      actor: req.user._id,
      type: 'new_comment',
      title: 'Komentar baru di postinganmu',
      body: `${req.user.username}: "${content.trim().slice(0, 60)}"`,
      link: `/post/${req.params.id}`,
    })

    res.status(201).json(comment)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/posts/:id/comments/:commentId/vote
router.post('/:id/comments/:commentId/vote', authenticate, async (req, res) => {
  try {
    const { type } = req.body
    if (!['up', 'down'].includes(type)) {
      return res.status(400).json({ message: 'Tipe vote tidak valid' })
    }

    const comment = await Comment.findById(req.params.commentId)
    if (!comment) return res.status(404).json({ message: 'Komentar tidak ditemukan' })

    const userId = req.user._id.toString()
    const existingVote = comment.votes.find((v) => v.user.toString() === userId)

    if (existingVote) {
      if (existingVote.type === type) {
        comment.votes = comment.votes.filter((v) => v.user.toString() !== userId)
      } else {
        existingVote.type = type
      }
    } else {
      comment.votes.push({ user: req.user._id, type })
    }

    await comment.save()
    res.json({ votes: comment.votes })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

export default router
