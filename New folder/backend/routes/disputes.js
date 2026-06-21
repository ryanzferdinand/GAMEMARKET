import express from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, requireRole } from '../middleware/auth.js'
import Dispute from '../models/Dispute.js'
import Order from '../models/Order.js'
import OrderMessage from '../models/OrderMessage.js'
import { freezeEscrowForDispute, confirmOrder, refundOrder } from '../lib/escrowService.js'
import { assignModerator, claimDispute, getModeratorQueue } from '../lib/moderatorQueue.js'
import { createAuditLog } from '../lib/auditLog.js'
import { notify } from '../lib/notify.js'
import { DISPUTE_REASONS, DISPUTE_FREE_MINUTES, DISPUTE_FEE_PERCENT } from '../lib/marketplaceConstants.js'
import SellerProfile from '../models/SellerProfile.js'
import {
  startModeratorSession,
  endModeratorSession,
  processModerationFee,
  calcModerationFee,
  calcTotalModeratorMinutes,
} from '../lib/disputeFeeService.js'

const router = express.Router()

const disputeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  message: { message: 'Terlalu banyak permintaan buat dispute. Coba lagi dalam 15 menit.' },
})

router.use(authenticate)

// POST /api/disputes
router.post('/', disputeLimiter, async (req, res) => {
  try {
    const { orderId, reason, description } = req.body
    if (!orderId || !reason) {
      return res.status(400).json({ message: 'orderId dan reason wajib diisi' })
    }
    if (!DISPUTE_REASONS.includes(reason)) {
      return res.status(400).json({ message: 'Alasan dispute tidak valid' })
    }

    const order = await Order.findById(orderId)
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' })
    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Hanya pembeli yang bisa buka dispute' })
    }
    if (!['delivered'].includes(order.status)) {
      return res.status(400).json({ message: 'Dispute hanya bisa dibuka setelah penjual mengirim akun (status: delivered)' })
    }

    const existing = await Dispute.findOne({ order: orderId })
    if (existing) return res.status(409).json({ message: 'Dispute sudah ada' })

    await freezeEscrowForDispute(orderId)

    const dispute = await Dispute.create({
      order: orderId,
      buyer: order.buyer,
      seller: order.seller,
      reason,
      description,
    })

    order.dispute = dispute._id
    await order.save()

    await SellerProfile.findOneAndUpdate(
      { user: order.seller },
      { $inc: { disputedOrders: 1 } },
      { upsert: true },
    )

    await assignModerator(dispute._id)

    await notify(req.io, {
      recipient: order.seller,
      actor: req.user._id,
      type: 'dispute_opened',
      title: 'Dispute dibuka',
      body: `Pembeli membuka dispute untuk order ${order.orderNumber}`,
      link: `/orders/${order._id}`,
      meta: { disputeId: dispute._id },
    })

    res.status(201).json({ dispute })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// GET /api/disputes
router.get('/', async (req, res) => {
  try {
    let query = {}
    if (['admin', 'moderator', 'supervisor'].includes(req.user.role)) {
      if (req.query.queue === 'true') {
        const queue = await getModeratorQueue()
        return res.json({ disputes: queue })
      }
    } else {
      query = { $or: [{ buyer: req.user._id }, { seller: req.user._id }] }
    }

    const disputes = await Dispute.find(query)
      .sort({ createdAt: -1 })
      .populate('buyer seller moderator', 'username avatar')
      .populate('order', 'orderNumber amount status')

    res.json({ disputes })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/disputes/:id/claim
router.post('/:id/claim', requireRole('admin', 'moderator', 'supervisor'), async (req, res) => {
  try {
    const dispute = await claimDispute(req.params.id, req.user._id)
    dispute.lastModeratorActivity = new Date()
    await dispute.save()

    // Mulai catat sesi waktu moderator
    await startModeratorSession(req.params.id, req.user._id)

    res.json({ dispute })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// POST /api/disputes/:id/resolve
router.post('/:id/resolve', requireRole('admin', 'moderator', 'supervisor'), async (req, res) => {
  try {
    const { winner, note } = req.body
    if (!['buyer', 'seller'].includes(winner)) {
      return res.status(400).json({ message: 'winner harus buyer atau seller' })
    }

    const dispute = await Dispute.findById(req.params.id)
    if (!dispute) return res.status(404).json({ message: 'Dispute tidak ditemukan' })

    if (dispute.claimedBy && dispute.claimedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Dispute diklaim moderator lain' })
    }

    const order = await Order.findById(dispute.order)
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' })

    // ── Proses moderation fee sebelum resolve escrow ─────────────────────────
    // Tutup sesi moderator yang masih terbuka lalu charge jika melebihi batas gratis.
    // Platform fee (MARKETPLACE_FEE_PERCENT) tetap berjalan normal di confirmOrder/refundOrder.
    const feeResult = await processModerationFee({
      disputeId: dispute._id,
      winner,
      moderatorId: req.user._id,
      io: req.io,
    })

    // ── Selesaikan escrow ─────────────────────────────────────────────────────
    if (winner === 'buyer') {
      await refundOrder({ orderId: order._id, reason: note, io: req.io })
    } else {
      await confirmOrder({ orderId: order._id, buyerId: order.buyer, io: req.io })
    }

    dispute.status = 'resolved'
    dispute.resolution = { winner, note, resolvedBy: req.user._id, resolvedAt: new Date() }
    dispute.lastModeratorActivity = new Date()
    await dispute.save()

    await createAuditLog({
      actor: req.user._id,
      action: 'dispute_resolved',
      targetType: 'Dispute',
      targetId: dispute._id,
      reason: note,
      meta: {
        winner,
        moderationFee: feeResult,
      },
      ipAddress: req.ip,
    })

    await notify(req.io, {
      recipient: winner === 'buyer' ? order.buyer : order.seller,
      actor: req.user._id,
      type: 'dispute_resolved',
      title: 'Dispute selesai',
      body: `Keputusan: ${winner === 'buyer' ? 'Pembeli menang' : 'Penjual menang'}`,
      link: `/orders/${order._id}`,
    })

    res.json({ dispute, order, moderationFee: feeResult })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// GET /api/disputes/:id/messages — access order chat during dispute
router.get('/:id/messages', requireRole('admin', 'moderator', 'supervisor'), async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
    if (!dispute) return res.status(404).json({ message: 'Dispute tidak ditemukan' })

    await createAuditLog({
      actor: req.user._id,
      action: 'dispute_chat_access',
      targetType: 'Dispute',
      targetId: dispute._id,
      reason: 'moderator_review',
      ipAddress: req.ip,
    })

    dispute.lastModeratorActivity = new Date()
    await dispute.save()

    // Catat sesi masuk moderator jika belum ada sesi terbuka
    await startModeratorSession(req.params.id, req.user._id)

    const messages = await OrderMessage.find({ order: dispute.order })
      .sort({ createdAt: 1 })
      .populate('sender', 'username avatar role')

    // Sertakan info sesi & fee preview agar frontend bisa tampilkan warning
    const totalMinutes = calcTotalModeratorMinutes(dispute)
    const order = await Order.findById(dispute.order).select('amount')
    const feePreview = order ? calcModerationFee(dispute, order.amount) : null

    res.json({
      messages,
      sessionInfo: {
        totalMinutes,
        freeMinutes: DISPUTE_FREE_MINUTES,
        feePercent: DISPUTE_FEE_PERCENT,
        willBeCharged: feePreview?.shouldCharge ?? false,
        estimatedFee: feePreview?.feeAmount ?? 0,
      },
    })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/disputes/:id/session/leave — moderator keluar dari sesi chat
// Dipanggil dari frontend saat meninggalkan halaman dispute (beforeunload / cleanup)
router.post('/:id/session/leave', requireRole('admin', 'moderator', 'supervisor'), async (req, res) => {
  try {
    await endModeratorSession(req.params.id, req.user._id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/disputes/:id/session — info sesi aktif & estimasi fee (untuk moderator)
router.get('/:id/session', requireRole('admin', 'moderator', 'supervisor'), async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
    if (!dispute) return res.status(404).json({ message: 'Dispute tidak ditemukan' })

    const order = await Order.findById(dispute.order).select('amount orderNumber')
    const totalMinutes = calcTotalModeratorMinutes(dispute)
    const feePreview = order ? calcModerationFee(dispute, order.amount) : null

    res.json({
      totalMinutes,
      freeMinutes: DISPUTE_FREE_MINUTES,
      feePercent: DISPUTE_FEE_PERCENT,
      willBeCharged: feePreview?.shouldCharge ?? false,
      estimatedFee: feePreview?.feeAmount ?? 0,
      moderationFee: dispute.moderationFee,
      sessions: dispute.moderatorSessions,
    })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

export default router
