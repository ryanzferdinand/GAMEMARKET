import Message from '../models/Message.js'
import { encryptText, isEncrypted } from './chatCrypto.js'

/**
 * Encrypt legacy plaintext chat messages already stored in MongoDB.
 */
export async function migratePlaintextMessages() {
  if (!process.env.CHAT_ENCRYPTION_KEY && !process.env.JWT_SECRET) return 0

  const messages = await Message.find({
    content: { $exists: true, $nin: ['', null] },
  }).select('_id content')

  let migrated = 0
  for (const msg of messages) {
    if (!isEncrypted(msg.content)) {
      await Message.updateOne(
        { _id: msg._id },
        { $set: { content: encryptText(msg.content) } }
      )
      migrated++
    }
  }

  return migrated
}
