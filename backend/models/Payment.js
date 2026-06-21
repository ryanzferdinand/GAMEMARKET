import mongoose from 'mongoose'
import { PAYMENT_STATUS } from '../lib/marketplaceConstants.js'

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deposit: { type: mongoose.Schema.Types.ObjectId, ref: 'Deposit' },
  amount: { type: Number, required: true, min: 1 },
  method: { type: String, required: true },
  status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.WAITING },
  gatewayRef: { type: String },
  gatewayPayload: { type: mongoose.Schema.Types.Mixed },
  webhookReceivedAt: Date,
  paidAt: Date,
  expiredAt: Date,
}, { timestamps: true })

paymentSchema.index({ gatewayRef: 1 })
paymentSchema.index({ user: 1, status: 1, createdAt: -1 })

export default mongoose.model('Payment', paymentSchema)
