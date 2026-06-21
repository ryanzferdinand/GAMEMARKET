import express from 'express'
import Post from '../models/Post.js'
import User from '../models/User.js'
import Comment from '../models/Comment.js'
import Report from '../models/Report.js'
import Category from '../models/Category.js'
import { GAME_CATEGORIES } from '../lib/constants.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { notify } from '../lib/notify.js'
import { bustCategoriesCache } from '../server.js'

const router = express.Router()

// All admin routes require authentication + admin/moderator role
router.use(authenticate, requireRole('admin', 'moderator'))

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [totalPosts, totalUsers, pendingPosts, pendingReports, totalViews] = await Promise.all([
      Post.countDocuments(),
      User.countDocuments(),
      Post.countDocuments({ status: 'pending' }),
      Report.countDocuments({ status: 'pending' }),
      Post.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
    ])

    res.json({
      totalPosts,
      totalUsers,
      pendingPosts,
      pendingReports,
      totalViews: totalViews[0]?.total || 0,
    })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/admin/posts
router.get('/posts', async (req, res) => {
  try {
    const { status = 'pending', search, page = 1, limit = 50 } = req.query
    const query = { status }
    if (search) query.$text = { $search: search }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate('seller', 'username avatar role')

    res.json({ posts })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/admin/posts/:id/approve
router.post('/posts/:id/approve', async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', rejectionReason: null },
      { new: true }
    ).populate('seller', 'username')

    if (!post) return res.status(404).json({ message: 'Postingan tidak ditemukan' })

    // Notify via socket
    req.io?.to(`user:${post.seller._id}`).emit('post:approved', {
      postId: post._id,
      title: post.title,
    })

    // Persistent notification
    await notify(req.io, {
      recipient: post.seller._id,
      actor: req.user._id,
      type: 'post_approved',
      title: 'Postingan disetujui',
      body: `"${post.title}" sudah tayang dan bisa dilihat pembeli.`,
      link: `/post/${post._id}`,
    })

    res.json({ message: 'Postingan disetujui', post })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/admin/posts/:id/reject
router.post('/posts/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', rejectionReason: reason || 'Tidak memenuhi ketentuan' },
      { new: true }
    ).populate('seller', 'username')

    if (!post) return res.status(404).json({ message: 'Postingan tidak ditemukan' })

    req.io?.to(`user:${post.seller._id}`).emit('post:rejected', {
      postId: post._id,
      title: post.title,
      reason,
    })

    await notify(req.io, {
      recipient: post.seller._id,
      actor: req.user._id,
      type: 'post_rejected',
      title: 'Postingan ditolak',
      body: reason ? `"${post.title}" ditolak. Alasan: ${reason}` : `"${post.title}" ditolak oleh moderator.`,
      link: `/my-posts`,
    })

    res.json({ message: 'Postingan ditolak', post })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// DELETE /api/admin/posts/:id — hard delete with reason (notifies seller)
router.delete('/posts/:id', async (req, res) => {
  try {
    const { reason } = req.body
    if (!reason?.trim()) {
      return res.status(400).json({ message: 'Alasan penghapusan wajib diisi' })
    }

    const post = await Post.findById(req.params.id).populate('seller', 'username')
    if (!post) return res.status(404).json({ message: 'Postingan tidak ditemukan' })

    const sellerId = post.seller._id
    const title = post.title

    await Post.findByIdAndDelete(req.params.id)
    await Comment.deleteMany({ post: req.params.id })

    req.io?.to(`user:${sellerId}`).emit('post:deleted', {
      postId: req.params.id,
      title,
      reason: reason.trim(),
    })

    await notify(req.io, {
      recipient: sellerId,
      actor: req.user._id,
      type: 'post_deleted',
      title: 'Postingan dihapus',
      body: `"${title}" dihapus oleh moderator. Alasan: ${reason.trim()}`,
      link: '/my-posts',
    })

    res.json({ message: 'Postingan dihapus' })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query
    const query = {}
    if (search) {
      query.$text = { $search: search }
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean()

    res.json(users)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.body
    const validRoles = ['admin', 'moderator', 'trusted_seller', 'trusted_buyer', 'seller', 'buyer']
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Role tidak valid' })
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true })
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' })

    await Post.updateMany({ seller: user._id }, { $set: { sellerRole: role } })

    res.json({ message: 'Role diperbarui', user })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// PATCH /api/admin/users/:id/verify
router.patch('/users/:id/verify', requireRole('admin'), async (req, res) => {
  try {
    const { verified } = req.body
    const user = await User.findByIdAndUpdate(req.params.id, { verified }, { new: true })
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' })

    res.json({ message: 'Status verifikasi diperbarui', user })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', async (req, res) => {
  try {
    const { reason } = req.body
    if (!reason?.trim()) {
      return res.status(400).json({ message: 'Alasan pemblokiran wajib diisi' })
    }

    const target = await User.findById(req.params.id)
    if (!target) return res.status(404).json({ message: 'Pengguna tidak ditemukan' })

    if (target.role === 'admin') {
      return res.status(403).json({ message: 'Tidak dapat memblokir admin' })
    }

    if (req.params.id === req.user._id.toString()) {
      return res.status(403).json({ message: 'Tidak dapat memblokir diri sendiri' })
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isBanned: true,
        banReason: reason.trim(),
        bannedAt: new Date(),
        bannedBy: req.user._id,
      },
      { new: true }
    )

    res.json({ message: 'Pengguna diblokir', user })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// PATCH /api/admin/users/:id/unban
router.patch('/users/:id/unban', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isBanned: false,
        banReason: null,
        bannedAt: null,
        bannedBy: null,
      },
      { new: true }
    )
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' })

    res.json({ message: 'Pemblokiran dicabut', user })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// ── Category Management ────────────────────────────────────────

// Seed DB from constants if empty (called once on first GET)
async function seedCategoriesIfEmpty() {
  const count = await Category.countDocuments()
  if (count === 0) {
    const docs = GAME_CATEGORIES.map((c, i) => ({ ...c, order: i, isActive: true }))
    await Category.insertMany(docs)
  }
}

// GET /api/admin/categories  (also used publicly via /api/categories)
router.get('/categories', async (req, res) => {
  try {
    await seedCategoriesIfEmpty()
    const cats = await Category.find().sort({ order: 1, createdAt: 1 })
    res.json(cats)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/admin/categories
router.post('/categories', requireRole('admin'), async (req, res) => {
  try {
    const { id, name, icon, color } = req.body
    if (!id?.trim() || !name?.trim()) {
      return res.status(400).json({ message: 'ID dan nama kategori wajib diisi' })
    }

    const slug = id.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const exists = await Category.findOne({ id: slug })
    if (exists) return res.status(409).json({ message: 'ID kategori sudah digunakan' })

    const maxOrder = await Category.findOne().sort({ order: -1 }).select('order')
    const cat = await Category.create({
      id: slug,
      name: name.trim(),
      icon: icon?.trim() || 'GM',
      color: color?.trim() || 'from-slate-400 to-slate-600',
      order: (maxOrder?.order ?? -1) + 1,
    })
    bustCategoriesCache()
    res.status(201).json(cat)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'ID kategori sudah digunakan' })
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// PATCH /api/admin/categories/:id
router.patch('/categories/:id', requireRole('admin'), async (req, res) => {
  try {
    const { name, icon, color, order, isActive } = req.body
    const updates = {}
    if (name !== undefined) updates.name = name.trim()
    if (icon !== undefined) updates.icon = icon.trim()
    if (color !== undefined) updates.color = color.trim()
    if (order !== undefined) updates.order = Number(order)
    if (isActive !== undefined) updates.isActive = Boolean(isActive)

    const cat = await Category.findOneAndUpdate({ id: req.params.id }, updates, { new: true })
    if (!cat) return res.status(404).json({ message: 'Kategori tidak ditemukan' })
    bustCategoriesCache()
    res.json(cat)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', requireRole('admin'), async (req, res) => {
  try {
    const cat = await Category.findOneAndDelete({ id: req.params.id })
    if (!cat) return res.status(404).json({ message: 'Kategori tidak ditemukan' })
    res.json({ message: 'Kategori dihapus' })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

export default router
