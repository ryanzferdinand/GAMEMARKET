import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Message from '../models/Message.js'
import SellerProfile from '../models/SellerProfile.js'
import { notify } from '../lib/notify.js'
import { messageForClient } from '../lib/chatCrypto.js'

const onlineUsers = new Map() // userId -> socketId
const typingThrottle = new Map() // `${userId}:${receiverId}` -> lastSentTimestamp

async function getConversationPartnerIds(userId) {
  const uid = new mongoose.Types.ObjectId(userId)
  const rows = await Message.aggregate([
    { $match: { $or: [{ sender: uid }, { receiver: uid }] } },
    {
      $project: {
        partner: {
          $cond: [{ $eq: ['$sender', uid] }, '$receiver', '$sender'],
        },
      },
    },
    { $group: { _id: '$partner' } },
  ])
  return rows.map((r) => r._id.toString())
}

async function emitPresenceToPartners(io, userId, event, payload) {
  const partners = await getConversationPartnerIds(userId)
  for (const partnerId of partners) {
    io.to(`user:${partnerId}`).emit(event, payload)
  }
}

async function emitConversationUpdatesFromMessage(io, senderId, receiverId, outMsg, senderUser) {
  const receiverPartner = {
    _id: senderId,
    username: senderUser.username,
    avatar: senderUser.avatar,
    isOnline: true,
    role: senderUser.role,
  }

  const unreadCount = await Message.countDocuments({
    sender: senderId,
    receiver: receiverId,
    read: false,
  })

  io.to(`user:${receiverId}`).emit('chat:conversation-update', {
    partner: receiverPartner,
    lastMessage: outMsg,
    unreadCount,
  })

  const senderPartner = await User.findById(receiverId)
    .select('username avatar isOnline role')
    .lean()

  io.to(`user:${senderId}`).emit('chat:conversation-update', {
    partner: senderPartner,
    lastMessage: outMsg,
    unreadCount: 0,
  })
}

export const setupSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    const token = socket.auth?.token || socket.handshake.auth?.token
    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId)
      if (!user) return next(new Error('User not found'))

      socket.userId = user._id.toString()
      socket.user = user
      next()
    } catch (err) {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket) => {
    const userId = socket.userId

    console.log(`🔌 User connected: ${socket.user.username} (${socket.id})`)

    onlineUsers.set(userId, socket.id)
    await User.findByIdAndUpdate(userId, { isOnline: true })

    socket.join(`user:${userId}`)

    await emitPresenceToPartners(io, userId, 'user:online', { userId })

    socket.on('chat:send', async ({ receiverId, content, imageUrl, tmpId }) => {
      try {
        if (!receiverId) return
        if (!content?.trim() && !imageUrl) return

        const message = await Message.create({
          sender:   userId,
          receiver: receiverId,
          content:  content?.trim() || '',
          imageUrl: imageUrl || null,
        })

        await message.populate('sender', 'username avatar')
        await message.populate('receiver', 'username avatar')

        // Attach the client's tmpId so the sender can replace the optimistic message
        const outMsg = { ...messageForClient(message), tmpId }

        const receiverSocketId = onlineUsers.get(receiverId)
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('chat:message', outMsg)
        }
        // Echo back to sender with tmpId for optimistic update replacement
        socket.emit('chat:message', outMsg)

        await emitConversationUpdatesFromMessage(io, userId, receiverId, outMsg, socket.user)

        // Auto-calculate seller response time: if sender is a seller responding to a buyer's message
        // find the most recent unanswered buyer message to calculate response delay
        try {
          const senderUser = socket.user
          if (['seller', 'trusted_seller', 'verified_seller'].includes(senderUser.role)) {
            // Find the last message from receiver (buyer) before this reply
            const prevBuyerMsg = await Message.findOne({
              sender: receiverId,
              receiver: userId,
            }).sort({ createdAt: -1 }).select('createdAt')

            if (prevBuyerMsg) {
              const responseMs = Date.now() - new Date(prevBuyerMsg.createdAt).getTime()
              const responseMinutes = Math.round(responseMs / 60000)

              // Only count reasonable responses (under 7 days)
              if (responseMinutes >= 0 && responseMinutes < 7 * 24 * 60) {
                const profile = await SellerProfile.findOneAndUpdate(
                  { user: userId },
                  [
                    {
                      $set: {
                        avgResponseMinutes: {
                          $cond: [
                            { $eq: ['$responseCount', 0] },
                            responseMinutes,
                            {
                              $round: [
                                {
                                  $divide: [
                                    { $add: [{ $multiply: ['$avgResponseMinutes', '$responseCount'] }, responseMinutes] },
                                    { $add: ['$responseCount', 1] },
                                  ],
                                },
                                0,
                              ],
                            },
                          ],
                        },
                        responseCount: { $add: ['$responseCount', 1] },
                      },
                    },
                  ],
                  { upsert: true, new: true },
                )
              }
            }
          }
        } catch (respErr) {
          // Non-critical — don't fail the message send
          console.error('Response time update error:', respErr.message)
        }

        const preview = imageUrl ? '📷 Foto' : (content?.trim() || '').slice(0, 60)
        await notify(io, {
          recipient: receiverId,
          actor: userId,
          type: 'new_message',
          title: 'Pesan baru',
          body: `${socket.user.username}: ${preview}`,
          link: '/inbox',
          meta: { senderId: userId },
        })
      } catch (err) {
        socket.emit('chat:error', { message: 'Gagal mengirim pesan' })
      }
    })

    socket.on('chat:edit', async ({ messageId, content }) => {
      try {
        const msg = await Message.findOne({ _id: messageId, sender: userId })
        if (!msg) return socket.emit('chat:error', { message: 'Pesan tidak ditemukan' })
        if (!content?.trim()) return

        msg.content = content.trim()
        msg.edited  = true
        await msg.save()
        await msg.populate('sender', 'username avatar')

        const partnerId = msg.receiver.toString()
        const receiverSocketId = onlineUsers.get(partnerId)
        const clientMsg = messageForClient(msg)
        if (receiverSocketId) io.to(receiverSocketId).emit('chat:edited', clientMsg)
        socket.emit('chat:edited', clientMsg)
      } catch {
        socket.emit('chat:error', { message: 'Gagal edit pesan' })
      }
    })

    socket.on('chat:delete', async ({ messageId }) => {
      try {
        const msg = await Message.findOne({ _id: messageId, sender: userId })
        if (!msg) return socket.emit('chat:error', { message: 'Pesan tidak ditemukan' })

        const partnerId = msg.receiver.toString()
        await Message.deleteOne({ _id: messageId })

        const receiverSocketId = onlineUsers.get(partnerId)
        if (receiverSocketId) io.to(receiverSocketId).emit('chat:deleted', { messageId, partnerId: userId })
        socket.emit('chat:deleted', { messageId, partnerId })
      } catch {
        socket.emit('chat:error', { message: 'Gagal hapus pesan' })
      }
    })

    socket.on('chat:read', async ({ partnerId }) => {
      try {
        if (!partnerId) return

        await Message.updateMany(
          { sender: partnerId, receiver: userId, read: false },
          { read: true }
        )

        const unreadCount = await Message.countDocuments({
          sender: partnerId,
          receiver: userId,
          read: false,
        })
        const partner = await User.findById(partnerId).select('username avatar isOnline role').lean()
        const lastMessage = await Message.findOne({
          $or: [
            { sender: userId, receiver: partnerId },
            { sender: partnerId, receiver: userId },
          ],
        })
          .sort({ createdAt: -1 })
          .populate('sender', 'username avatar')
          .populate('receiver', 'username avatar')

        io.to(`user:${userId}`).emit('chat:conversation-update', {
          partner,
          lastMessage: lastMessage ? messageForClient(lastMessage) : null,
          unreadCount,
        })

        // Notify sender their messages were read (via personal room for reliability)
        io.to(`user:${partnerId}`).emit('chat:read-receipt', { readerId: userId, partnerId })
      } catch (err) {
        console.error('chat:read error:', err.message)
      }
    })

    socket.on('chat:typing', ({ receiverId }) => {
      const key = `${userId}:${receiverId}`
      const now = Date.now()
      if (now - (typingThrottle.get(key) || 0) < 1000) return // max 1 event/sec
      typingThrottle.set(key, now)
      const receiverSocketId = onlineUsers.get(receiverId)
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('chat:typing', {
          senderId: userId,
          username: socket.user.username,
        })
      }
    })

    socket.on('order:join', ({ orderId }) => {
      if (orderId) socket.join(`order:${orderId}`)
    })

    socket.on('order:leave', ({ orderId }) => {
      if (orderId) socket.leave(`order:${orderId}`)
    })

    socket.on('seller:join', ({ sellerId }) => {
      if (sellerId) socket.join(`seller:${sellerId}`)
    })

    socket.on('seller:leave', ({ sellerId }) => {
      if (sellerId) socket.leave(`seller:${sellerId}`)
    })

    socket.on('disconnect', async () => {
      console.log(`🔌 User disconnected: ${socket.user.username}`)
      onlineUsers.delete(userId)
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() })
      await emitPresenceToPartners(io, userId, 'user:offline', { userId })
    })
  })
}

export { onlineUsers }
