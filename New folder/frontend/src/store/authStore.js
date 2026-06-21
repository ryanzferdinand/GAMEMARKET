import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),

      // Used by VerifyEmailPage to store token+user after verification
      setAuth: (token, user) => set({ token, user }),

      login: async (credentials) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/login', credentials)

          // Server requires email verification before login
          if (data.requiresVerification) {
            set({ isLoading: false })
            return {
              success: false,
              requiresVerification: true,
              userId: data.userId,
              email: data.email,
              error: data.message,
            }
          }

          set({ user: data.user, token: data.token, isLoading: false })
          return { success: true }
        } catch (err) {
          set({ isLoading: false })
          const resData = err.response?.data

          // 403 with requiresVerification flag
          if (resData?.requiresVerification) {
            return {
              success: false,
              requiresVerification: true,
              userId: resData.userId,
              email: resData.email,
              error: resData.message,
            }
          }

          const msg = resData?.banReason
            ? `${resData.message}: ${resData.banReason}`
            : (resData?.message || 'Login gagal')
          return { success: false, error: msg }
        }
      },

      loginWithGoogle: async (googleToken) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/google', { token: googleToken })
          set({ user: data.user, token: data.token, isLoading: false })
          return { success: true, isNew: data.isNew }
        } catch (err) {
          set({ isLoading: false })
          const resData = err.response?.data
          const msg = resData?.banReason
            ? `${resData.message}: ${resData.banReason}`
            : (resData?.message || 'Login Google gagal')
          return { success: false, error: msg }
        }
      },

      register: async (userData) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/register', userData)

          // Email verification required — don't log in yet
          if (data.requiresVerification) {
            set({ isLoading: false })
            return {
              success: true,
              requiresVerification: true,
              userId: data.userId,
              email: data.email,
            }
          }

          set({ user: data.user, token: data.token, isLoading: false })
          return { success: true }
        } catch (err) {
          set({ isLoading: false })
          return { success: false, error: err.response?.data?.message || 'Registrasi gagal' }
        }
      },

      logout: () => {
        set({ user: null, token: null })
      },

      updateUser: (updates) => {
        set((state) => ({ user: { ...state.user, ...updates } }))
      },

      validateSession: async () => {
        const { token } = get()
        if (!token) return
        try {
          const { data } = await api.get('/auth/me')
          set({ user: data })
        } catch {
          set({ user: null, token: null })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
)

export default useAuthStore
