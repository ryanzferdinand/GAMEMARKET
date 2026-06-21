const SANDBOX_URL = 'https://api.sandbox.midtrans.com'
const PRODUCTION_URL = 'https://api.midtrans.com'

export function isMidtransConfigured() {
  const key = process.env.MIDTRANS_SERVER_KEY?.trim()
  return Boolean(key && key !== 'your_midtrans_server_key_here')
}

export function getMidtransConfig() {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  return {
    configured: isMidtransConfigured(),
    isProduction,
    baseUrl: isProduction ? PRODUCTION_URL : SANDBOX_URL,
    clientKey: process.env.MIDTRANS_CLIENT_KEY?.trim() || '',
    serverKey: process.env.MIDTRANS_SERVER_KEY?.trim() || '',
  }
}

function authHeader(serverKey) {
  return `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`
}

function buildChargeBody({ orderId, amount, method, customer, frontendUrl }) {
  const body = {
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    customer_details: {
      first_name: customer?.username || 'User',
      email: customer?.email || 'user@gamemarket.local',
    },
  }

  const callbackUrl = `${frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000'}/wallet?deposit=done`

  switch (method) {
    case 'gopay':
      body.payment_type = 'gopay'
      body.gopay = { enable_callback: true, callback_url: callbackUrl }
      break
    case 'dana':
      body.payment_type = 'qris'
      body.qris = { acquirer: 'gopay' }
      break
    case 'qris':
    default:
      body.payment_type = 'qris'
      body.qris = { acquirer: 'gopay' }
      break
  }

  return body
}

export async function createMidtransCharge({ orderId, amount, method, customer, frontendUrl }) {
  const { baseUrl, serverKey } = getMidtransConfig()
  if (!serverKey) throw new Error('Midtrans server key tidak dikonfigurasi')

  const res = await fetch(`${baseUrl}/v2/charge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader(serverKey),
    },
    body: JSON.stringify(buildChargeBody({ orderId, amount, method, customer, frontendUrl })),
  })

  const data = await res.json()
  if (!res.ok) {
    const msg = data?.status_message || data?.error_messages?.join(', ') || 'Midtrans charge gagal'
    throw new Error(msg)
  }

  const redirectAction = data.actions?.find((a) =>
    ['deeplink-redirect', 'redirect-url', 'mobile-web-redirect'].includes(a.name),
  )
  const qrAction = data.actions?.find((a) =>
    ['generate-qr-code', 'generate-qr-code-v2'].includes(a.name),
  )

  return {
    midtrans: data,
    transactionId: data.transaction_id,
    status: data.transaction_status,
    redirectUrl: redirectAction?.url || null,
    qrString: data.qr_string || qrAction?.url || null,
    expiryTime: data.expiry_time,
  }
}

export async function getMidtransTransactionStatus(orderId) {
  const { baseUrl, serverKey } = getMidtransConfig()
  if (!serverKey) throw new Error('Midtrans server key tidak dikonfigurasi')

  const res = await fetch(`${baseUrl}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: {
      Accept: 'application/json',
      Authorization: authHeader(serverKey),
    },
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.status_message || 'Gagal cek status Midtrans')
  }
  return data
}

export function mapMidtransStatus(transactionStatus) {
  const map = {
    capture: 'paid',
    settlement: 'paid',
    pending: 'waiting',
    expire: 'expired',
    cancel: 'cancelled',
    deny: 'failed',
    failure: 'failed',
  }
  return map[transactionStatus] || transactionStatus
}
