import crypto from 'crypto'

const PREFIX = 'enc:v1:'
const ALGO = 'aes-256-gcm'

function deriveKey(secret) {
  return crypto.createHash('sha256').update(secret).digest()
}

/** Primary key for new encryptions (prefer dedicated chat key). */
function getKey() {
  const secret = process.env.CHAT_ENCRYPTION_KEY || process.env.JWT_SECRET
  if (!secret) return null
  return deriveKey(secret)
}

/** All keys to try when decrypting (handles legacy JWT_SECRET-encrypted messages). */
function getDecryptKeys() {
  const keys = []
  const seen = new Set()

  for (const secret of [process.env.CHAT_ENCRYPTION_KEY, process.env.JWT_SECRET]) {
    if (!secret || seen.has(secret)) continue
    seen.add(secret)
    keys.push(deriveKey(secret))
  }

  return keys
}

function decryptWithKey(value, key) {
  const body = value.slice(PREFIX.length)
  const [ivB64, tagB64, dataB64] = body.split('.')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptText(plain) {
  if (!plain) return plain
  const key = getKey()
  if (!key) return plain

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

export function decryptText(value) {
  if (!value || !isEncrypted(value)) return value
  const keys = getDecryptKeys()
  if (!keys.length) return value

  for (const key of keys) {
    try {
      return decryptWithKey(value, key)
    } catch {
      // try next key (e.g. legacy messages encrypted with JWT_SECRET)
    }
  }

  return value
}

export function messageForClient(message) {
  if (!message) return message
  const obj = typeof message.toObject === 'function' ? message.toObject() : { ...message }
  if (obj.content) obj.content = decryptText(obj.content)
  return obj
}

export function messagesForClient(messages) {
  return messages.map(messageForClient)
}
