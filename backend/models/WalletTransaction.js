import mongoose from 'mongoose'
import { WALLET_TX_TYPES } from '../lib/marketplaceConstants.js'

const walletTransactionSchema = new mongoose.Schema({
  wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: WALLET_TX_TYPES, required: true },
  amount: { type: Number, required: true },
  balanceBefore: {
    available: Number,
    pending: Number,
    frozen: Number,
  },
  balanceAfter: {
    available: Number,
    pending: Number,
    frozen: Number,
  },
  referenceType: { type: String },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  description: { type: String, maxlength: 500 },
  meta: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true })

walletTransactionSchema.index({ user: 1, createdAt: -1 })
walletTransactionSchema.index({ wallet: 1, createdAt: -1 })

export default mongoose.model('WalletTransaction', walletTransactionSchema)
