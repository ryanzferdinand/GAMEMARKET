/**
 * Deployment helpers — local dev vs production with custom domain.
 */

const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i
const PRIVATE_LAN_RE = /^https?:\/\/(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/i

export function isLocalOrigin(url) {
  if (!url) return true
  return LOCAL_ORIGIN_RE.test(url.trim()) || PRIVATE_LAN_RE.test(url.trim())
}

export function getAllowedOrigins() {
  const origins = new Set()

  const frontendUrl = process.env.FRONTEND_URL?.trim()
  if (frontendUrl) origins.add(frontendUrl)

  const extra = process.env.ALLOWED_ORIGINS || ''
  for (const origin of extra.split(',')) {
    const trimmed = origin.trim()
    if (trimmed) origins.add(trimmed)
  }

  // Dev defaults — always include localhost variants
  origins.add('http://localhost:3000')
  origins.add('http://127.0.0.1:3000')

  return [...origins]
}

export function isAllowedOrigin(origin) {
  if (!origin) return true // no-origin = same-origin/curl/Postman
  const allowed = getAllowedOrigins()
  if (allowed.includes(origin)) return true
  // Allow any private LAN IP in development
  if (process.env.NODE_ENV !== 'production' && PRIVATE_LAN_RE.test(origin)) return true
  return false
}

export function isProductionDeploy() {
  return process.env.NODE_ENV === 'production' && !isLocalOrigin(process.env.FRONTEND_URL)
}
