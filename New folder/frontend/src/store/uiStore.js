import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const isMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches

const useUIStore = create(
  persist(
    (set) => ({
      darkMode: false,
      sidebarOpen: true,
      chatOpen: false,
      chatRecipient: null,

      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      openChat: (recipient) => set({ chatOpen: true, chatRecipient: recipient }),
      closeChat: () => set({ chatOpen: false, chatRecipient: null }),
    }),
    {
      name: 'ui-storage',
      partialize: (s) => ({ darkMode: s.darkMode, sidebarOpen: s.sidebarOpen }),
      onRehydrateStorage: () => (state) => {
        if (state && isMobileViewport()) {
          state.sidebarOpen = false
        }
      },
    }
  )
)

export default useUIStore
