import mongoose from 'mongoose'

const sellerProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  totalOrders: { type: Number, default: 0 },
  completedOrders: { type: Number, default: 0 },
  disputedOrders: { type: Number, default: 0 },
  cancelledOrders: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  avgResponseMinutes: { type: Number, default: 0 },
  responseCount: { type: Number, default: 0 },
  verifiedBadge: { type: Boolean, default: false },
}, { timestamps: true })

sellerProfileSchema.virtual('successRate').get(function () {
  if (!this.totalOrders) return 100
  return Math.round((this.completedOrders / this.totalOrders) * 100)
})

sellerProfileSchema.virtual('disputeRate').get(function () {
  if (!this.totalOrders) return 0
  return Math.round((this.disputedOrders / this.totalOrders) * 100)
})

sellerProfileSchema.virtual('completionRate').get(function () {
  if (!this.totalOrders) return 100
  return Math.round((this.completedOrders / this.totalOrders) * 100)
})

sellerProfileSchema.set('toJSON', { virtuals: true })
sellerProfileSchema.set('toObject', { virtuals: true })

export default mongoose.model('SellerProfile', sellerProfileSchema)
