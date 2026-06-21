import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import mongoSanitize from 'express-mongo-sanitize'
import { getAllowedOrigins, isAllowedOrigin, isProductionDeploy } from './lib/deploy.js'
import { migratePlaintextMessages } from './lib/migrateChat.js'
import { migratePlaintextDeliveries } from './lib/deliveryCrypto.js'
import Post from './models/Post.js'
import User from './models/User.js'

dotenv.config()

// Routes
import authRoutes from './routes/auth.js'
import postRoutes from './routes/posts.js'
import bannerRoutes from './routes/banners.js'
import forumRoutes from './routes/forum.js'
import chatRoutes from './routes/chat.js'
import userRoutes from './routes/users.js'
import adminRoutes from './routes/admin.js'
import notificationRoutes from './routes/notifications.js'
import reviewRoutes from './routes/reviews.js'
import wishlistRoutes from './routes/wishlist.js'
import reportRoutes from './routes/reports.js'
import searchRoutes from './routes/search.js'
import walletRoutes from './routes/wallet.js'
import paymentRoutes from './routes/payments.js'
import webhookRoutes from './routes/webhooks.js'
import orderRoutes from './routes/orders.js'
import disputeRoutes from './routes/disputes.js'
import marketplaceAdminRoutes from './routes/marketplaceAdmin.js'
import sellerStatsRoutes from './routes/sellerStats.js'
import { startMarketplaceJobs } from './lib/jobs/marketplaceJobs.js'

// Socket handlers
import { setupSocketHandlers } from './socket/handlers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const httpServer = createServer(app)

if (isProductionDeploy()) {
  app.set('trust proxy', 1)
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true)
    callback(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true)
      callback(new Error(`CORS blocked: ${origin}`))
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})

// Middleware
app.use(compression({ level: 6, threshold: 1024 })) // PERF-001: gzip responses

const isProd = process.env.NODE_ENV === 'production'
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*.cloudinary.com", "https://res.cloudinary.com"],
      // SEC-007: production builds use external scripts only — no unsafe-inline/eval
      scriptSrc: isProd
        ? ["'self'", "https://accounts.google.com"]
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://accounts.google.com"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:5000", "http://localhost:5173", "https://accounts.google.com"],
    },
  },
}))
app.use(cors(corsOptions))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Webhook routes need raw body — mount before JSON parser
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(mongoSanitize())

// Static files (uploads) — PERF-002: 30-day cache headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '30d',
  etag: true,
  lastModified: true,
}))

// Make io accessible in routes
app.use((req, res, next) => {
  req.io = io
  next()
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/banners', bannerRoutes)
app.use('/api/forum', forumRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/users', userRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/wishlist', wishlistRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/disputes', disputeRoutes)
app.use('/api/marketplace-admin', marketplaceAdminRoutes)
app.use('/api/seller', sellerStatsRoutes)

// Public categories endpoint — PERF-003: in-memory cache (10 min TTL)
import Category from './models/Category.js'
import { GAME_CATEGORIES } from './lib/constants.js'

let _categoriesCache = null
let _cacheExpiry = 0

export function bustCategoriesCache() {
  _categoriesCache = null
}

app.get('/api/categories', async (req, res) => {
  try {
    if (_categoriesCache && Date.now() < _cacheExpiry) {
      return res.json(_categoriesCache)
    }
    const count = await Category.countDocuments()
    if (count === 0) {
      const docs = GAME_CATEGORIES.map((c, i) => ({ ...c, order: i, isActive: true }))
      await Category.insertMany(docs)
    }
    const cats = await Category.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean()
    _categoriesCache = cats
    _cacheExpiry = Date.now() + 10 * 60 * 1000 // 10 minutes
    res.json(cats)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    mode: isProductionDeploy() ? 'production' : 'development',
  })
})

// Production: serve built frontend when dist exists (single-server custom domain deploy)
if (isProductionDeploy()) {
  const frontendDist = path.join(__dirname, '../frontend/dist')
  const indexHtml = path.join(frontendDist, 'index.html')

  if (fs.existsSync(indexHtml)) {
    app.use(express.static(frontendDist, { index: false }))

    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/uploads') ||
        req.path.startsWith('/socket.io')
      ) {
        return next()
      }
      res.sendFile(indexHtml, (err) => {
        if (err) next(err)
      })
    })
  }
}

// Socket.io setup
setupSocketHandlers(io)

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gamemarket')
    console.log('✅ MongoDB connected')
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message)
    process.exit(1)
  }
}

const PORT = process.env.PORT || 5000

connectDB().then(async () => {
  // ── Backfill emailVerified untuk user lama ───────────────────────────────
  // User yang dibuat sebelum fitur email verification punya emailVerified: undefined.
  // Jika EMAIL_VERIFICATION_REQUIRED=true, set emailVerified=true agar mereka tidak
  // terkunci — hanya user BARU yang harus verifikasi.
  // Jika EMAIL_VERIFICATION_REQUIRED=false, ini tidak berpengaruh.
  try {
    const { modifiedCount } = await (await import('./models/User.js')).default.updateMany(
      { emailVerified: { $exists: false } },
      { $set: { emailVerified: true } }
    )
    if (modifiedCount > 0) {
      console.log(`✅ Email backfill: set emailVerified=true for ${modifiedCount} existing user(s)`)
    }
  } catch (e) {
    console.warn('⚠️  Email backfill skipped:', e.message)
  }
  const chatKey = process.env.CHAT_ENCRYPTION_KEY || process.env.JWT_SECRET
  if (chatKey) {
    const migrated = await migratePlaintextMessages()
    console.log(
      migrated > 0
        ? `🔐 Chat encrypted at rest — migrated ${migrated} existing message(s)`
        : '🔐 Chat messages encrypted at rest (AES-256-GCM)'
    )
  } else {
    console.warn('⚠️  No CHAT_ENCRYPTION_KEY — chat stored as plaintext')
  }

  try {
    const deliveryMigrated = await migratePlaintextDeliveries()
    if (deliveryMigrated > 0) {
      console.log(`🔐 Encrypted ${deliveryMigrated} plaintext delivery credential(s)`)
    }
  } catch (e) {
    console.warn('⚠️  Delivery encryption migration skipped:', e.message)
  }

  try {
    const postsMissingRole = await Post.find({ sellerRole: { $exists: false } }).select('seller').limit(500)
    if (postsMissingRole.length > 0) {
      const sellerIds = [...new Set(postsMissingRole.map((p) => p.seller.toString()))]
      const sellers = await User.find({ _id: { $in: sellerIds } }).select('role')
      const roleById = Object.fromEntries(sellers.map((s) => [s._id.toString(), s.role]))
      await Promise.all(
        postsMissingRole.map((p) =>
          Post.updateOne({ _id: p._id }, { $set: { sellerRole: roleById[p.seller.toString()] || 'seller' } }),
        ),
      )
      console.log(`✅ Backfilled sellerRole on ${postsMissingRole.length} post(s)`)
    }
  } catch (e) {
    console.warn('⚠️  sellerRole backfill skipped:', e.message)
  }

  httpServer.listen(PORT, () => {
    const siteUrl = process.env.FRONTEND_URL || `http://localhost:${PORT}`
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`🌐 Site URL: ${siteUrl}`)
    console.log(`📊 Mode: ${isProductionDeploy() ? 'production' : 'development'}`)
    startMarketplaceJobs(io)
  })
})

export { io }
