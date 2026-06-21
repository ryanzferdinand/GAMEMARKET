import express from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'
import Order from '../models/Order.js'
import OrderMessage from '../models/OrderMessage.js'
import Escrow from '../models/Escrow.js'
import User from '../models/User.js'
import Review from '../models/Review.js'
import Offer, { OFFER_STATUS } from '../models/Offer.js'
import {
  createOrderPurchase,
  deliverOrder,
  confirmOrder,
  requestCancelOrder,
} from '../lib/escrowService.js'
import { scanMessage } from '../lib/antiFraud.js'
import { createAuditLog } from '../lib/auditLog.js'
import { notify } from '../lib/notify.js'
import { resolveTaggedUsers } from '../lib/mentions.js'
import { recalculateSellerRating, emitRatingUpdate } from '../lib/ratings.js'
import { decryptDeliveryForClient } from '../lib/deliveryCrypto.js'

const router = express.Router()

async function notifyOrderMentions(io, { content, actor, orderId, messageId }) {
  const tagged = await resolveTaggedUsers(content, User, actor._id)
  const link = `/orders/${orderId}`
  const preview = content.trim().slice(0, 80)

  await Promise.all(
    tagged.map((user) =>
      notify(io, {
        recipient: user._id,
        actor: actor._id,
        type: 'order_mention',
        title: 'Anda ditag di pesanan',
        body: `${actor.username} menyebut Anda: "${preview}${content.length > 80 ? '…' : ''}"`,
        link,
        meta: { orderId, messageId, taggedUsername: user.username },
      })
    )
  )

  return tagged.map((u) => u._id)
}

// Only count successful purchases toward the limit — failed attempts (insufficient balance, etc.) don't penalize
const purchaseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skipFailedRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: { message: 'Terlalu banyak pembelian berhasil. Coba lagi dalam 1 menit.' },
})

router.use(authenticate)

function canAccessOrder(order, userId, userRole) {
  const uid = userId.toString()
  const buyerId = order.buyer?._id ? order.buyer._id.toString() : order.buyer?.toString()
  const sellerId = order.seller?._id ? order.seller._id.toString() : order.seller?.toString()
  if (buyerId === uid || sellerId === uid) return true
  if (['admin', 'moderator', 'supervisor'].includes(userRole) && order.status === 'disputed') return true
  return false
}

// POST /api/orders/purchase
router.post('/purchase', purchaseLimiter, async (req, res) => {
  try {
    const { postId } = req.body
    if (!postId) return res.status(400).json({ message: 'postId wajib diisi' })

    const order = await createOrderPurchase({
      buyerId: req.user._id,
      postId,
      io: req.io,
    })

    req.io?.to(`user:${req.user._id}`).emit('wallet:updated', { userId: req.user._id.toString() })

    res.status(201).json({ order })
  } catch (err) {
    if (err.code === 'ACTIVE_ORDER_EXISTS') {
      return res.status(409).json({
        message: err.message,
        orderId: err.orderId,
        code: err.code,
      })
    }
    console.error('Purchase error:', err.message)
    res.status(400).json({ message: err.message || 'Gagal membuat pesanan' })
  }
})

// GET /api/orders/active/:postId — check if user has active order on a post
router.get('/active/:postId', async (req, res) => {
  try {
    const order = await Order.findOne({
      post: req.params.postId,
      buyer: req.user._id,
      status: { $in: ['escrow_active', 'delivered', 'disputed'] },
    }).select('_id orderNumber status amount')

    res.json({ order: order || null })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const { role = 'buyer', status, page = 1, limit = 20 } = req.query
    const field = role === 'seller' ? 'seller' : 'buyer'
    const query = { [field]: req.user._id }
    if (status) query.status = status

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate('post', 'title price images gameCategory')
        .populate('buyer seller', 'username avatar role')
        .lean(), // PERF-004
      Order.countDocuments(query),
    ])

    res.json({ orders, total, page: Number(page) })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('post', 'title price images gameCategory description')
      .populate('buyer seller', 'username avatar role verified')
      .populate('dispute')
      .populate('review')

    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' })
    if (!canAccessOrder(order, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak' })
    }

    const escrow = order.escrow ? await Escrow.findById(order.escrow) : null

    if (['admin', 'moderator', 'supervisor'].includes(req.user.role) && order.status === 'disputed') {
      await createAuditLog({
        actor: req.user._id,
        action: 'order_chat_access',
        targetType: 'Order',
        targetId: order._id,
        reason: 'dispute_review',
        ipAddress: req.ip,
      })
    }

    const orderPayload = order.toObject()
    if (orderPayload.delivery) {
      orderPayload.delivery = decryptDeliveryForClient(orderPayload.delivery)
    }

    res.json({ order: orderPayload, escrow })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/orders/:id/deliver
router.post('/:id/deliver', async (req, res) => {
  try {
    const { email, password, recovery, notes, attachments } = req.body
    const order = await deliverOrder({
      orderId: req.params.id,
      sellerId: req.user._id,
      delivery: { email, password, recovery, notes, attachments: attachments || [] },
      io: req.io,
    })

    await OrderMessage.create({
      order: order._id,
      sender: req.user._id,
      content: `[DELIVERY]\nEmail: ${email || '-'}\nPassword: ${password ? '***' : '-'}\nRecovery: ${recovery || '-'}\nNotes: ${notes || '-'}`,
      isSystem: true,
    })

    const orderPayload = order.toObject()
    if (orderPayload.delivery) {
      orderPayload.delivery = decryptDeliveryForClient(orderPayload.delivery)
    }

    res.json({ order: orderPayload })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// POST /api/orders/:id/confirm
router.post('/:id/confirm', async (req, res) => {
  try {
    const order = await confirmOrder({
      orderId: req.params.id,
      buyerId: req.user._id,
      io: req.io,
    })
    res.json({ order })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// POST /api/orders/:id/cancel — mutual cancellation request
// First call: records who wants to cancel and notifies the other party.
// Second call (by the other party): finalises cancellation + refunds buyer.
router.post('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body
    const result = await requestCancelOrder({
      orderId: req.params.id,
      userId: req.user._id,
      reason,
      io: req.io,
    })
    res.json(result)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// GET /api/orders/:id/messages
router.get('/:id/messages', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' })
    if (!canAccessOrder(order, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak' })
    }

    const messages = await OrderMessage.find({ order: order._id })
      .sort({ createdAt: 1 })
      .populate('sender', 'username avatar role')

    res.json({ messages })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/orders/:id/messages
router.post('/:id/messages', async (req, res) => {
  try {
    const { content, imageUrl } = req.body
    if (!content?.trim() && !imageUrl) {
      return res.status(400).json({ message: 'Pesan tidak boleh kosong' })
    }

    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' })
    if (!canAccessOrder(order, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak' })
    }

    const scan = scanMessage(content || '')
    const taggedUsers = await notifyOrderMentions(req.io, {
      content: content || '',
      actor: req.user,
      orderId: order._id,
      messageId: null, // We don't have messageId yet, we'll update later
    })

    const message = await OrderMessage.create({
      order: order._id,
      sender: req.user._id,
      content: content?.trim() || '',
      imageUrl,
      fraudDetected: !scan.clean,
      fraudWarnings: scan.warnings,
      maskedContent: scan.clean ? undefined : scan.maskedContent,
      taggedUsers,
    })
    await message.populate('sender', 'username avatar role')

    // Update messageId in notifications if needed, but for now we're good
    const displayContent = scan.clean ? message.content : scan.maskedContent
    const msgPayload = { ...message.toObject(), content: displayContent }

    // Broadcast to OTHER participants in the order room (not the sender — they already
    // get the message from the HTTP response to avoid duplicates)
    const { onlineUsers } = await import('../socket/handlers.js')
    const senderSocketId = onlineUsers.get(req.user._id.toString())
    if (senderSocketId) {
      // Emit to the whole order room except the sender's socket
      req.io?.to(`order:${order._id}`).except(senderSocketId).emit('order:message', msgPayload)
    } else {
      // Sender is not connected via socket — safe to broadcast to the whole room
      req.io?.to(`order:${order._id}`).emit('order:message', msgPayload)
    }

    const recipient = order.buyer.toString() === req.user._id.toString() ? order.seller : order.buyer
    await notify(req.io, {
      recipient,
      actor: req.user._id,
      type: 'order_message',
      title: 'Pesan pesanan baru',
      body: displayContent?.slice(0, 80) || 'Gambar dikirim',
      link: `/orders/${order._id}`,
      meta: { orderId: order._id },
    })

    res.status(201).json({
      message: { ...message.toObject(), content: displayContent },
      warnings: scan.warnings,
    })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// POST /api/orders/:id/review
router.post('/:id/review', async (req, res) => {
  try {
    const { rating, comment } = req.body

    const order = await Order.findById(req.params.id).populate('post')
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' })
    
    // Only buyer can review
    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Hanya pembeli yang bisa menilai' })
    }
    
    // Order must be completed
    if (order.status !== 'completed') {
      return res.status(400).json({ message: 'Pesanan harus selesai terlebih dahulu' })
    }
    
    // Check if already reviewed
    if (order.review) {
      return res.status(400).json({ message: 'Anda sudah menilai pesanan ini' })
    }
    
    const numRating = Number(rating)
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: 'Rating harus 1-5' })
    }

    const review = await Review.create({
      reviewer: req.user._id,
      reviewee: order.seller,
      post: order.post._id,
      rating: numRating,
      comment: comment?.trim() || '',
    })
    await review.populate('reviewer', 'username avatar role')
    await review.populate('post', 'title images gameCategory')

    order.review = review._id
    await order.save()

    const stats = await recalculateSellerRating(order.seller)
    emitRatingUpdate(req.io, {
      userId: order.seller.toString(),
      username: order.seller.username,
      stats,
      review,
    })

    await notify(req.io, {
      recipient: order.seller,
      actor: req.user._id,
      type: 'new_review',
      title: 'Review baru untuk Anda',
      body: `${req.user.username} memberi rating ${numRating}/5${comment ? `: "${comment.slice(0, 50)}"` : ''}`,
      link: `/profile/${order.seller.username}`,
      meta: { rating: numRating, postId: order.post._id, stats },
    })

    res.status(201).json({ review, stats })
  } catch (err) {
    console.error('Review error:', err)
    res.status(400).json({ message: err.message })
  }
})

// Offer routes
// GET /api/orders/:id/offers
router.get('/:id/offers', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' })
    if (!canAccessOrder(order, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak' })
    }

    const offers = await Offer.find({ order: order._id })
      .sort({ createdAt: -1 })
      .populate('offeredBy', 'username avatar')
      .populate('offeredTo', 'username avatar')

    res.json({ offers })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/orders/:id/offers
router.post('/:id/offers', async (req, res) => {
  try {
    const { amount, message } = req.body
    const MAX_OFFER = 100_000_000 // 100 juta IDR
    if (!amount || amount <= 0 || amount > MAX_OFFER) {
      return res.status(400).json({ message: `Jumlah tawaran harus antara 1 dan Rp${MAX_OFFER.toLocaleString('id-ID')}` })
    }

    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' })
    if (!canAccessOrder(order, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak' })
    }

    // Only allow offers if order is still in escrow active
    if (order.status !== 'escrow_active') {
      return res.status(400).json({ message: 'Tawaran hanya bisa dibuat sebelum pengiriman' })
    }

    // Determine who is the recipient
    const isBuyer = order.buyer.toString() === req.user._id.toString()
    const offeredTo = isBuyer ? order.seller : order.buyer

    const offer = await Offer.create({
      order: order._id,
      offeredBy: req.user._id,
      offeredTo,
      amount,
      message: message?.trim()
    })

    await offer.populate('offeredBy', 'username avatar')
    await offer.populate('offeredTo', 'username avatar')

    // Emit offer event
    req.io?.to(`order:${order._id}`).emit('order:offer', { offer })

    // Notify the other party
    await notify(req.io, {
      recipient: offeredTo,
      actor: req.user._id,
      type: 'new_offer',
      title: 'Tawaran baru',
      body: `${req.user.username} menawarkan Rp${amount.toLocaleString('id-ID')}`,
      link: `/orders/${order._id}`,
      meta: { orderId: order._id, offerId: offer._id },
    })

    // Also add a system message to order chat
    await OrderMessage.create({
      order: order._id,
      sender: req.user._id,
      content: `[OFFER] Menawarkan Rp${amount.toLocaleString('id-ID')}${message ? `: ${message}` : ''}`,
      isSystem: true
    })

    res.status(201).json({ offer })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// POST /api/orders/:id/offers/:offerId/accept
router.post('/:id/offers/:offerId/accept', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' })
    if (!canAccessOrder(order, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak' })
    }

    const offer = await Offer.findOne({ _id: req.params.offerId, order: order._id })
    if (!offer) return res.status(404).json({ message: 'Tawaran tidak ditemukan' })
    if (offer.offeredTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Anda tidak bisa menerima tawaran ini' })
    }
    if (offer.status !== OFFER_STATUS.PENDING) {
      return res.status(400).json({ message: 'Tawaran sudah tidak aktif' })
    }

    // Update offer status
    offer.status = OFFER_STATUS.ACCEPTED
    await offer.save()
    await offer.populate('offeredBy', 'username avatar')
    await offer.populate('offeredTo', 'username avatar')

    // Emit event
    req.io?.to(`order:${order._id}`).emit('order:offer', { offer })

    // Notify
    await notify(req.io, {
      recipient: offer.offeredBy,
      actor: req.user._id,
      type: 'offer_accepted',
      title: 'Tawaran diterima',
      body: `${req.user.username} menerima tawaran Anda`,
      link: `/orders/${order._id}`,
      meta: { orderId: order._id, offerId: offer._id },
    })

    // Add system message
    await OrderMessage.create({
      order: order._id,
      sender: req.user._id,
      content: `[OFFER ACCEPTED] Menerima tawaran Rp${offer.amount.toLocaleString('id-ID')}`,
      isSystem: true
    })

    res.json({ offer })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// POST /api/orders/:id/offers/:offerId/reject
router.post('/:id/offers/:offerId/reject', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' })
    if (!canAccessOrder(order, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak' })
    }

    const offer = await Offer.findOne({ _id: req.params.offerId, order: order._id })
    if (!offer) return res.status(404).json({ message: 'Tawaran tidak ditemukan' })
    if (offer.offeredTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Anda tidak bisa menolak tawaran ini' })
    }
    if (offer.status !== OFFER_STATUS.PENDING) {
      return res.status(400).json({ message: 'Tawaran sudah tidak aktif' })
    }

    offer.status = OFFER_STATUS.REJECTED
    await offer.save()
    await offer.populate('offeredBy', 'username avatar')
    await offer.populate('offeredTo', 'username avatar')

    req.io?.to(`order:${order._id}`).emit('order:offer', { offer })

    await notify(req.io, {
      recipient: offer.offeredBy,
      actor: req.user._id,
      type: 'offer_rejected',
      title: 'Tawaran ditolak',
      body: `${req.user.username} menolak tawaran Anda`,
      link: `/orders/${order._id}`,
      meta: { orderId: order._id, offerId: offer._id },
    })

    await OrderMessage.create({
      order: order._id,
      sender: req.user._id,
      content: `[OFFER REJECTED] Menolak tawaran Rp${offer.amount.toLocaleString('id-ID')}`,
      isSystem: true
    })

    res.json({ offer })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// POST /api/orders/:id/offers/:offerId/cancel
router.post('/:id/offers/:offerId/cancel', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' })
    if (!canAccessOrder(order, req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak' })
    }

    const offer = await Offer.findOne({ _id: req.params.offerId, order: order._id })
    if (!offer) return res.status(404).json({ message: 'Tawaran tidak ditemukan' })
    if (offer.offeredBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Anda tidak bisa membatalkan tawaran ini' })
    }
    if (offer.status !== OFFER_STATUS.PENDING) {
      return res.status(400).json({ message: 'Tawaran sudah tidak aktif' })
    }

    offer.status = OFFER_STATUS.CANCELLED
    await offer.save()
    await offer.populate('offeredBy', 'username avatar')
    await offer.populate('offeredTo', 'username avatar')

    req.io?.to(`order:${order._id}`).emit('order:offer', { offer })

    await notify(req.io, {
      recipient: offer.offeredTo,
      actor: req.user._id,
      type: 'offer_cancelled',
      title: 'Tawaran dibatalkan',
      body: `${req.user.username} membatalkan tawarannya`,
      link: `/orders/${order._id}`,
      meta: { orderId: order._id, offerId: offer._id },
    })

    await OrderMessage.create({
      order: order._id,
      sender: req.user._id,
      content: `[OFFER CANCELLED] Membatalkan tawaran Rp${offer.amount.toLocaleString('id-ID')}`,
      isSystem: true
    })

    res.json({ offer })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

export default router
