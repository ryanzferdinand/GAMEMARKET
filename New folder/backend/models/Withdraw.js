import mongoose from 'mongoose'
import { WITHDRAW_METHODS, WITHDRAW_STATUS } from '../lib/marketplaceConstants.js'

const withdrawSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 1 },
  method: { type: String, enum: WITHDRAW_METHODS, required: true },
  accountNumber: { type: String, required: true, maxlength: 100 },
  accountName: { type: String, maxlength: 100 },
  status: {
    type: String,
    enum: Object.values(WITHDRAW_STATUS),
    default: WITHDRAW_STATUS.PENDING,
  },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: Date,
  rejectionReason: { type: String, maxlength: 500 },
  walletTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction' },
}, { timestamps: true })

withdrawSchema.index({ user: 1, createdAt: -1 })
withdrawSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model('Withdraw', withdrawSchema)
