import express from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import Wallet from '../models/Wallet.js'
import Escrow from '../models/Escrow.js'
import Withdraw from '../models/Withdraw.js'
import Dispute from '../models/Dispute.js'
import Order from '../models/Order.js'
import AuditLog from '../models/AuditLog.js'
import WalletTransaction from '../models/WalletTransaction.js'
import User from '../models/User.js'
import { creditAvailable } from '../lib/walletService.js'
import { notify } from '../lib/notify.js'
import { MARKETPLACE_FEE_PERCENT } from '../lib/marketplaceConstants.js'

const router = express.Router()
router.use(authenticate, requireRole('admin', 'moderator', 'supervisor'))

// GET /api/marketplace-admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      walletAgg,
      escrowAgg,
      pendingWithdraws,
      activeDisputes,
      totalOrders,
      completedOrders,
      feeTxRevenue,
      orderFeeRevenue,
    ] = await Promise.all([
      User.countDocuments(),
      Wallet.aggregate([
        {
          $group: {
            _id: null,
            available: { $sum: '$availableBalance' },
            pending: { $sum: '$pendingBalance' },
            frozen: { $sum: '$frozenBalance' },
          },
        },
      ]),
      Escrow.aggregate([
        { $match: { status: 'ACTIVE' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Withdraw.countDocuments({ status: 'pending' }),
      Dispute.countDocuments({ status: { $in: ['open', 'in_review'] } }),
      Order.countDocuments(),
      Order.countDocuments({ status: 'completed' }),
      WalletTransaction.aggregate([
        { $match: { type: 'fee' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Order.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$feeAmount' } } },
      ]),
    ])

    const wallets = walletAgg[0] || { available: 0, pending: 0, frozen: 0 }
    const revenueFromOrders = orderFeeRevenue[0]?.total
    const revenueFromTx = feeTxRevenue[0]?.total

    res.json({
      totalUsers,
      totalWalletBalance: wallets.available + wallets.pending + wallets.frozen,
      availableBalance: wallets.available,
      pendingBalance: wallets.pending,
      frozenBalance: wallets.frozen,
      totalEscrow: escrowAgg[0]?.total || 0,
      totalRevenue: revenueFromOrders || revenueFromTx || 0,
      marketplaceFeePercent: MARKETPLACE_FEE_PERCENT,
      pendingWithdraws,
      activeDisputes,
      totalOrders,
      completedOrders,
    })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/marketplace-admin/withdraws
router.get('/withdraws', async (req, res) => {
  try {
    const { status = 'pending' } = req.query
    const withdraws = await Withdraw.find({ status })
      .sort({ createdAt: 1 })
      .populate('user', 'username email avatar')
    res.json({ withdraws })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/marketplace-admin/withdraws/:id/process
router.post('/withdraws/:id/process', requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const { action, rejectionReason } = req.body
    const withdraw = await Withdraw.findById(req.params.id).populate('user', 'username')
    if (!withdraw) return res.status(404).json({ message: 'Withdraw tidak ditemukan' })

    if (action === 'complete') {
      withdraw.status = 'completed'
      withdraw.processedBy = req.user._id
      withdraw.processedAt = new Date()
      await withdraw.save()

      await notify(req.io, {
        recipient: withdraw.user._id,
        actor: req.user._id,
        type: 'withdraw_success',
        title: 'Withdraw berhasil',
        body: `Rp${withdraw.amount.toLocaleString('id-ID')} telah ditransfer`,
        link: '/wallet',
      })
    } else if (action === 'reject') {
      await creditAvailable(
        withdraw.user._id,
        withdraw.amount,
        'withdraw_refund',
        'Withdraw',
        withdraw._id,
        rejectionReason || 'Withdraw ditolak',
      )
      withdraw.status = 'rejected'
      withdraw.rejectionReason = rejectionReason
      withdraw.processedBy = req.user._id
      withdraw.processedAt = new Date()
      await withdraw.save()

      req.io?.to(`user:${withdraw.user._id}`).emit('wallet:updated', { userId: withdraw.user._id.toString() })
    } else {
      withdraw.status = 'processing'
      await withdraw.save()
    }

    res.json({ withdraw })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// GET /api/marketplace-admin/audit-logs
router.get('/audit-logs', requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('actor', 'username role')
    res.json({ logs })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// PATCH /api/marketplace-admin/moderators/:id/status
router.patch('/moderators/:id/status', async (req, res) => {
  try {
    const { status } = req.body
    if (!['online', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid' })
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $in: ['moderator', 'admin'] } },
      { moderatorStatus: status },
      { new: true },
    ).select('username role moderatorStatus')

    if (!user) return res.status(404).json({ message: 'Moderator tidak ditemukan' })
    res.json({ user })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

export default router
