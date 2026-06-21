import mongoose from 'mongoose'
import { ORDER_STATUS } from '../lib/marketplaceConstants.js'

const deliverySchema = new mongoose.Schema({
  email: String,
  password: String,
  recovery: String,
  notes: { type: String, maxlength: 2000 },
  attachments: [String],
  deliveredAt: Date,
}, { _id: false })

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0 },
  feeAmount: { type: Number, default: 0 },
  sellerAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.ESCROW_ACTIVE,
  },
  escrow: { type: mongoose.Schema.Types.ObjectId, ref: 'Escrow' },
  delivery: deliverySchema,
  buyerCheckDeadline: Date,
  autoConfirmed: { type: Boolean, default: false },
  confirmedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelReason: { type: String, maxlength: 500 },
  cancelRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  dispute: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute' },
  review: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review',
    default: null,
  },
}, { timestamps: true })

orderSchema.index({ buyer: 1, status: 1, createdAt: -1 })
orderSchema.index({ seller: 1, status: 1, createdAt: -1 })
orderSchema.index({ status: 1, buyerCheckDeadline: 1 })
orderSchema.index({ post: 1 })

export default mongoose.model('Order', orderSchema)
