import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token tidak ditemukan' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.userId)
    if (!user) {
      return res.status(401).json({ message: 'Pengguna tidak ditemukan' })
    }

    // Check token version
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ message: 'Token tidak valid atau sudah kedaluwarsa' })
    }

    if (user.isBanned) {
      return res.status(403).json({
        message: 'Akun Anda telah diblokir',
        banReason: user.banReason || 'Pelanggaran ketentuan platform',
      })
    }

    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Token tidak valid atau sudah kedaluwarsa' })
  }
}

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next()
    }
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId)
    // Check token version for optional auth too
    if (user && decoded.tokenVersion === user.tokenVersion) req.user = user
  } catch {}
  next()
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Tidak terautentikasi' })
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Akses ditolak. Role tidak mencukupi.' })
  }
  next()
}

export const generateToken = (userId, tokenVersion = 0) => {
  return jwt.sign({ userId, tokenVersion }, process.env.JWT_SECRET, { expiresIn: '30d' })
}
