import Order from '../models/Order.js'
import Escrow from '../models/Escrow.js'
import Post from '../models/Post.js'
import SellerProfile from '../models/SellerProfile.js'
import User from '../models/User.js'
import {
  MARKETPLACE_FEE_PERCENT,
  ORDER_STATUS,
  ESCROW_STATUS,
  AUTO_CONFIRM_HOURS,
} from './marketplaceConstants.js'
import {
  releasePendingToAvailable,
  getOrCreateWallet,
  debitAvailable,
  addSellerPending,
  creditAvailable,
} from './walletService.js'
import { notify } from './notify.js'
import WalletTransaction from '../models/WalletTransaction.js'
import { evaluateRolePromotion } from './rolePromotion.js'
import { encryptDelivery } from './deliveryCrypto.js'

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `GM-${ts}-${rand}`
}

function calcFee(amount) {
  const feeAmount = Math.round(amount * (MARKETPLACE_FEE_PERCENT / 100))
  const sellerAmount = amount - feeAmount
  return { feeAmount, sellerAmount }
}

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────
export async function createOrderPurchase({ buyerId, postId, io }) {
  const post = await Post.findById(postId)
  if (!post) throw new Error('Postingan tidak ditemukan')
  if (post.status !== 'approved') throw new Error('Postingan tidak tersedia')
  if (post.seller.toString() === buyerId.toString()) {
    throw new Error('Tidak bisa membeli postingan sendiri')
  }

  const activeOrder = await Order.findOne({
    post: postId,
    status: { $in: [ORDER_STATUS.ESCROW_ACTIVE, ORDER_STATUS.DELIVERED, ORDER_STATUS.DISPUTED] },
  })

  if (activeOrder) {
    if (activeOrder.buyer.toString() === buyerId.toString()) {
      const err = new Error('Anda sudah memiliki pesanan aktif untuk postingan ini')
      err.code = 'ACTIVE_ORDER_EXISTS'
      err.orderId = activeOrder._id
      throw err
    }
    throw new Error('Postingan sedang dalam transaksi')
  }

  const amount = post.price
  const { feeAmount, sellerAmount } = calcFee(amount)
  const orderNumber = generateOrderNumber()

  // Check balance before creating anything
  const wallet = await getOrCreateWallet(buyerId)
  if (wallet.availableBalance < amount) {
    throw new Error(
      `Saldo tidak mencukupi — butuh Rp${amount.toLocaleString('id-ID')}, tersedia Rp${wallet.availableBalance.toLocaleString('id-ID')}`,
    )
  }

  // Create order + escrow with manual rollback (standalone MongoDB has no sessions)
  let order = null
  let escrow = null

  try {
    order = await Order.create({
      orderNumber,
      post: postId,
      buyer: buyerId,
      seller: post.seller,
      amount,
      feeAmount,
      sellerAmount,
      status: ORDER_STATUS.ESCROW_ACTIVE,
    })

    escrow = await Escrow.create({
      order: order._id,
      buyer: buyerId,
      seller: post.seller,
      amount,
      feeAmount,
      sellerAmount,
      status: ESCROW_STATUS.ACTIVE,
    })

    order.escrow = escrow._id
    await order.save()

    // Debit buyer wallet
    await debitAvailable(
      buyerId,
      amount,
      'purchase',
      'Order',
      order._id,
      `Pembelian ${post.title}`,
      { postId: postId.toString(), orderNumber },
    )

    // Credit seller pending
    await addSellerPending(
      post.seller,
      sellerAmount,
      'Order',
      order._id,
      `Escrow order ${orderNumber}`,
    )
  } catch (err) {
    if (order?._id) {
      try {
        const debited = await WalletTransaction.findOne({
          user: buyerId,
          referenceType: 'Order',
          referenceId: order._id,
          type: 'purchase',
        })
        if (debited) {
          await creditAvailable(
            buyerId,
            amount,
            'adjustment',
            'Order',
            order._id,
            'Rollback pembelian gagal',
          )
        }
        const pendingTx = await WalletTransaction.findOne({
          user: post.seller,
          referenceType: 'Order',
          referenceId: order._id,
          type: 'escrow_release',
        })
        if (pendingTx) {
          await import('../models/Wallet.js').then(({ default: Wallet }) =>
            Wallet.findOneAndUpdate(
              { user: post.seller, pendingBalance: { $gte: sellerAmount } },
              { $inc: { pendingBalance: -sellerAmount } },
            ),
          )
        }
      } catch {}
      if (escrow?._id) await Escrow.findByIdAndDelete(escrow._id).catch(() => {})
      await Order.findByIdAndDelete(order._id).catch(() => {})
    }
    throw err
  }

  await SellerProfile.findOneAndUpdate(
    { user: post.seller },
    { $inc: { totalOrders: 1 } },
    { upsert: true },
  )

  const populated = await Order.findById(order._id)
    .populate('post', 'title price images')
    .populate('buyer seller', 'username avatar role')

  // Emit order updated event
  if (io) {
    io.to(`user:${buyerId.toString()}`).emit('order:updated', { orderId: order._id.toString() })
    io.to(`user:${post.seller.toString()}`).emit('order:updated', { orderId: order._id.toString() })
    io.to(`order:${order._id.toString()}`).emit('order:updated', { orderId: order._id.toString() })
  }

  await notify(io, {
    recipient: post.seller,
    actor: buyerId,
    type: 'escrow_active',
    title: 'Pesanan baru',
    body: `Pembeli membeli "${post.title}" — escrow aktif`,
    link: `/orders/${order._id}`,
    meta: { orderId: order._id },
  })

  return populated
}

// ─────────────────────────────────────────────
// DELIVER
// ─────────────────────────────────────────────
export async function deliverOrder({ orderId, sellerId, delivery, io }) {
  const order = await Order.findById(orderId).populate('post', 'title')
  if (!order) throw new Error('Pesanan tidak ditemukan')
  if (order.seller.toString() !== sellerId.toString()) throw new Error('Akses ditolak')
  if (order.status !== ORDER_STATUS.ESCROW_ACTIVE) throw new Error('Pesanan tidak bisa dikirim')

  order.delivery = encryptDelivery({ ...delivery, deliveredAt: new Date() })
  order.status = ORDER_STATUS.DELIVERED
  order.buyerCheckDeadline = new Date(Date.now() + AUTO_CONFIRM_HOURS * 60 * 60 * 1000)
  await order.save()

  // Emit order updated event
  if (io) {
    io.to(`user:${order.buyer.toString()}`).emit('order:updated', { orderId: order._id.toString() })
    io.to(`user:${order.seller.toString()}`).emit('order:updated', { orderId: order._id.toString() })
    io.to(`order:${order._id.toString()}`).emit('order:updated', { orderId: order._id.toString() })
  }

  await notify(io, {
    recipient: order.buyer,
    actor: sellerId,
    type: 'seller_delivered',
    title: 'Akun dikirim',
    body: `Penjual mengirim akun untuk "${order.post?.title}" — konfirmasi dalam ${AUTO_CONFIRM_HOURS} jam`,
    link: `/orders/${order._id}`,
    meta: { orderId: order._id, deadline: order.buyerCheckDeadline },
  })

  return order
}

// ─────────────────────────────────────────────
// CONFIRM (buyer confirms receipt → releases escrow)
// ─────────────────────────────────────────────
export async function confirmOrder({ orderId, buyerId, auto = false, io }) {
  const order = await Order.findById(orderId).populate('post', 'title')
  if (!order) throw new Error('Pesanan tidak ditemukan')
  if (order.buyer.toString() !== buyerId.toString() && !auto) throw new Error('Akses ditolak')
  if (order.status !== ORDER_STATUS.DELIVERED) {
    throw new Error(auto ? 'Pesanan belum siap dikonfirmasi otomatis' : 'Penjual belum mengirim akun')
  }

  const escrow = await Escrow.findById(order.escrow)
  if (!escrow || escrow.status !== ESCROW_STATUS.ACTIVE) throw new Error('Escrow tidak aktif')

  escrow.status = ESCROW_STATUS.COMPLETED
  escrow.completedAt = new Date()
  await escrow.save()

  await releasePendingToAvailable(
    order.seller,
    order.sellerAmount,
    order.sellerAmount,
    'Order',
    order._id,
    `Escrow selesai — order ${order.orderNumber}`,
  )

  // Platform fee ledger entry
  if (order.feeAmount > 0) {
    await WalletTransaction.create({
      wallet: null,
      user: order.buyer,
      type: 'fee',
      amount: order.feeAmount,
      referenceType: 'Order',
      referenceId: order._id,
      description: `Platform fee ${MARKETPLACE_FEE_PERCENT}% — order ${order.orderNumber}`,
      meta: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        sellerId: order.seller,
        buyerId: order.buyer,
        feePercent: MARKETPLACE_FEE_PERCENT,
      },
    })
  }

  order.status = ORDER_STATUS.COMPLETED
  order.confirmedAt = new Date()
  order.completedAt = new Date()
  order.autoConfirmed = auto
  await order.save()

  await Post.findByIdAndUpdate(order.post, { status: 'sold' })
  const updatedSeller = await User.findByIdAndUpdate(
    order.seller,
    { $inc: { totalSales: 1 } },
    { new: true },
  )

  await SellerProfile.findOneAndUpdate(
    { user: order.seller },
    { $inc: { completedOrders: 1, totalRevenue: order.sellerAmount } },
    { upsert: true },
  )

  evaluateRolePromotion(order.seller, io).catch(() => {})

  if (io) {
    io.to(`user:${order.seller}`).emit('seller:stats-updated', {
      sellerId: order.seller.toString(),
      totalSales: updatedSeller?.totalSales,
    })
    io.to(`user:${order.seller}`).emit('wallet:updated', { userId: order.seller.toString() })
    io.to(`user:${order.buyer}`).emit('wallet:updated', { userId: order.buyer.toString() })
    // Emit order updated event
    io.to(`user:${order.buyer.toString()}`).emit('order:updated', { orderId: order._id.toString() })
    io.to(`user:${order.seller.toString()}`).emit('order:updated', { orderId: order._id.toString() })
    io.to(`order:${order._id.toString()}`).emit('order:updated', { orderId: order._id.toString() })
  }

  await notify(io, {
    recipient: order.seller,
    actor: buyerId,
    type: auto ? 'auto_confirmed' : 'buyer_confirmed',
    title: auto ? 'Pesanan dikonfirmasi otomatis' : 'Pesanan dikonfirmasi',
    body: `"${order.post?.title}" selesai — Rp${order.sellerAmount.toLocaleString('id-ID')} masuk wallet`,
    link: `/orders/${order._id}`,
    meta: { orderId: order._id },
  })

  return order
}

// ─────────────────────────────────────────────
// REFUND  (admin / dispute resolution)
// ─────────────────────────────────────────────
export async function refundOrder({ orderId, reason, io }) {
  const order = await Order.findById(orderId).populate('post', 'title')
  if (!order) throw new Error('Pesanan tidak ditemukan')

  const escrow = await Escrow.findById(order.escrow)
  if (!escrow) throw new Error('Escrow tidak ditemukan')

  escrow.status = ESCROW_STATUS.REFUNDED
  escrow.refundedAt = new Date()
  await escrow.save()

  // Refund full amount to buyer
  const buyerWallet = await getOrCreateWallet(order.buyer)
  buyerWallet.availableBalance += order.amount
  await buyerWallet.save()

  await WalletTransaction.create({
    wallet: buyerWallet._id,
    user: order.buyer,
    type: 'escrow_refund',
    amount: order.amount,
    referenceType: 'Order',
    referenceId: order._id,
    description: reason || `Refund order ${order.orderNumber}`,
    meta: {},
  })

  // Remove seller's pending balance
  const sellerWallet = await getOrCreateWallet(order.seller)
  sellerWallet.pendingBalance = Math.max(0, sellerWallet.pendingBalance - order.sellerAmount)
  await sellerWallet.save()

  order.status = ORDER_STATUS.REFUNDED
  await order.save()

  if (io) {
    io.to(`user:${order.buyer}`).emit('wallet:updated', { userId: order.buyer.toString() })
    io.to(`user:${order.seller}`).emit('wallet:updated', { userId: order.seller.toString() })
    // Emit order updated event
    io.to(`user:${order.buyer.toString()}`).emit('order:updated', { orderId: order._id.toString() })
    io.to(`user:${order.seller.toString()}`).emit('order:updated', { orderId: order._id.toString() })
    io.to(`order:${order._id.toString()}`).emit('order:updated', { orderId: order._id.toString() })
  }

  await notify(io, {
    recipient: order.buyer,
    actor: order.seller,
    type: 'refund_success',
    title: 'Refund berhasil',
    body: `Rp${order.amount.toLocaleString('id-ID')} dikembalikan ke wallet`,
    link: `/orders/${order._id}`,
    meta: { orderId: order._id },
  })

  return order
}

// ─────────────────────────────────────────────
// CANCEL  (mutual — both parties must request)
// Flow: first caller sets cancelRequestedBy. Second caller (opposite side) finalises.
// Only allowed on escrow_active status (before delivery).
// ─────────────────────────────────────────────
export async function requestCancelOrder({ orderId, userId, reason, io }) {
  const order = await Order.findById(orderId).populate('post', 'title')
  if (!order) throw new Error('Pesanan tidak ditemukan')

  const buyerId  = order.buyer.toString()
  const sellerId = order.seller.toString()
  const uid      = userId.toString()

  if (uid !== buyerId && uid !== sellerId) throw new Error('Akses ditolak')

  // Can only cancel before delivery
  if (!['escrow_active'].includes(order.status)) {
    throw new Error('Pembatalan hanya tersedia saat escrow aktif (sebelum pengiriman)')
  }

  const existingRequest = order.cancelRequestedBy?.toString()

  if (existingRequest) {
    // Same side requested again — do nothing extra
    if (existingRequest === uid) {
      return { order, waiting: true, message: 'Permintaan batal sudah dikirim, menunggu konfirmasi pihak lain' }
    }

    // Other side accepts — execute cancellation + refund
    order.status = ORDER_STATUS.CANCELLED
    order.cancelledAt = new Date()
    order.cancelledBy = userId
    order.cancelReason = reason || 'Dibatalkan bersama'
    await order.save()

    // Refund buyer
    const buyerWallet = await getOrCreateWallet(order.buyer)
    buyerWallet.availableBalance += order.amount
    await buyerWallet.save()

    await WalletTransaction.create({
      wallet: buyerWallet._id,
      user: order.buyer,
      type: 'escrow_refund',
      amount: order.amount,
      referenceType: 'Order',
      referenceId: order._id,
      description: `Pembatalan order ${order.orderNumber}`,
      meta: {},
    })

    // Release seller pending
    const sellerWallet = await getOrCreateWallet(order.seller)
    sellerWallet.pendingBalance = Math.max(0, sellerWallet.pendingBalance - order.sellerAmount)
    await sellerWallet.save()

    // Update escrow
    const escrow = await Escrow.findById(order.escrow)
    if (escrow) {
      escrow.status = ESCROW_STATUS.REFUNDED
      escrow.refundedAt = new Date()
      await escrow.save()
    }

    if (io) {
      io.to(`user:${order.buyer}`).emit('wallet:updated', { userId: order.buyer.toString() })
      io.to(`user:${order.seller}`).emit('wallet:updated', { userId: order.seller.toString() })
      io.to(`order:${order._id}`).emit('order:cancelled', { orderId: order._id.toString() })
    }

    const otherParty = uid === buyerId ? order.seller : order.buyer
    await notify(io, {
      recipient: otherParty,
      actor: userId,
      type: 'order_cancelled',
      title: 'Pesanan dibatalkan',
      body: `Order ${order.orderNumber} dibatalkan — saldo dikembalikan`,
      link: `/orders/${order._id}`,
      meta: { orderId: order._id },
    })

    const populated = await Order.findById(order._id)
      .populate('post', 'title price images')
      .populate('buyer seller', 'username avatar role')
    return { order: populated, waiting: false, cancelled: true }
  }

  // First request — record who asked
  order.cancelRequestedBy = userId
  order.cancelReason = reason
  await order.save()

  const otherParty = uid === buyerId ? order.seller : order.buyer
  await notify(io, {
    recipient: otherParty,
    actor: userId,
    type: 'cancel_requested',
    title: 'Permintaan pembatalan',
    body: `${uid === buyerId ? 'Pembeli' : 'Penjual'} meminta pembatalan order ${order.orderNumber}`,
    link: `/orders/${order._id}`,
    meta: { orderId: order._id },
  })

  if (io) {
    io.to(`order:${order._id}`).emit('order:cancel-requested', {
      orderId: order._id.toString(),
      requestedBy: uid,
    })
  }

  return { order, waiting: true, message: 'Permintaan batal dikirim — menunggu persetujuan pihak lain' }
}

// ─────────────────────────────────────────────
// FREEZE ESCROW (for dispute)
// ─────────────────────────────────────────────
export async function freezeEscrowForDispute(orderId) {
  const order = await Order.findById(orderId)
  if (!order) throw new Error('Pesanan tidak ditemukan')

  const escrow = await Escrow.findById(order.escrow)
  if (!escrow) throw new Error('Escrow tidak ditemukan')

  escrow.status = ESCROW_STATUS.DISPUTED
  escrow.frozenAt = new Date()
  await escrow.save()

  order.status = ORDER_STATUS.DISPUTED
  await order.save()

  return order
}
