import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_]+$/,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    select: false,
  },
  googleId: String,
  avatar: String,
  bio: { type: String, maxlength: 200 },
  banner: { type: String },
  bannerColor: { type: String, default: 'from-neutral-800 to-neutral-900' },
  role: {
    type: String,
    enum: ['admin', 'moderator', 'supervisor', 'trusted_seller', 'trusted_buyer', 'seller', 'buyer'],
    default: 'buyer',
  },
  moderatorStatus: {
    type: String,
    enum: ['online', 'busy', 'offline'],
    default: 'offline',
  },
  verified: { type: Boolean, default: false },
  // ── Email verification ────────────────────────────────────────────────────
  emailVerified: { type: Boolean, default: false },
  emailVerifyToken: { type: String, select: false },
  emailVerifyExpires: { type: Date, select: false },
  emailVerifyOtp: { type: String, select: false },
  emailVerifyOtpExpires: { type: Date, select: false },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, maxlength: 500 },
  bannedAt: Date,
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isOnline: { type: Boolean, default: false },
  totalSales: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  lastSeen: Date,
  tokenVersion: { type: Number, default: 0 },
}, {
  timestamps: true,
})

userSchema.index({ username: 'text', email: 'text' })

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

userSchema.methods.toPublic = function () {
  const obj = this.toObject()
  delete obj.password
  delete obj.googleId
  return obj
}

export default mongoose.model('User', userSchema)
