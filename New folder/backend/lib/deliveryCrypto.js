import { encryptText, decryptText, isEncrypted } from './chatCrypto.js'

export function encryptDeliveryField(value) {
  if (!value) return undefined
  return encryptText(String(value))
}

export function decryptDeliveryField(value) {
  if (!value) return value
  return decryptText(value)
}

export function encryptDelivery(delivery = {}) {
  return {
    email: encryptDeliveryField(delivery.email),
    password: encryptDeliveryField(delivery.password),
    recovery: encryptDeliveryField(delivery.recovery),
    notes: delivery.notes,
    attachments: delivery.attachments || [],
    deliveredAt: delivery.deliveredAt || new Date(),
  }
}

export function decryptDeliveryForClient(delivery) {
  if (!delivery) return delivery
  const obj = typeof delivery.toObject === 'function' ? delivery.toObject() : { ...delivery }
  return {
    ...obj,
    email: decryptDeliveryField(obj.email),
    password: decryptDeliveryField(obj.password),
    recovery: decryptDeliveryField(obj.recovery),
  }
}

export function maskDeliveryForLog(delivery = {}) {
  return {
    email: delivery.email ? '***' : undefined,
    password: delivery.password ? '***' : undefined,
    recovery: delivery.recovery ? '***' : undefined,
    notes: delivery.notes,
  }
}

export function isDeliveryEncrypted(delivery) {
  if (!delivery) return false
  return [delivery.email, delivery.password, delivery.recovery].some(isEncrypted)
}

export async function migratePlaintextDeliveries() {
  const Order = (await import('../models/Order.js')).default
  const orders = await Order.find({
    $or: [
      { 'delivery.email': { $exists: true, $ne: null } },
      { 'delivery.password': { $exists: true, $ne: null } },
      { 'delivery.recovery': { $exists: true, $ne: null } },
    ],
  }).select('delivery')

  let migrated = 0
  for (const order of orders) {
    if (!order.delivery || isDeliveryEncrypted(order.delivery)) continue
    order.delivery = encryptDelivery(order.delivery)
    await order.save()
    migrated++
  }
  return migrated
}
