import express from 'express'
import Banner from '../models/Banner.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = express.Router()

// GET /api/banners/active (public)
router.get('/active', async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ order: 1, createdAt: -1 })
    res.json(banners)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/banners (admin)
router.get('/', authenticate, requireRole('admin', 'moderator'), async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1, createdAt: -1 })
    res.json(banners)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/banners
router.post('/', authenticate, requireRole('admin', 'moderator'), async (req, res) => {
  try {
    const banner = await Banner.create({ ...req.body, createdBy: req.user._id })
    res.status(201).json(banner)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// PUT /api/banners/:id
router.put('/:id', authenticate, requireRole('admin', 'moderator'), async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!banner) return res.status(404).json({ message: 'Banner tidak ditemukan' })
    res.json(banner)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// DELETE /api/banners/:id
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id)
    res.json({ message: 'Banner dihapus' })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

export default router
