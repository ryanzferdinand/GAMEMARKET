/**
 * Dynamic Role Promotion System
 *
 * Roles (ascending trust):
 *   buyer → trusted_buyer → seller → trusted_seller (verified_badge) → [admin/mod — manual only]
 *
 * Promotion thresholds:
 *  seller        → trusted_seller  : ≥10 completed orders + avg rating ≥4.0 + ≥5 reviews
 *  trusted_seller (verifiedBadge)  : ≥30 completed orders + avg rating ≥4.5 + ≥20 reviews
 *
 * Demotion thresholds (dispute / cancellation guard):
 *  trusted_seller → seller         : dispute rate >20% (over last 50 orders) OR avg drops <3.5
 */

import User from '../models/User.js'
import SellerProfile from '../models/SellerProfile.js'
import { notify } from './notify.js'

// Thresholds — tweak via env for easy tuning
const TRUSTED_SELLER_ORDERS  = Number(process.env.TRUSTED_SELLER_ORDERS)  || 10
const TRUSTED_SELLER_RATING  = Number(process.env.TRUSTED_SELLER_RATING)  || 4.0
const TRUSTED_SELLER_REVIEWS = Number(process.env.TRUSTED_SELLER_REVIEWS) || 5

const VERIFIED_BADGE_ORDERS  = Number(process.env.VERIFIED_BADGE_ORDERS)  || 30
const VERIFIED_BADGE_RATING  = Number(process.env.VERIFIED_BADGE_RATING)  || 4.5
const VERIFIED_BADGE_REVIEWS = Number(process.env.VERIFIED_BADGE_REVIEWS) || 20

const DEMOTE_DISPUTE_RATE    = Number(process.env.DEMOTE_DISPUTE_RATE)    || 20  // percent
const DEMOTE_MIN_RATING      = Number(process.env.DEMOTE_MIN_RATING)      || 3.5

// Roles that can be promoted/demoted automatically (never touch admin/mod/supervisor)
const PROMOTABLE_ROLES = ['seller', 'trusted_seller']
const STAFF_ROLES = ['admin', 'moderator', 'supervisor']

/**
 * Evaluate and apply role promotion / demotion for a seller after a significant event
 * (order completed, review submitted, etc.)
 *
 * @param {string|ObjectId} userId
 * @param {object} [io]   - Socket.IO server instance for real-time updates
 * @returns {{ promoted: boolean, demoted: boolean, newRole: string, verifiedBadge: boolean }}
 */
export async function evaluateRolePromotion(userId, io = null) {
  const user = await User.findById(userId)
  if (!user) return { promoted: false, demoted: false }

  // Never touch staff roles
  if (STAFF_ROLES.includes(user.role)) {
    return { promoted: false, demoted: false, newRole: user.role, verifiedBadge: user.verified }
  }

  // Only auto-promote/demote users who are sellers
  if (!PROMOTABLE_ROLES.includes(user.role)) {
    return { promoted: false, demoted: false, newRole: user.role, verifiedBadge: user.verified }
  }

  const profile = await SellerProfile.findOne({ user: userId })
  if (!profile) return { promoted: false, demoted: false, newRole: user.role, verifiedBadge: user.verified }

  const { completedOrders, disputedOrders, totalOrders } = profile
  const { rating, ratingCount } = user

  const disputeRate = totalOrders > 0 ? (disputedOrders / totalOrders) * 100 : 0

  let newRole = user.role
  let newVerified = user.verified
  let promoted = false
  let demoted = false

  if (user.role === 'seller') {
    // Check promotion to trusted_seller
    if (
      completedOrders >= TRUSTED_SELLER_ORDERS &&
      rating >= TRUSTED_SELLER_RATING &&
      ratingCount >= TRUSTED_SELLER_REVIEWS
    ) {
      newRole = 'trusted_seller'
      promoted = true
    }
  } else if (user.role === 'trusted_seller') {
    // Check demotion back to seller
    if (
      (disputeRate > DEMOTE_DISPUTE_RATE && totalOrders >= 10) ||
      (rating < DEMOTE_MIN_RATING && ratingCount >= 5)
    ) {
      newRole = 'seller'
      newVerified = false
      demoted = true
    }
  }

  // Check verified badge (applies to trusted_seller regardless of demotion check above)
  if (newRole === 'trusted_seller') {
    const earnsBadge =
      completedOrders >= VERIFIED_BADGE_ORDERS &&
      rating >= VERIFIED_BADGE_RATING &&
      ratingCount >= VERIFIED_BADGE_REVIEWS

    if (earnsBadge && !user.verified) {
      newVerified = true
      // Only flag promoted if it's purely the badge being added (no role change already)
      if (!promoted) promoted = true
    } else if (!earnsBadge && user.verified && user.role === 'trusted_seller' && !demoted) {
      // Rating dropped below badge threshold — remove badge but keep role
      newVerified = false
    }
  }

  // Persist changes only if something actually changed
  const roleChanged = newRole !== user.role
  const badgeChanged = newVerified !== user.verified

  if (roleChanged || badgeChanged) {
    await User.findByIdAndUpdate(userId, { role: newRole, verified: newVerified })

    // Emit real-time event so the frontend updates immediately
    io?.to(`user:${userId.toString()}`).emit('user:role-updated', {
      userId: userId.toString(),
      role: newRole,
      verified: newVerified,
    })

    // Notify the user about the change
    const notifyTitle = demoted
      ? 'Status penjual diperbarui'
      : newVerified && !user.verified
      ? 'Selamat! Anda mendapat Verified Badge'
      : 'Selamat! Status Anda naik'

    const notifyBody = demoted
      ? `Status Anda berubah ke Seller karena tingkat dispute atau rating terlalu rendah.`
      : newRole === 'trusted_seller' && roleChanged
      ? `Selamat datang di Trusted Seller! Posting langsung tanpa persetujuan admin.`
      : newVerified && badgeChanged
      ? `Badge terverifikasi diberikan — terus jaga reputasi Anda!`
      : `Rating atau performa Anda berubah — status diperbarui.`

    await notify(io, {
      recipient: userId,
      actor: userId,
      type: demoted ? 'role_demoted' : 'role_promoted',
      title: notifyTitle,
      body: notifyBody,
      link: '/profile',
      meta: { oldRole: user.role, newRole, verifiedBadge: newVerified },
    })
  }

  return { promoted, demoted, newRole, verifiedBadge: newVerified, roleChanged, badgeChanged }
}
