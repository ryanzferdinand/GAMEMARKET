/**
 * In-memory view deduplication with bounded size (BUG-009).
 *
 * A view is counted at most once per (viewer key + content id) within the TTL window.
 */

const TTL_MS = 4 * 60 * 60 * 1000 // 4 hours
const MAX_ENTRIES = 50_000

// Map<string, number>  key → expiry timestamp (insertion order preserved for eviction)
const seen = new Map()

function evictIfNeeded() {
  const now = Date.now()
  for (const [key, expiry] of seen) {
    if (now > expiry) seen.delete(key)
  }
  while (seen.size > MAX_ENTRIES) {
    const oldest = seen.keys().next().value
    seen.delete(oldest)
  }
}

/**
 * Returns true if this view should be counted (first time in TTL window).
 */
export function shouldCountView(req, type, contentId, ownerId = null) {
  const viewerId = req.user?._id?.toString()
  if (viewerId && ownerId && viewerId === ownerId.toString()) return false

  const viewerKey = viewerId || getClientIp(req)
  const key = `${type}:${contentId}:${viewerKey}`

  const now = Date.now()
  const expiry = seen.get(key)

  if (expiry && now < expiry) return false

  seen.set(key, now + TTL_MS)
  evictIfNeeded()
  return true
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}
