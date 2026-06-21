import React, { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '../navigation/Navbar'
import Sidebar from '../navigation/Sidebar'
import ChatPanel from '../chat/ChatPanel'
import useUIStore from '../../store/uiStore'
import useAuthStore from '../../store/authStore'

export default function MainLayout() {
  const { sidebarOpen, chatOpen, setSidebarOpen } = useUIStore()
  const { user } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setSidebarOpen(false)
    }
  }, [setSidebarOpen])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Navbar />

      <div style={{ display: 'flex', paddingTop: 50 }}>
        {/* Sidebar — overlay on mobile, push on desktop */}
        <aside className={`main-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <Sidebar />
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, top: 50,
              zIndex: 20, backgroundColor: 'rgba(0,0,0,0.35)',
            }}
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content — key on location.pathname remounts ONLY this div,
            triggering animate-fade-up without destroying the layout shell */}
        <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div
            key={location.pathname}
            className="animate-fade-up page-content"
            style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}
          >
            <Outlet />
          </div>
        </main>
      </div>

      {user && chatOpen && <ChatPanel />}
    </div>
  )
}
