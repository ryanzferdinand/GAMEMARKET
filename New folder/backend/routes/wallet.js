import express from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'
import { getWalletSummary, getOrCreateWallet } from '../lib/walletService.js'
import WalletTransaction from '../models/WalletTransaction.js'
import Withdraw from '../models/Withdraw.js'
import { WITHDRAW_MIN } from '../lib/marketplaceConstants.js'
import { debitAvailable } from '../lib/walletService.js'
import { notify } from '../lib/notify.js'

const router = express.Router()
const withdrawLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skipFailedRequests: true,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: { message: 'Terlalu banyak permintaan withdraw' },
})

router.use(authenticate)

// GET /api/wallet
router.get('/', async (req, res) => {
  try {
    const wallet = await getWalletSummary(req.user._id)
    res.json(wallet)
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/wallet/transactions
router.get('/transactions', async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query
    const query = { user: req.user._id }
    if (type) query.type = type

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit)),
      WalletTransaction.countDocuments(query),
    ])

    res.json({ transactions, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// POST /api/wallet/withdraw
router.post('/withdraw', withdrawLimiter, async (req, res) => {
  try {
    const { amount, method, accountNumber, accountName } = req.body
    const numAmount = Number(amount)

    if (!amount || !method || !accountNumber) {
      return res.status(400).json({ message: 'Amount, method, dan nomor rekening wajib diisi' })
    }
    if (numAmount < WITHDRAW_MIN) {
      return res.status(400).json({ message: `Minimum withdraw Rp${WITHDRAW_MIN.toLocaleString('id-ID')}` })
    }

    const wallet = await getOrCreateWallet(req.user._id)
    if (wallet.availableBalance < numAmount) {
      return res.status(400).json({ message: 'Saldo tidak mencukupi' })
    }

    await debitAvailable(
      req.user._id,
      numAmount,
      'withdraw',
      'Withdraw',
      null,
      `Withdraw via ${method}`,
    )

    const withdraw = await Withdraw.create({
      user: req.user._id,
      amount: numAmount,
      method,
      accountNumber: String(accountNumber).trim(),
      accountName: accountName?.trim(),
      status: 'pending',
    })

    req.io?.to(`user:${req.user._id}`).emit('wallet:updated', { userId: req.user._id.toString() })

    await notify(req.io, {
      recipient: req.user._id,
      actor: req.user._id,
      type: 'withdraw_requested',
      title: 'Permintaan withdraw',
      body: `Rp${numAmount.toLocaleString('id-ID')} sedang diproses`,
      link: '/wallet',
      meta: { withdrawId: withdraw._id },
    })

    res.status(201).json({ withdraw, message: 'Permintaan withdraw berhasil diajukan' })
  } catch (err) {
    res.status(400).json({ message: err.message || 'Gagal withdraw' })
  }
})

// GET /api/wallet/withdraws
router.get('/withdraws', async (req, res) => {
  try {
    const withdraws = await Withdraw.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50)
    res.json({ withdraws })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

export default router
