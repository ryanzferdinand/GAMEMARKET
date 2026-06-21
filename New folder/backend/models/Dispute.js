import mongoose from 'mongoose'
import { DISPUTE_REASONS, DISPUTE_STATUS } from '../lib/marketplaceConstants.js'

const disputeSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, enum: DISPUTE_REASONS, required: true },
  description: { type: String, maxlength: 2000 },
  status: {
    type: String,
    enum: Object.values(DISPUTE_STATUS),
    default: DISPUTE_STATUS.OPEN,
  },
  resolution: {
    winner: { type: String, enum: ['buyer', 'seller', null], default: null },
    note: { type: String, maxlength: 2000 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  moderator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  claimedAt: Date,
  assignedAt: Date,
  lastModeratorActivity: Date,
  reassignedCount: { type: Number, default: 0 },

  // ─── Moderator session time tracking ────────────────────────────────────────
  // Setiap entry mencatat kapan mod masuk dan keluar dari sesi dispute chat.
  moderatorSessions: [
    {
      moderatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      joinedAt:    { type: Date },
      leftAt:      { type: Date },
      durationMinutes: { type: Number, default: 0 }, // diisi saat leftAt dicatat
    },
  ],
  // Total menit aktif moderator (dijumlah dari semua sesi setelah resolve)
  totalModeratorMinutes: { type: Number, default: 0 },

  // ─── Moderation fee ─────────────────────────────────────────────────────────
  moderationFee: {
    charged:        { type: Boolean, default: false },
    feeAmount:      { type: Number, default: 0 },
    freeMinutes:    { type: Number, default: 0 },
    actualMinutes:  { type: Number, default: 0 },
    feePercent:     { type: Number, default: 0 },
    paidBy:         { type: String, enum: ['buyer', 'seller', 'split', 'none'], default: 'none' },
    moderatorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    chargedAt:      Date,
  },
}, { timestamps: true })

disputeSchema.index({ status: 1, assignedAt: 1 })
disputeSchema.index({ moderator: 1, status: 1 })

export default mongoose.model('Dispute', disputeSchema)
