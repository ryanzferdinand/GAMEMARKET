import express from 'express'
import {
  verifyWebhookSignature,
  processPaymentWebhook,
  syncMidtransPayment,
} from '../lib/payments/gateway.js'
import { isMidtransConfigured, mapMidtransStatus, getMidtransConfig } from '../lib/payments/midtrans.js'
import { PAYMENT_STATUS } from '../lib/marketplaceConstants.js'
import crypto from 'crypto'

const router = express.Router()

function parseBody(req) {
  if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
    const raw = req.body.toString()
    return { raw, payload: JSON.parse(raw) }
  }
  return { raw: JSON.stringify(req.body), payload: req.body }
}

function verifyMidtransSignature(payload) {
  const { serverKey } = getMidtransConfig()
  if (!serverKey) return process.env.NODE_ENV !== 'production'
  
  const signatureKey = payload.signature_key
  if (!signatureKey) return false
  
  const { order_id, status_code, gross_amount } = payload
  const expected = crypto
    .createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
    .digest('hex')
  
  if (expected.length !== signatureKey.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureKey))
}

// POST /api/webhooks/midtrans — Midtrans payment notification
router.post('/midtrans', async (req, res) => {
  try {
    const { payload } = parseBody(req)
    const orderId = payload.order_id
    const transactionStatus = payload.transaction_status

    if (!orderId) {
      return res.status(400).json({ message: 'Missing order_id' })
    }

    // Verify Midtrans signature
    if (!verifyMidtransSignature(payload)) {
      return res.status(401).json({ message: 'Invalid signature' })
    }

    console.log(`📥 Midtrans webhook: ${orderId} → ${transactionStatus}`)

    // Always verify via Midtrans API when configured (don't trust body alone)
    let result
    if (isMidtransConfigured()) {
      result = await syncMidtransPayment({ gatewayRef: orderId, io: req.io })
    } else {
      const status = mapMidtransStatus(transactionStatus)
      result = await processPaymentWebhook({
        gatewayRef: orderId,
        status,
        payload,
        io: req.io,
      })
    }

    res.json({ ok: true, status: result.payment?.status, credited: result.credited })
  } catch (err) {
    console.error('Midtrans webhook error:', err.message)
    // Midtrans expects 200 even on errors to avoid infinite retries for bad data
    res.status(200).json({ ok: false, message: err.message })
  }
})

// POST /api/webhooks/payment — generic / manual webhook
router.post('/payment', async (req, res) => {
  try {
    const signature = req.headers['x-payment-signature'] || req.headers['x-midtrans-signature']
    const { raw, payload } = parseBody(req)

    if (!verifyWebhookSignature(raw, signature)) {
      return res.status(401).json({ message: 'Invalid signature' })
    }

    const gatewayRef = payload.gatewayRef || payload.order_id || payload.external_id
    const statusMap = {
      settlement: PAYMENT_STATUS.PAID,
      capture: PAYMENT_STATUS.PAID,
      paid: PAYMENT_STATUS.PAID,
      expire: PAYMENT_STATUS.EXPIRED,
      expired: PAYMENT_STATUS.EXPIRED,
      deny: PAYMENT_STATUS.FAILED,
      failed: PAYMENT_STATUS.FAILED,
      cancel: PAYMENT_STATUS.CANCELLED,
      cancelled: PAYMENT_STATUS.CANCELLED,
    }
    const status = statusMap[payload.transaction_status || payload.status] || payload.status

    if (!gatewayRef) {
      return res.status(400).json({ message: 'Missing gateway reference' })
    }

    const result = await processPaymentWebhook({
      gatewayRef,
      status,
      payload,
      io: req.io,
    })

    res.json({ ok: true, duplicate: result.duplicate, credited: result.credited })
  } catch (err) {
    console.error('Webhook error:', err)
    res.status(500).json({ message: 'Webhook processing failed' })
  }
})

export default router
