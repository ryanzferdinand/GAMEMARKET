import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who triggered it
  type: {
    type: String,
    enum: [
      'post_approved',
      'post_rejected',
      'post_deleted',
      'post_like',
      'post_dislike',
      'comment_vote',
      'new_message',
      'new_comment',
      'new_review',
      'new_report',
      'report_resolved',
      'post_updated',
      'forum_mention',
      'deposit_success',
      'payment_success',
      'escrow_active',
      'seller_delivered',
      'buyer_confirmed',
      'auto_confirmed',
      'dispute_opened',
      'dispute_resolved',
      'withdraw_requested',
      'withdraw_success',
      'refund_success',
      'order_message',
      'moderation_fee_earned',    // moderator/admin menerima fee moderasi
      'moderation_fee_charged',   // buyer/seller dicharge biaya moderasi
      'cancel_requested',
      'order_cancelled',
      'new_offer',
      'offer_accepted',
      'offer_rejected',
      'offer_cancelled',
      'order_mention',
    ],
    required: true,
  },
  title:   { type: String, required: true },
  body:    { type: String },
  link:    { type: String },          // route to navigate to
  read:    { type: Boolean, default: false },
  meta:    { type: mongoose.Schema.Types.Mixed }, // extra data
}, { timestamps: true })

// BUG-010: Auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 })

export default mongoose.model('Notification', notificationSchema)
