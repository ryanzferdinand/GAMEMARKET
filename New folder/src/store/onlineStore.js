import { create } from 'zustand'

/**
 * Tracks which user IDs are currently online.
 * Updated in real-time via socket events in App.jsx.
 */
const useOnlineStore = create((set) => ({
  onlineIds: new Set(),

  setOnline: (userId) =>
    set((s) => { const n = new Set(s.onlineIds); n.add(userId); return { onlineIds: n } }),

  setOffline: (userId) =>
    set((s) => { const n = new Set(s.onlineIds); n.delete(userId); return { onlineIds: n } }),

  setInitialOnline: (ids) =>
    set({ onlineIds: new Set(ids) }),

  isOnline: (userId) => (s) => s.onlineIds.has(userId?.toString()),
}))

export default useOnlineStore
