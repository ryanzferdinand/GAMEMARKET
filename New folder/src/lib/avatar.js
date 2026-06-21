const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

/**
 * Returns a reliable avatar URL.
 * - External URLs (Google profile photos): use as-is
 * - /uploads paths: keep as-is so Vite proxy handles them in dev;
 *   in production they're served from the same origin anyway
 * - No avatar: DiceBear initials fallback
 */
export function getAvatar(avatar, seed = 'user') {
  if (avatar && (avatar.startsWith('http://') || avatar.startsWith('https://'))) {
    return avatar
  }
  if (avatar && avatar.startsWith('/uploads')) {
    // Keep as relative path — Vite proxy forwards /uploads → backend:5000/uploads
    return avatar
  }
  const s = encodeURIComponent(seed || 'user')
  return `https://api.dicebear.com/7.x/initials/svg?seed=${s}&backgroundColor=3b5bfc&textColor=ffffff&fontSize=40`
}

/**
 * Returns a usable URL for an uploaded post image.
 * Keeps /uploads paths relative so Vite proxy works in dev.
 */
export function getImageUrl(src) {
  if (!src) return null
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  // /uploads/filename.jpg → served via Vite proxy in dev, same origin in prod
  return src
}
