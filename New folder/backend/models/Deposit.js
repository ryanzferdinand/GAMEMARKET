import mongoose from 'mongoose'
import { DEPOSIT_METHODS, PAYMENT_STATUS } from '../lib/marketplaceConstants.js'

const depositSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 10000 },
  method: { type: String, enum: DEPOSIT_METHODS, required: true },
  status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.WAITING },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  externalId: { type: String },
  paidAt: Date,
  expiredAt: Date,
}, { timestamps: true })

depositSchema.index({ user: 1, createdAt: -1 })
depositSchema.index({ status: 1, expiredAt: 1 }) // BUG-011: compound for expiry job query

export default mongoose.model('Deposit', depositSchema)
