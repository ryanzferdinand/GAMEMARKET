import Order from '../../models/Order.js'
import Payment from '../../models/Payment.js'
import { ORDER_STATUS, PAYMENT_STATUS } from '../marketplaceConstants.js'
import { confirmOrder } from '../escrowService.js'
import { reassignStaleDisputes } from '../moderatorQueue.js'

export function startMarketplaceJobs(io) {
  let confirmInterval = 60 * 1000
  let moderatorInterval = 60 * 1000
  let paymentExpireInterval = 5 * 60 * 1000

  async function runAutoConfirm() {
    try {
      const orders = await Order.find({
        status: ORDER_STATUS.DELIVERED,
        buyerCheckDeadline: { $lte: new Date() },
      })

      if (orders.length === 0) {
        confirmInterval = Math.min(Math.round(confirmInterval * 1.5), 10 * 60 * 1000)
      } else {
        confirmInterval = 60 * 1000
        for (const order of orders) {
          await confirmOrder({ orderId: order._id, buyerId: order.buyer, auto: true, io })
          console.log(`✅ Auto-confirmed order ${order.orderNumber}`)
        }
      }
    } catch (err) {
      console.error('Auto-confirm job error:', err.message)
    } finally {
      setTimeout(runAutoConfirm, confirmInterval)
    }
  }

  async function runModeratorReassign() {
    try {
      const count = await reassignStaleDisputes()
      if (count > 0) {
        moderatorInterval = 60 * 1000
        console.log(`🔄 Reassigned ${count} stale dispute(s)`)
      } else {
        moderatorInterval = Math.min(Math.round(moderatorInterval * 1.5), 10 * 60 * 1000)
      }
    } catch (err) {
      console.error('Moderator reassign job error:', err.message)
    } finally {
      setTimeout(runModeratorReassign, moderatorInterval)
    }
  }

  async function runPaymentExpire() {
    try {
      const now = new Date()
      const [paymentResult, depositResult] = await Promise.all([
        Payment.updateMany(
          { status: PAYMENT_STATUS.WAITING, expiredAt: { $lte: now } },
          { status: PAYMENT_STATUS.EXPIRED },
        ),
        import('../../models/Deposit.js').then(({ default: Deposit }) =>
          Deposit.updateMany(
            { status: PAYMENT_STATUS.WAITING, expiredAt: { $lte: now } },
            { status: PAYMENT_STATUS.EXPIRED },
          ),
        ),
      ])

      const modified = (paymentResult.modifiedCount || 0) + (depositResult.modifiedCount || 0)
      if (modified > 0) {
        paymentExpireInterval = 5 * 60 * 1000
      } else {
        paymentExpireInterval = Math.min(Math.round(paymentExpireInterval * 1.25), 15 * 60 * 1000)
      }
    } catch (err) {
      console.error('Payment expire job error:', err.message)
    } finally {
      setTimeout(runPaymentExpire, paymentExpireInterval)
    }
  }

  runAutoConfirm()
  runModeratorReassign()
  runPaymentExpire()

  console.log('⏱️  Marketplace background jobs started (adaptive intervals)')
}
