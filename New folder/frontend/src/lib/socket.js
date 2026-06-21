import { io } from 'socket.io-client'

function resolveBackendUrl() {
  if (typeof window === 'undefined') return 'http://localhost:5000'

  const { hostname, origin } = window.location
  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1'
  const envBackend = import.meta.env.VITE_BACKEND_URL?.trim()

  // Production / custom domain: API + socket on same origin (no separate port)
  if (import.meta.env.PROD) {
    return envBackend || origin
  }

  // Local dev on same machine → use env or localhost:5000
  if (isLocalDev) {
    return envBackend || 'http://localhost:5000'
  }

  // LAN mobile testing → same host, backend port 5000
  return `http://${hostname}:5000`
}

const BACKEND_URL = resolveBackendUrl()

let socket = null

export const getSocket = () => {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: false,
      // Allow polling fallback so the connection always works
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
  }
  return socket
}

export const connectSocket = (token) => {
  const s = getSocket()
  // Always update auth token before connecting/reconnecting
  s.auth = { token }
  if (!s.connected) {
    s.connect()
  }
  return s
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
