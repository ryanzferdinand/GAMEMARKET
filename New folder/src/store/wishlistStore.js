import { create } from 'zustand'
import api from '../lib/api'

const useWishlistStore = create((set, get) => ({
  ids: new Set(),
  loaded: false,

  fetchIds: async () => {
    try {
      const { data } = await api.get('/wishlist/ids')
      set({ ids: new Set(data.ids || []), loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  isSaved: (postId) => get().ids.has(postId?.toString()),

  toggle: async (postId) => {
    const id = postId?.toString()
    const saved = get().ids.has(id)
    try {
      if (saved) {
        await api.delete(`/wishlist/${id}`)
        set((s) => { const n = new Set(s.ids); n.delete(id); return { ids: n } })
        return false
      }
      await api.post(`/wishlist/${id}`)
      set((s) => { const n = new Set(s.ids); n.add(id); return { ids: n } })
      return true
    } catch {
      throw new Error('Gagal memperbarui wishlist')
    }
  },

  reset: () => set({ ids: new Set(), loaded: false }),
}))

export default useWishlistStore
