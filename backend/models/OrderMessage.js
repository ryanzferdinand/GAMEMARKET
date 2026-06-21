import mongoose from 'mongoose'

const orderMessageSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, maxlength: 5000, default: '' },
  imageUrl: String,
  isSystem: { type: Boolean, default: false },
  fraudDetected: { type: Boolean, default: false },
  fraudWarnings: [String],
  maskedContent: String,
  taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true })

orderMessageSchema.index({ order: 1, createdAt: 1 })

export default mongoose.model('OrderMessage', orderMessageSchema)
