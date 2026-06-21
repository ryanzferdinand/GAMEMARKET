import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema({
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 1000, trim: true },
  sellerReply: { type: String, maxlength: 500, trim: true },
  sellerReplyAt: Date,
}, { timestamps: true })

reviewSchema.index({ reviewee: 1, createdAt: -1 })
reviewSchema.index({ post: 1, createdAt: -1 })
reviewSchema.index({ reviewer: 1, post: 1 }, { unique: true, sparse: true })
reviewSchema.index(
  { reviewer: 1, reviewee: 1 },
  { unique: true, partialFilterExpression: { post: { $exists: false } } }
)

export default mongoose.model('Review', reviewSchema)
