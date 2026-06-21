import Notification from '../models/Notification.js'

/**
 * Create a notification and push it via socket if user is online.
 */
export async function notify(io, { recipient, actor, type, title, body, link, meta }) {
  try {
    // Don't notify yourself
    if (recipient?.toString() === actor?.toString()) return

    const notif = await Notification.create({ recipient, actor, type, title, body, link, meta })
    await notif.populate('actor', 'username avatar')

    // Push in real-time if user is connected
    if (io) {
      io.to(`user:${recipient.toString()}`).emit('notification:new', notif)
    }

    return notif
  } catch (err) {
    console.error('notify error:', err.message)
  }
}
