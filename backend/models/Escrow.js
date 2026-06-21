import mongoose from 'mongoose'
import { ESCROW_STATUS } from '../lib/marketplaceConstants.js'

const escrowSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0 },
  feeAmount: { type: Number, default: 0 },
  sellerAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: Object.values(ESCROW_STATUS),
    default: ESCROW_STATUS.ACTIVE,
  },
  frozenAt: Date,
  completedAt: Date,
  refundedAt: Date,
}, { timestamps: true })

escrowSchema.index({ status: 1 })
escrowSchema.index({ seller: 1, status: 1 })

export default mongoose.model('Escrow', escrowSchema)
