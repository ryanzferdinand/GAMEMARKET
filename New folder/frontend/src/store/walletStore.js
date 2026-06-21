import { create } from 'zustand'
import api from '../lib/api'

const useWalletStore = create((set, get) => ({
  wallet: null,
  transactions: [],
  withdraws: [],
  paymentConfig: null,
  loading: false,

  fetchPaymentConfig: async () => {
    try {
      const { data } = await api.get('/payments/config')
      set({ paymentConfig: data })
      return data
    } catch {
      return null
    }
  },

  fetchWallet: async () => {
    set({ loading: true })
    try {
      const { data } = await api.get('/wallet')
      set({ wallet: data, loading: false })
      return data
    } catch {
      set({ loading: false })
      return null
    }
  },

  fetchTransactions: async (page = 1) => {
    try {
      const { data } = await api.get('/wallet/transactions', { params: { page } })
      set({ transactions: data.transactions })
      return data
    } catch {
      return null
    }
  },

  fetchWithdraws: async () => {
    try {
      const { data } = await api.get('/wallet/withdraws')
      set({ withdraws: data.withdraws })
    } catch {}
  },

  createDeposit: async (amount, method) => {
    const { data } = await api.post('/payments/deposit', { amount, method })
    return data
  },

  simulatePayment: async (gatewayRef) => {
    const { data } = await api.post(`/payments/simulate/${encodeURIComponent(gatewayRef)}`)
    await get().fetchWallet()
    await get().fetchTransactions()
    return data
  },

  checkPaymentStatus: async (gatewayRef) => {
    const { data } = await api.get(`/payments/status/${encodeURIComponent(gatewayRef)}`)
    if (data.credited || data.status === 'paid') {
      await get().fetchWallet()
      await get().fetchTransactions()
    }
    return data
  },

  withdraw: async (payload) => {
    const { data } = await api.post('/wallet/withdraw', payload)
    await get().fetchWallet()
    await get().fetchWithdraws()
    return data
  },

  reset: () => set({ wallet: null, transactions: [], withdraws: [], paymentConfig: null }),
}))

export default useWalletStore
