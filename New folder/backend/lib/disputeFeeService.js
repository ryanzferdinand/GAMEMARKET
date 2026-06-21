/**
 * disputeFeeService.js
 *
 * Menghitung dan memproses biaya moderasi dispute.
 *
 * LOGIKA:
 *  - Jika total waktu moderator aktif di dalam dispute chat >= DISPUTE_FREE_MINUTES → GRATIS
 *  - Jika melebihi batas gratis → biaya = order.amount × DISPUTE_FEE_PERCENT%
 *  - Biaya diambil dari pihak yang kalah (buyer/seller/split) sesuai DISPUTE_FEE_PAYER
 *  - Biaya dikreditkan ke wallet moderator/admin yang menangani
 *  - Fee platform website (MARKETPLACE_FEE_PERCENT%) tetap berjalan normal, tidak diganggu
 */

import Dispute from '../models/Dispute.js'
import Order from '../models/Order.js'
import {
  DISPUTE_FREE_MINUTES,
  DISPUTE_FEE_PERCENT,
  DISPUTE_FEE_PAYER,
} from './marketplaceConstants.js'
import { getOrCreateWallet, creditAvailable, debitAvailable } from './walletService.js'
import WalletTransaction from '../models/WalletTransaction.js'
import { notify } from './notify.js'

// ─────────────────────────────────────────────────────────────────────────────
// SESSION TRACKING — dipanggil saat moderator join/leave dispute chat room
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Catat waktu moderator masuk ke sesi dispute.
 * Dipanggil saat moderator join room order:disputeId atau akses chat dispute.
 */
export async function startModeratorSession(disputeId, moderatorId) {
  const dispute = await Dispute.findById(disputeId)
  if (!dispute) return

  // Jika sudah ada sesi yang belum ditutup dari mod yang sama, jangan buat duplikat
  const openSession = dispute.moderatorSessions.find(
    (s) => s.moderatorId?.toString() === moderatorId.toString() && !s.leftAt,
  )
  if (openSession) return dispute

  dispute.moderatorSessions.push({
    moderatorId,
    joinedAt: new Date(),
  })
  dispute.lastModeratorActivity = new Date()
  await dispute.save()
  return dispute
}

/**
 * Catat waktu moderator keluar dari sesi dispute.
 * Hitung durationMinutes untuk sesi tersebut.
 */
export async function endModeratorSession(disputeId, moderatorId) {
  const dispute = await Dispute.findById(disputeId)
  if (!dispute) return

  const now = new Date()

  // Tutup semua sesi terbuka milik moderator ini
  let changed = false
  for (const session of dispute.moderatorSessions) {
    if (session.moderatorId?.toString() === moderatorId.toString() && !session.leftAt) {
      session.leftAt = now
      const ms = now - new Date(session.joinedAt)
      session.durationMinutes = Math.round(ms / 60000)
      changed = true
    }
  }

  if (changed) {
    await dispute.save()
  }
  return dispute
}

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATE — hitung total menit dan apakah perlu dicharge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hitung total waktu aktif moderator dari semua sesi.
 * Sesi yang belum ditutup (leftAt = null) dihitung sampai sekarang.
 */
export function calcTotalModeratorMinutes(dispute) {
  const now = Date.now()
  let totalMs = 0

  for (const session of dispute.moderatorSessions || []) {
    const start = session.joinedAt ? new Date(session.joinedAt).getTime() : null
    if (!start) continue
    const end = session.leftAt ? new Date(session.leftAt).getTime() : now
    totalMs += Math.max(0, end - start)
  }

  return Math.round(totalMs / 60000)
}

/**
 * Hitung apakah dicharge dan berapa jumlahnya.
 * Mengembalikan objek { shouldCharge, feeAmount, totalMinutes, freeMinutes, feePercent }
 */
export function calcModerationFee(dispute, orderAmount) {
  const totalMinutes = calcTotalModeratorMinutes(dispute)
  const freeMinutes  = DISPUTE_FREE_MINUTES
  const feePercent   = DISPUTE_FEE_PERCENT

  if (totalMinutes <= freeMinutes) {
    return {
      shouldCharge: false,
      feeAmount: 0,
      totalMinutes,
      freeMinutes,
      feePercent,
    }
  }

  const feeAmount = Math.round(orderAmount * (feePercent / 100))

  return {
    shouldCharge: true,
    feeAmount,
    totalMinutes,
    freeMinutes,
    feePercent,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARGE — eksekusi transfer fee, dipanggil saat dispute resolve
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Proses moderation fee setelah dispute diselesaikan.
 *
 * @param {object} params
 * @param {string} params.disputeId
 * @param {string} params.winner         - 'buyer' | 'seller'
 * @param {string} params.moderatorId    - ID mod/admin yang menyelesaikan
 * @param {object} params.io             - socket.io instance (untuk emit)
 * @returns {object} hasil kalkulasi dan status charge
 */
export async function processModerationFee({ disputeId, winner, moderatorId, io }) {
  const dispute = await Dispute.findById(disputeId).populate('order')
  if (!dispute) throw new Error('Dispute tidak ditemukan')

  const order = dispute.order?._id
    ? dispute.order
    : await Order.findById(dispute.order)
  if (!order) throw new Error('Order tidak ditemukan')

  // Tutup semua sesi terbuka terlebih dahulu
  const now = new Date()
  let sessionClosed = false
  for (const session of dispute.moderatorSessions) {
    if (!session.leftAt) {
      session.leftAt = now
      const ms = now - new Date(session.joinedAt)
      session.durationMinutes = Math.round(ms / 60000)
      sessionClosed = true
    }
  }
  if (sessionClosed) await dispute.save()

  // Hitung total waktu dan fee
  const { shouldCharge, feeAmount, totalMinutes, freeMinutes, feePercent } =
    calcModerationFee(dispute, order.amount)

  // Update total menit di dispute
  dispute.totalModeratorMinutes = totalMinutes

  if (!shouldCharge || feeAmount <= 0) {
    // Waktu kurang dari batas gratis — tidak dicharge
    dispute.moderationFee = {
      charged: false,
      feeAmount: 0,
      freeMinutes,
      actualMinutes: totalMinutes,
      feePercent,
      paidBy: 'none',
      moderatorId,
    }
    await dispute.save()
    return { charged: false, feeAmount: 0, totalMinutes, freeMinutes, reason: 'under_free_threshold' }
  }

  // Tentukan siapa yang bayar
  const payer = resolvePayer(winner)

  // Tentukan userId yang membayar
  let payerIds = []
  if (payer === 'buyer') {
    payerIds = [{ userId: dispute.buyer.toString(), amount: feeAmount }]
  } else if (payer === 'seller') {
    payerIds = [{ userId: dispute.seller.toString(), amount: feeAmount }]
  } else if (payer === 'split') {
    // Split 50/50, masing-masing setengah (round ke atas untuk sisi pertama)
    const half = Math.floor(feeAmount / 2)
    const remainder = feeAmount - half * 2
    payerIds = [
      { userId: dispute.buyer.toString(),  amount: half + remainder },
      { userId: dispute.seller.toString(), amount: half },
    ]
  }

  let totalCharged = 0
  const chargeResults = []

  for (const { userId, amount } of payerIds) {
    if (amount <= 0) continue
    try {
      // Cek apakah wallet punya cukup saldo (available atau pending)
      const wallet = await getOrCreateWallet(userId)
      const totalBalance = wallet.availableBalance + wallet.pendingBalance

      if (totalBalance < amount) {
        // Saldo tidak cukup — charge sebisanya atau skip
        const chargeableAmount = Math.min(wallet.availableBalance, amount)
        if (chargeableAmount > 0) {
          await debitAvailable(
            userId,
            chargeableAmount,
            'dispute_moderation_fee',
            'Dispute',
            dispute._id,
            `Biaya moderasi dispute — ${totalMinutes} menit (>${freeMinutes} menit gratis)`,
            { disputeId: dispute._id, orderNumber: order.orderNumber, feePercent, totalMinutes },
          )
          totalCharged += chargeableAmount
          chargeResults.push({ userId, charged: chargeableAmount, partial: true })
        }
      } else {
        await debitAvailable(
          userId,
          amount,
          'dispute_moderation_fee',
          'Dispute',
          dispute._id,
          `Biaya moderasi dispute — ${totalMinutes} menit (>${freeMinutes} menit gratis)`,
          { disputeId: dispute._id, orderNumber: order.orderNumber, feePercent, totalMinutes },
        )
        totalCharged += amount
        chargeResults.push({ userId, charged: amount, partial: false })
      }
    } catch (err) {
      // Catat gagal tapi jangan batalkan resolusi dispute
      chargeResults.push({ userId, charged: 0, partial: false, error: err.message })
    }
  }

  // Kreditkan total yang berhasil dikumpulkan ke wallet moderator/admin
  if (totalCharged > 0 && moderatorId) {
    await creditAvailable(
      moderatorId,
      totalCharged,
      'dispute_moderation_earn',
      'Dispute',
      dispute._id,
      `Pendapatan moderasi dispute ${order.orderNumber} — ${totalMinutes} menit`,
      { disputeId: dispute._id, orderNumber: order.orderNumber, feePercent, totalMinutes, payer },
    )

    if (io) {
      io.to(`user:${moderatorId.toString()}`).emit('wallet:updated', {
        userId: moderatorId.toString(),
      })
    }

    // Notifikasi ke moderator
    await notify(io, {
      recipient: moderatorId,
      actor: moderatorId,
      type: 'moderation_fee_earned',
      title: 'Fee moderasi diterima',
      body: `Rp${totalCharged.toLocaleString('id-ID')} masuk wallet — dispute ${order.orderNumber} (${totalMinutes} menit)`,
      link: `/orders/${order._id}`,
      meta: { disputeId: dispute._id, feeAmount: totalCharged, totalMinutes },
    })
  }

  // Notifikasi ke pihak yang dicharge
  for (const { userId, charged } of chargeResults) {
    if (charged > 0 && io) {
      io.to(`user:${userId}`).emit('wallet:updated', { userId })
      await notify(io, {
        recipient: userId,
        actor: moderatorId,
        type: 'moderation_fee_charged',
        title: 'Biaya moderasi dispute',
        body: `Rp${charged.toLocaleString('id-ID')} dipotong — biaya moderasi ${totalMinutes} menit (>${freeMinutes} menit gratis)`,
        link: `/orders/${order._id}`,
        meta: { disputeId: dispute._id, feeAmount: charged, totalMinutes, freeMinutes },
      })
    }
  }

  // Simpan hasil ke dispute
  dispute.moderationFee = {
    charged: totalCharged > 0,
    feeAmount: totalCharged,
    freeMinutes,
    actualMinutes: totalMinutes,
    feePercent,
    paidBy: payer,
    moderatorId,
    chargedAt: new Date(),
  }
  await dispute.save()

  return {
    charged: totalCharged > 0,
    feeAmount: totalCharged,
    totalMinutes,
    freeMinutes,
    feePercent,
    payer,
    chargeResults,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tentukan siapa yang menanggung biaya berdasarkan config dan pemenang dispute.
 * 'loser' → pihak yang kalah dispute
 */
function resolvePayer(winner) {
  if (DISPUTE_FEE_PAYER === 'loser') {
    // Jika buyer menang → seller yang bayar, dan sebaliknya
    return winner === 'buyer' ? 'seller' : 'buyer'
  }
  // 'buyer', 'seller', 'split' — langsung dari config
  return DISPUTE_FEE_PAYER
}
