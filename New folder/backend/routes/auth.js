import express from 'express'
import crypto from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import rateLimit from 'express-rate-limit'
import User from '../models/User.js'
import { generateToken, authenticate } from '../middleware/auth.js'
import { getOrCreateWallet } from '../lib/walletService.js'
import { sendOtpEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../lib/emailService.js'

const router = express.Router()
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

// ── Baca env tiap request agar tidak perlu restart saat .env berubah ──────────
function isVerifyRequired() {
  return process.env.EMAIL_VERIFICATION_REQUIRED === 'true'
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' },
})

const resendLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: { message: 'Terlalu banyak permintaan OTP. Coba lagi dalam 5 menit.' },
})

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password minimal 8 karakter'
  }
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  if (!hasLetter || !hasNumber) {
    return 'Password harus mengandung huruf dan angka'
  }
  return null
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function generateVerifyToken() {
  return crypto.randomBytes(32).toString('hex')
}

function publicUser(user) {
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    verified: user.verified,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  }
}

// ── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password, role } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, dan password wajib diisi' })
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ message: 'Username harus 3-20 karakter' })
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ message: 'Username hanya boleh huruf, angka, dan underscore' })
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password minimal 8 karakter' })
    }
    const pwdError = validatePassword(password)
    if (pwdError) return res.status(400).json({ message: pwdError })

    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: { $regex: new RegExp(`^${username}$`, 'i') } },
      ],
    })

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res.status(409).json({ message: 'Email sudah terdaftar' })
      }
      return res.status(409).json({ message: 'Username sudah digunakan' })
    }

    const allowedRoles = ['buyer', 'seller']
    const userRole = allowedRoles.includes(role) ? role : 'buyer'

    // Buat token & OTP verifikasi
    const verifyToken   = generateVerifyToken()
    const otp           = generateOtp()
    const tokenExpires  = new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24 jam
    const otpExpires    = new Date(Date.now() + 10 * 60 * 1000)        // 10 menit

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password,
      role: userRole,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      emailVerified: false,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: tokenExpires,
      emailVerifyOtp: otp,
      emailVerifyOtpExpires: otpExpires,
    })

    await getOrCreateWallet(user._id)

    // Kirim OTP email (non-blocking)
    sendOtpEmail({ to: user.email, username: user.username, otp })
      .catch((err) => console.error('Email send error:', err.message))

    // Jika verifikasi diwajibkan, jangan kembalikan token JWT dulu
    if (isVerifyRequired()) {
      return res.status(201).json({
        requiresVerification: true,
        userId: user._id,
        email: user.email,
        message: 'Akun dibuat. Cek email untuk verifikasi sebelum login.',
      })
    }

    // Verifikasi tidak diwajibkan — langsung login
    const token = generateToken(user._id, user.tokenVersion)
    res.status(201).json({ token, user: publicUser(user) })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi' })
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password +emailVerified +emailVerifyToken +emailVerifyExpires +emailVerifyOtp +emailVerifyOtpExpires'
    )
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Email atau password salah' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Email atau password salah' })
    }

    if (user.isBanned) {
      return res.status(403).json({
        message: 'Akun Anda telah diblokir',
        banReason: user.banReason || 'Pelanggaran ketentuan platform',
      })
    }

    // Blokir login jika email belum diverifikasi (hanya jika diaktifkan)
    // emailVerified bisa undefined pada user lama — anggap belum terverifikasi
    const emailVerified = user.emailVerified === true
    if (isVerifyRequired() && !emailVerified) {
      // Kirim ulang OTP baru jika yang lama sudah kedaluwarsa
      if (!user.emailVerifyOtpExpires || user.emailVerifyOtpExpires < new Date()) {
        const newOtp     = generateOtp()
        const newToken   = generateVerifyToken()
        user.emailVerifyOtp        = newOtp
        user.emailVerifyOtpExpires = new Date(Date.now() + 10 * 60 * 1000)
        user.emailVerifyToken      = newToken
        user.emailVerifyExpires    = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await user.save()
        sendOtpEmail({ to: user.email, username: user.username, otp: newOtp })
          .catch((e) => console.error('Email send error:', e.message))
      }
      return res.status(403).json({
        requiresVerification: true,
        userId: user._id,
        email: user.email,
        message: 'Email belum diverifikasi. Cek email Anda untuk kode verifikasi.',
      })
    }

    const token = generateToken(user._id, user.tokenVersion)
    res.json({ token, user: publicUser(user) })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// ── GET /api/auth/verify-email?token=... ────────────────────────────────────
// Klik dari link email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query
    if (!token) return res.status(400).json({ message: 'Token tidak valid' })

    const user = await User.findOne({
      emailVerifyToken: token,
      emailVerifyExpires: { $gt: new Date() },
    }).select('+emailVerifyToken +emailVerifyExpires +emailVerifyOtp +emailVerifyOtpExpires')

    if (!user) {
      return res.status(400).json({ message: 'Token tidak valid atau sudah kedaluwarsa' })
    }

    user.emailVerified          = true
    user.emailVerifyToken       = undefined
    user.emailVerifyExpires     = undefined
    user.emailVerifyOtp         = undefined
    user.emailVerifyOtpExpires  = undefined
    await user.save()

    // Langsung kembalikan JWT agar user bisa langsung masuk setelah klik link
    const jwtToken = generateToken(user._id, user.tokenVersion)
    res.json({
      message: 'Email berhasil diverifikasi',
      token: jwtToken,
      user: publicUser(user),
    })
  } catch (err) {
    console.error('Verify email error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// ── POST /api/auth/verify-otp ────────────────────────────────────────────────
// Verifikasi via 6-digit OTP
router.post('/verify-otp', authLimiter, async (req, res) => {
  try {
    const { userId, otp } = req.body
    if (!userId || !otp) {
      return res.status(400).json({ message: 'userId dan otp wajib diisi' })
    }

    const user = await User.findById(userId).select(
      '+emailVerifyOtp +emailVerifyOtpExpires +emailVerifyToken +emailVerifyExpires'
    )
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' })

    if (user.emailVerified) {
      const token = generateToken(user._id, user.tokenVersion)
      return res.json({ message: 'Email sudah terverifikasi', token, user: publicUser(user) })
    }

    if (!user.emailVerifyOtp || user.emailVerifyOtpExpires < new Date()) {
      return res.status(400).json({ message: 'Kode OTP sudah kedaluwarsa. Minta kode baru.' })
    }

    if (user.emailVerifyOtp !== String(otp).trim()) {
      return res.status(400).json({ message: 'Kode OTP salah' })
    }

    user.emailVerified         = true
    user.emailVerifyToken      = undefined
    user.emailVerifyExpires    = undefined
    user.emailVerifyOtp        = undefined
    user.emailVerifyOtpExpires = undefined
    await user.save()

    const jwtToken = generateToken(user._id, user.tokenVersion)

    // Kirim welcome email non-blocking
    sendWelcomeEmail({ to: user.email, username: user.username })
      .catch((e) => console.error('Welcome email error:', e.message))

    res.json({
      message: 'Email berhasil diverifikasi',
      token: jwtToken,
      user: publicUser(user),
    })
  } catch (err) {
    console.error('OTP verify error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// ── POST /api/auth/resend-verification ──────────────────────────────────────
router.post('/resend-verification', resendLimiter, async (req, res) => {
  try {
    const { userId, email } = req.body
    if (!userId && !email) {
      return res.status(400).json({ message: 'userId atau email wajib diisi' })
    }

    const query = userId ? { _id: userId } : { email: email.toLowerCase() }
    const user  = await User.findOne(query).select(
      '+emailVerifyToken +emailVerifyExpires +emailVerifyOtp +emailVerifyOtpExpires'
    )
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' })
    if (user.emailVerified) {
      return res.json({ message: 'Email sudah terverifikasi' })
    }

    const newOtp    = generateOtp()
    const newToken  = generateVerifyToken()
    user.emailVerifyOtp         = newOtp
    user.emailVerifyOtpExpires  = new Date(Date.now() + 10 * 60 * 1000)
    user.emailVerifyToken       = newToken
    user.emailVerifyExpires     = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await user.save()

    // Kirim email — tangkap error agar tidak crash jadi 500
    let emailError = null
    try {
      // Kirim satu email berisi OTP sekaligus link klik
      await sendOtpEmail({ to: user.email, username: user.username, otp: newOtp })
    } catch (err) {
      emailError = err.message
      console.error('Resend email error:', err.message)
    }

    if (emailError) {
      return res.status(502).json({
        message: `Gagal mengirim email: ${emailError}. OTP sudah dibuat, coba kirim ulang lagi.`,
      })
    }

    res.json({ message: 'Kode OTP dikirim ulang. Cek inbox Anda.' })
  } catch (err) {
    console.error('Resend verification error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ message: 'Email wajib diisi' })
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+passwordResetToken +passwordResetExpires +password',
    )

    if (user?.password) {
      const token = crypto.randomBytes(32).toString('hex')
      user.passwordResetToken = hashResetToken(token)
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000)
      await user.save()

      try {
        await sendPasswordResetEmail({ to: user.email, username: user.username, token })
      } catch (err) {
        console.error('Password reset email error:', err.message)
      }
    }

    res.json({
      message: 'Jika email terdaftar, link reset password telah dikirim. Cek inbox Anda.',
    })
  } catch (err) {
    console.error('Forgot password error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body
    if (!token || !password) {
      return res.status(400).json({ message: 'Token dan password wajib diisi' })
    }

    const pwdError = validatePassword(password)
    if (pwdError) return res.status(400).json({ message: pwdError })

    const user = await User.findOne({
      passwordResetToken: hashResetToken(token),
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +password')

    if (!user) {
      return res.status(400).json({ message: 'Token tidak valid atau sudah kadaluarsa' })
    }

    user.password = password
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    user.tokenVersion += 1
    await user.save()

    res.json({ message: 'Password berhasil diubah. Silakan masuk.' })
  } catch (err) {
    console.error('Reset password error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// ── POST /api/auth/google ────────────────────────────────────────────────────
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ message: 'Google token tidak ditemukan' })
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: 'Google OAuth belum dikonfigurasi' })
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    const { sub: googleId, email, name, picture } = payload

    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] })
    let isNew = false

    if (!user) {
      isNew = true
      let username = name.replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '')
      if (username.length < 3) username = `user_${Date.now()}`

      let finalUsername = username
      let counter = 1
      while (await User.findOne({ username: new RegExp(`^${finalUsername}$`, 'i') })) {
        finalUsername = `${username}${counter++}`
      }

      user = await User.create({
        googleId,
        email: email.toLowerCase(),
        username: finalUsername,
        avatar: picture,
        role: 'buyer',
        verified: true,
        emailVerified: true, // Google sudah memverifikasi email
      })
      await getOrCreateWallet(user._id)
    } else if (!user.googleId) {
      user.googleId      = googleId
      if (!user.avatar)  user.avatar = picture
      user.emailVerified = true // Link Google → anggap terverifikasi
      await user.save()
    }

    if (user.isBanned) {
      return res.status(403).json({
        message: 'Akun Anda telah diblokir',
        banReason: user.banReason || 'Pelanggaran ketentuan platform',
      })
    }

    const jwtToken = generateToken(user._id, user.tokenVersion)
    res.json({ token: jwtToken, isNew, user: publicUser(user) })
  } catch (err) {
    console.error('Google auth error:', err)
    res.status(500).json({ message: 'Autentikasi Google gagal' })
  }
})

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } })
    res.json({ message: 'Logout berhasil' })
  } catch (err) {
    console.error('Logout error:', err)
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const { password, googleId, ...user } = req.user.toObject()
  res.json(user)
})

// ── GET /api/auth/online-users ───────────────────────────────────────────────
router.get('/online-users', authenticate, (req, res) => {
  import('../socket/handlers.js').then(({ onlineUsers }) => {
    res.json({ onlineIds: Array.from(onlineUsers.keys()) })
  }).catch(() => res.json({ onlineIds: [] }))
})

export default router
