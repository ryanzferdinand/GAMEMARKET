import crypto from 'crypto'
import Payment from '../../models/Payment.js'
import Deposit from '../../models/Deposit.js'
import WalletTransaction from '../../models/WalletTransaction.js'
import User from '../../models/User.js'
import { PAYMENT_STATUS } from '../marketplaceConstants.js'
import { creditAvailable } from '../walletService.js'
import { notify } from '../notify.js'
import {
  isMidtransConfigured,
  createMidtransCharge,
  getMidtransTransactionStatus,
  mapMidtransStatus,
} from './midtrans.js'

const GATEWAY_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || process.env.JWT_SECRET

export function getPaymentProvider() {
  return isMidtransConfigured() ? 'midtrans' : 'simulate'
}

export function canSimulatePayments() {
  // NEVER allow simulation in production — regardless of env vars
  if (process.env.NODE_ENV === 'production') return false
  return !isMidtransConfigured() || process.env.ALLOW_PAYMENT_SIMULATE === 'true'
}

export function verifyWebhookSignature(payload, signature) {
  if (!signature) return process.env.NODE_ENV !== 'production'
  const expected = crypto
    .createHmac('sha256', GATEWAY_SECRET)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex')
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

function extractPaymentActions(gatewayPayload = {}) {
  return {
    paymentUrl: gatewayPayload.paymentUrl || gatewayPayload.redirectUrl || null,
    qrString: gatewayPayload.qrString || null,
    redirectUrl: gatewayPayload.redirectUrl || null,
  }
}

export async function createDepositPayment({ userId, amount, method, frontendUrl }) {
  const gatewayRef = `GM-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const provider = getPaymentProvider()

  const deposit = await Deposit.create({
    user: userId,
    amount,
    method,
    status: PAYMENT_STATUS.WAITING,
    externalId: gatewayRef,
    expiredAt,
  })

  let gatewayPayload = {
    provider,
    paymentUrl: `/wallet?deposit=${deposit._id}`,
    qrString: null,
    redirectUrl: null,
  }

  if (provider === 'midtrans') {
    const user = await User.findById(userId).select('username email')
    const midtransResult = await createMidtransCharge({
      orderId: gatewayRef,
      amount,
      method,
      customer: user,
      frontendUrl,
    })

    gatewayPayload = {
      provider: 'midtrans',
      midtransTransactionId: midtransResult.transactionId,
      midtransStatus: midtransResult.status,
      redirectUrl: midtransResult.redirectUrl,
      qrString: midtransResult.qrString,
      paymentUrl: midtransResult.redirectUrl || `/wallet?deposit=${deposit._id}`,
      expiryTime: midtransResult.expiryTime,
      raw: midtransResult.midtrans,
    }

    if (midtransResult.expiryTime) {
      deposit.expiredAt = new Date(midtransResult.expiryTime)
    }
  } else {
    gatewayPayload.qrString = method === 'qris' ? `SIM-QRIS:${gatewayRef}:${amount}` : null
  }

  const payment = await Payment.create({
    user: userId,
    deposit: deposit._id,
    amount,
    method,
    status: PAYMENT_STATUS.WAITING,
    gatewayRef,
    expiredAt: deposit.expiredAt,
    gatewayPayload,
  })

  deposit.payment = payment._id
  await deposit.save()

  const actions = extractPaymentActions(gatewayPayload)

  return {
    deposit,
    payment,
    provider,
    simulateAvailable: canSimulatePayments(),
    gatewayRef: payment.gatewayRef,
    ...actions,
  }
}

async function isAlreadyCredited(depositId) {
  if (!depositId) return false
  const existing = await WalletTransaction.findOne({
    type: 'deposit',
    referenceType: 'Deposit',
    referenceId: depositId,
  })
  return Boolean(existing)
}

export async function processPaymentWebhook({ gatewayRef, status, payload, io }) {
  const payment = await Payment.findOne({ gatewayRef }).populate('deposit')
  if (!payment) throw new Error('Payment not found')

  const normalizedStatus = status === PAYMENT_STATUS.PAID || status === 'paid'
    ? PAYMENT_STATUS.PAID
    : status

  if (payment.status === PAYMENT_STATUS.PAID) {
    const credited = await isAlreadyCredited(payment.deposit?._id || payment.deposit)
    if (credited) return { payment, duplicate: true, credited: true }
    // Paid flag set but wallet never credited — repair
    if (normalizedStatus === PAYMENT_STATUS.PAID) {
      await creditAvailable(
        payment.user,
        payment.amount,
        'deposit',
        'Deposit',
        payment.deposit?._id || payment.deposit,
        `Deposit via ${payment.method} (recovery)`,
        { gatewayRef },
      )
      if (io) io.to(`user:${payment.user}`).emit('wallet:updated', { userId: payment.user.toString() })
      return { payment, duplicate: true, credited: true, recovered: true }
    }
    return { payment, duplicate: true, credited: false }
  }

  payment.gatewayPayload = { ...payment.gatewayPayload, webhook: payload }
  payment.webhookReceivedAt = new Date()

  if (normalizedStatus === PAYMENT_STATUS.PAID) {
    const depositId = payment.deposit?._id || payment.deposit

    // Credit wallet FIRST — then mark paid (prevents stuck "paid" without balance)
    if (!(await isAlreadyCredited(depositId))) {
      await creditAvailable(
        payment.user,
        payment.amount,
        'deposit',
        'Deposit',
        depositId,
        `Deposit via ${payment.method}`,
        { gatewayRef, provider: payment.gatewayPayload?.provider },
      )
    }

    payment.status = PAYMENT_STATUS.PAID
    payment.paidAt = new Date()
    await payment.save()

    if (payment.deposit) {
      const dep = payment.deposit._id ? payment.deposit : await Deposit.findById(payment.deposit)
      if (dep) {
        dep.status = PAYMENT_STATUS.PAID
        dep.paidAt = new Date()
        await dep.save()
      }
    }

    if (io) {
      io.to(`user:${payment.user}`).emit('wallet:updated', { userId: payment.user.toString() })
    }

    await notify(io, {
      recipient: payment.user,
      actor: payment.user,
      type: 'deposit_success',
      title: 'Deposit berhasil',
      body: `Rp${payment.amount.toLocaleString('id-ID')} masuk wallet Anda`,
      link: '/wallet',
      meta: { paymentId: payment._id },
    })

    return { payment, duplicate: false, credited: true }
  }

  payment.status = normalizedStatus
  await payment.save()

  if (payment.deposit) {
    const dep = payment.deposit._id ? payment.deposit : await Deposit.findById(payment.deposit)
    if (dep) {
      dep.status = normalizedStatus
      await dep.save()
    }
  }

  return { payment, duplicate: false, credited: false }
}

export async function simulatePayment({ gatewayRef, io }) {
  if (!canSimulatePayments()) {
    throw new Error('Simulasi tidak tersedia — Midtrans aktif. Selesaikan pembayaran via Midtrans.')
  }
  return processPaymentWebhook({
    gatewayRef,
    status: PAYMENT_STATUS.PAID,
    payload: { simulated: true, at: new Date().toISOString() },
    io,
  })
}

export async function syncMidtransPayment({ gatewayRef, io }) {
  if (!isMidtransConfigured()) {
    throw new Error('Midtrans tidak dikonfigurasi')
  }

  const midtransStatus = await getMidtransTransactionStatus(gatewayRef)
  const status = mapMidtransStatus(midtransStatus.transaction_status)

  return processPaymentWebhook({
    gatewayRef,
    status,
    payload: midtransStatus,
    io,
  })
}

export async function getPaymentStatus({ gatewayRef, userId, io }) {
  const payment = await Payment.findOne({ gatewayRef, user: userId })
  if (!payment) throw new Error('Payment tidak ditemukan')

  if (
    payment.status === PAYMENT_STATUS.WAITING &&
    payment.gatewayPayload?.provider === 'midtrans' &&
    isMidtransConfigured()
  ) {
    try {
      const result = await syncMidtransPayment({ gatewayRef, io })
      return {
        payment: result.payment,
        credited: result.credited,
        status: result.payment.status,
      }
    } catch (err) {
      console.error('Midtrans sync error:', err.message)
    }
  }

  const credited = await isAlreadyCredited(payment.deposit)
  return { payment, credited, status: payment.status }
}
