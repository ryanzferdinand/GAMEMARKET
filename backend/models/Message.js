import mongoose from 'mongoose'
import { encryptText, isEncrypted } from '../lib/chatCrypto.js'

const messageSchema = new mongoose.Schema({
  sender:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:  { type: String, default: '', maxlength: 2000 },
  imageUrl: { type: String, default: null },
  read:     { type: Boolean, default: false },
  edited:   { type: Boolean, default: false },
}, {
  timestamps: true,
})

messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 })
messageSchema.index({ receiver: 1, read: 1 })

messageSchema.pre('save', function encryptContent(next) {
  if (this.isModified('content') && this.content && !isEncrypted(this.content)) {
    this.content = encryptText(this.content)
  }
  next()
})

export default mongoose.model('Message', messageSchema)
