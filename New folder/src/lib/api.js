import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// Inject token from localStorage on each request
api.interceptors.request.use((config) => {
  try {
    const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}')
    const token = stored?.state?.token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch {}
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const isBanned = status === 403 && err.response?.data?.banReason
    if (status === 401 || isBanned) {
      localStorage.removeItem('auth-storage')
      if (isBanned) {
        sessionStorage.setItem('ban-notice', err.response.data.banReason || err.response.data.message)
      }
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
