export const MARKETPLACE_FEE_PERCENT = Number(process.env.MARKETPLACE_FEE_PERCENT) || 5
export const WITHDRAW_MIN = Number(process.env.WITHDRAW_MIN) || 50000
export const AUTO_CONFIRM_HOURS = Number(process.env.AUTO_CONFIRM_HOURS) || 24
export const MODERATOR_REASSIGN_MINUTES = Number(process.env.MODERATOR_REASSIGN_MINUTES) || 15

// ─── Dispute Moderation Fee ───────────────────────────────────────────────────
// Jika waktu moderator di dalam dispute chat melebihi FREE_MINUTES,
// dikenakan biaya tambahan DISPUTE_FEE_PERCENT dari order.amount.
// Fee ini masuk ke wallet moderator/admin yang menangani.
// Fee platform website (MARKETPLACE_FEE_PERCENT) tetap berjalan normal.
export const DISPUTE_FREE_MINUTES = Number(process.env.DISPUTE_FREE_MINUTES) || 30
export const DISPUTE_FEE_PERCENT  = Number(process.env.DISPUTE_FEE_PERCENT)  || 2
// Siapa yang menanggung biaya moderasi: 'loser' (pihak yang kalah), 'buyer', 'seller', 'split'
export const DISPUTE_FEE_PAYER    = process.env.DISPUTE_FEE_PAYER || 'loser'

export const ORDER_STATUS = {
  ESCROW_ACTIVE: 'escrow_active',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
}

export const ESCROW_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED',
  DISPUTED: 'DISPUTED',
}

export const PAYMENT_STATUS = {
  WAITING: 'waiting',
  PAID: 'paid',
  EXPIRED: 'expired',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

export const WITHDRAW_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
}

export const DISPUTE_STATUS = {
  OPEN: 'open',
  IN_REVIEW: 'in_review',
  RESOLVED: 'resolved',
}

export const DISPUTE_REASONS = [
  'hackback',
  'wrong_account',
  'banned_account',
  'recovery_issue',
  'description_mismatch',
  'seller_inactive',
]

export const DEPOSIT_METHODS = ['qris', 'gopay', 'dana']
export const WITHDRAW_METHODS = ['gopay', 'dana', 'ovo', 'shopeepay', 'bank']

export const WALLET_TX_TYPES = [
  'deposit',
  'purchase',
  'escrow_release',
  'escrow_refund',
  'withdraw',
  'withdraw_refund',
  'fee',
  'freeze',
  'unfreeze',
  'adjustment',
  'dispute_moderation_fee',   // biaya moderasi dispute (dicharge ke pihak yang kalah)
  'dispute_moderation_earn',  // pendapatan moderasi dispute (masuk wallet mod/admin)
]
