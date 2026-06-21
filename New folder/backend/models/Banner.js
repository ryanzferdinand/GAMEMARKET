import mongoose from 'mongoose'

const bannerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: String,
  cta: String,
  ctaLink: { type: String, default: '/' },
  gradient: String,
  emoji: String,
  imageUrl: String,
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  linkedPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
})

export default mongoose.model('Banner', bannerSchema)
