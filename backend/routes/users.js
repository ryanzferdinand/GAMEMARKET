import express from 'express'
import User from '../models/User.js'
import { authenticate } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { storeImage } from '../lib/cloudinaryStorage.js'

const router = express.Router()

// GET /api/users/:username — public profile
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' })
    const { password, googleId, ...pub } = user.toObject()
    res.json(pub)
  } catch { res.status(500).json({ message: 'Server error' }) }
})

// PATCH /api/users/me — update own profile (text fields)
router.patch('/me', authenticate, async (req, res) => {
  try {
    const allowed = ['bio', 'username', 'bannerColor']
    const updates = {}

    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    // Validate username uniqueness if changed
    if (updates.username && updates.username !== req.user.username) {
      if (updates.username.length < 3 || updates.username.length > 20) {
        return res.status(400).json({ message: 'Username harus 3-20 karakter' })
      }
      if (!/^[a-zA-Z0-9_]+$/.test(updates.username)) {
        return res.status(400).json({ message: 'Username hanya huruf, angka, underscore' })
      }
      const exists = await User.findOne({
        username: new RegExp(`^${updates.username}$`, 'i'),
        _id: { $ne: req.user._id },
      })
      if (exists) return res.status(409).json({ message: 'Username sudah digunakan' })
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
    const { password, googleId, ...pub } = user.toObject()
    res.json(pub)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/users/me/avatar — upload avatar image
router.post('/me/avatar', authenticate, ...upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File tidak ada' })
    const avatarUrl = await storeImage(req.file, 'avatars')
    const user = await User.findByIdAndUpdate(req.user._id, { avatar: avatarUrl }, { new: true })
    const { password, googleId, ...pub } = user.toObject()
    res.json(pub)
  } catch { res.status(500).json({ message: 'Server error' }) }
})

// POST /api/users/me/banner — upload banner image
router.post('/me/banner', authenticate, ...upload.single('banner'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File tidak ada' })
    const bannerUrl = await storeImage(req.file, 'banners')
    const user = await User.findByIdAndUpdate(req.user._id, { banner: bannerUrl }, { new: true })
    const { password, googleId, ...pub } = user.toObject()
    res.json(pub)
  } catch { res.status(500).json({ message: 'Server error' }) }
})

export default router
