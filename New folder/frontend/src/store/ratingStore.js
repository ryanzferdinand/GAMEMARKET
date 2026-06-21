import { create } from 'zustand'

/**
 * Real-time seller rating cache, updated via socket `rating:updated`.
 */
const useRatingStore = create((set, get) => ({
  cache: {},

  setSellerRating: (userId, stats) =>
    set((s) => ({
      cache: {
        ...s.cache,
        [userId?.toString()]: {
          rating: stats.rating,
          ratingCount: stats.ratingCount,
          breakdown: stats.breakdown,
        },
      },
    })),

  getSellerRating: (userId) => get().cache[userId?.toString()] || null,

  clear: () => set({ cache: {} }),
}))

export default useRatingStore
