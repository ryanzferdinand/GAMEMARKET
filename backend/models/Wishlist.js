import mongoose from 'mongoose'

const wishlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
}, { timestamps: true })

wishlistSchema.index({ user: 1, post: 1 }, { unique: true })
wishlistSchema.index({ user: 1, createdAt: -1 })

export default mongoose.model('Wishlist', wishlistSchema)
