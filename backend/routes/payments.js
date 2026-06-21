import express from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'
import {
  createDepositPayment,
  simulatePayment,
  getPaymentStatus,
  getPaymentProvider,
  canSimulatePayments,
} from '../lib/payments/gateway.js'
import { getMidtransConfig } from '../lib/payments/midtrans.js'
import Deposit from '../models/Deposit.js'
import Payment from '../models/Payment.js'
import { DEPOSIT_METHODS } from '../lib/marketplaceConstants.js'

const router = express.Router()
const depositLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipFailedRequests: true,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: { message: 'Terlalu banyak permintaan deposit' },
})

router.use(authenticate)

// GET /api/payments/config
router.get('/config', (req, res) => {
  const midtrans = getMidtransConfig()
  res.json({
    provider: getPaymentProvider(),
    simulateAvailable: canSimulatePayments(),
    midtrans: {
      configured: midtrans.configured,
      clientKey: midtrans.clientKey,
      isProduction: midtrans.isProduction,
    },
  })
})

// POST /api/payments/deposit
router.post('/deposit', depositLimiter, async (req, res) => {
  try {
    const { amount, method } = req.body
    const numAmount = Number(amount)

    if (!amount || !method) {
      return res.status(400).json({ message: 'Amount dan method wajib diisi' })
    }
    if (!DEPOSIT_METHODS.includes(method)) {
      return res.status(400).json({ message: 'Metode pembayaran tidak valid' })
    }
    if (numAmount < 10000) {
      return res.status(400).json({ message: 'Minimum deposit Rp10.000' })
    }

    const result = await createDepositPayment({
      userId: req.user._id,
      amount: numAmount,
      method,
      // Use request origin so Midtrans callbacks work from any IP (LAN, localhost, etc.)
      frontendUrl: req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:3000',
    })

    res.status(201).json(result)
  } catch (err) {
    console.error('Deposit error:', err)
    res.status(400).json({ message: err.message || 'Gagal membuat deposit' })
  }
})

// GET /api/payments/deposits
router.get('/deposits', async (req, res) => {
  try {
    const deposits = await Deposit.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30)
    res.json({ deposits })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

// GET /api/payments/status/:gatewayRef — poll / sync Midtrans status
router.get('/status/:gatewayRef', async (req, res) => {
  try {
    const result = await getPaymentStatus({
      gatewayRef: decodeURIComponent(req.params.gatewayRef),
      userId: req.user._id,
      io: req.io,
    })
    res.json(result)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// POST /api/payments/simulate/:gatewayRef — when Midtrans not configured (or ALLOW_PAYMENT_SIMULATE)
router.post('/simulate/:gatewayRef', async (req, res) => {
  try {
    const gatewayRef = decodeURIComponent(req.params.gatewayRef)
    const payment = await Payment.findOne({ gatewayRef, user: req.user._id })
    if (!payment) return res.status(404).json({ message: 'Payment tidak ditemukan' })

    const result = await simulatePayment({ gatewayRef: payment.gatewayRef, io: req.io })
    res.json(result)
  } catch (err) {
    console.error('Simulate error:', err)
    res.status(400).json({ message: err.message || 'Simulasi gagal' })
  }
})

// GET /api/payments/:id
router.get('/:id', async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, user: req.user._id })
    if (!payment) return res.status(404).json({ message: 'Payment tidak ditemukan' })
    res.json({ payment })
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server' })
  }
})

export default router
