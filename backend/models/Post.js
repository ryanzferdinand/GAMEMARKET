import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 2000 },
  parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  votes: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['up', 'down'] },
  }],
}, { timestamps: true })

const postSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, maxlength: 2000 },
  price: { type: Number, required: true, min: 0 },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerRole: { type: String, index: true },
  images: [String],
  gameCategoryId: { type: String, required: true },
  gameCategory: String,
  gameCategoryColor: String,
  gameIcon: String,
  details: { type: Map, of: String, default: {} },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'sold'],
    default: 'pending',
  },
  rejectionReason: String,
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  views: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  isBoosted: { type: Boolean, default: false },
  boostExpiresAt: Date,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})

// Full-text search index
postSchema.index({ title: 'text', description: 'text', gameCategory: 'text' })
postSchema.index({ status: 1, createdAt: -1 })
postSchema.index({ seller: 1, status: 1 })
postSchema.index({ gameCategoryId: 1, status: 1 })
postSchema.index({ sellerRole: 1, status: 1 })

export default mongoose.model('Post', postSchema)
