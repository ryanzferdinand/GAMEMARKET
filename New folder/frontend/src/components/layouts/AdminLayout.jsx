import React, { useState, useEffect } from 'react'

import { Outlet, Link, NavLink, useLocation } from 'react-router-dom'

import {
  MdDashboard, MdImage, MdArticle, MdPeople, MdArrowBack, MdFlag, MdCategory, MdMenu, MdClose,
  MdAccountBalanceWallet, MdGavel, MdHistory,
} from 'react-icons/md'

import useAuthStore from '../../store/authStore'

import UserBadge from '../common/UserBadge'

import { getAvatar } from '../../lib/avatar'



const NAV = [

  { path: '/admin',            label: 'Dashboard',    icon: MdDashboard, end: true },

  { path: '/admin/banners',    label: 'Banner Promo', icon: MdImage },

  { path: '/admin/posts',      label: 'Postingan',    icon: MdArticle },

  { path: '/admin/categories', label: 'Kategori',     icon: MdCategory },

  { path: '/admin/users',      label: 'Pengguna',     icon: MdPeople },

  { path: '/admin/reports',    label: 'Laporan',      icon: MdFlag },
  { path: '/admin/marketplace', label: 'Marketplace', icon: MdAccountBalanceWallet },
  { path: '/admin/disputes',   label: 'Dispute',      icon: MdGavel },
  { path: '/admin/audit-logs', label: 'Audit Log',    icon: MdHistory },
]



const BOTTOM_NAV = NAV.slice(0, 5)



function NavItem({ path, label, icon: Icon, end, onNavigate }) {

  return (

    <NavLink to={path} end={end} style={{ textDecoration: 'none' }} onClick={onNavigate}>

      {({ isActive }) => (

        <div

          className={isActive ? '' : 'admin-nav-hover'}

          style={{

            display: 'flex', alignItems: 'center', gap: 10,

            padding: '8px 12px', borderRadius: 9999,

            fontSize: 14, fontWeight: isActive ? 600 : 400,

            letterSpacing: '-0.224px',

            color: isActive ? 'var(--bg)' : 'var(--text-secondary)',

            backgroundColor: isActive ? 'var(--text-primary)' : 'transparent',

            transition: 'background-color 0.15s ease, color 0.15s ease',

            cursor: 'pointer',

          }}

        >

          <Icon size={15} style={{ flexShrink: 0 }} />

          {label}

        </div>

      )}

    </NavLink>

  )

}



export default function AdminLayout() {

  const { user } = useAuthStore()

  const location = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(false)



  useEffect(() => {

    setSidebarOpen(false)

  }, [location.pathname])



  useEffect(() => {

    if (!sidebarOpen) return

    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)

  }, [sidebarOpen])



  const closeSidebar = () => setSidebarOpen(false)



  return (

    <>

      <style>{`

        .admin-nav-hover:hover {

          background-color: var(--bg-secondary) !important;

          color: var(--text-primary) !important;

        }

      `}</style>



      <div className="admin-shell">

        {/* Mobile header */}

        <header className="admin-mobile-header">

          <button

            type="button"

            onClick={() => setSidebarOpen((v) => !v)}

            className="btn-icon w-9 h-9 rounded-xl"

            aria-label={sidebarOpen ? 'Tutup menu' : 'Buka menu'}

          >

            {sidebarOpen ? <MdClose size={20} /> : <MdMenu size={20} />}

          </button>

          <div style={{ flex: 1, minWidth: 0 }}>

            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>

              Admin Panel

            </p>

            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>

              {NAV.find((n) => n.end ? location.pathname === n.path : location.pathname.startsWith(n.path))?.label || 'GameMarket'}

            </p>

          </div>

          <Link to="/" className="btn-icon w-9 h-9 rounded-xl" title="Kembali ke site">

            <MdArrowBack size={18} />

          </Link>

        </header>



        {sidebarOpen && (

          <div className="admin-overlay lg:hidden" onClick={closeSidebar} aria-hidden="true" />

        )}



        {/* Sidebar */}

        <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>

          {/* Brand */}

          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-soft)' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

              <div

                style={{

                  width: 28, height: 28, borderRadius: 8, backgroundColor: '#0066cc',

                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,

                }}

              >

                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">

                  <rect x="1" y="5" width="3" height="4" rx="1" fill="white" opacity=".8"/>

                  <rect x="5.5" y="2" width="3" height="10" rx="1" fill="white"/>

                  <rect x="10" y="4" width="3" height="6" rx="1" fill="white" opacity=".6"/>

                </svg>

              </div>

              <div>

                <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.224px', color: 'var(--text-primary)', lineHeight: 1 }}>

                  GameMarket

                </p>

                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Admin Panel</p>

              </div>

            </div>

          </div>



          {/* Nav */}

          <nav style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>

            {NAV.map((item) => (

              <NavItem key={item.path} {...item} onNavigate={closeSidebar} />

            ))}

          </nav>



          {/* User + back */}

          <div style={{ padding: '12px', borderTop: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>

              <img

                src={getAvatar(user?.avatar, user?.username)}

                alt="avatar"

                style={{ width: 28, height: 28, borderRadius: 9999, flexShrink: 0, objectFit: 'cover' }}

              />

              <div style={{ minWidth: 0 }}>

                <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.224px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>

                  {user?.username}

                </p>

                <UserBadge role={user?.role} mini />

              </div>

            </div>

            <Link

              to="/"

              onClick={closeSidebar}

              style={{

                display: 'flex', alignItems: 'center', gap: 7,

                padding: '6px 8px', borderRadius: 9999,

                fontSize: 13, color: 'var(--text-muted)', letterSpacing: '-0.12px',

                textDecoration: 'none',

                transition: 'background-color 0.15s ease, color 0.15s ease',

              }}

              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)' }}

              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}

            >

              <MdArrowBack size={13} />

              Kembali ke site

            </Link>

          </div>

        </aside>



        {/* Content */}

        <main className="admin-main">

          <Outlet />

        </main>



        {/* Mobile bottom nav */}

        <nav className="admin-bottom-nav" aria-label="Admin navigation">

          {BOTTOM_NAV.map(({ path, label, icon: Icon, end }) => (

            <NavLink

              key={path}

              to={path}

              end={end}

              className={({ isActive }) => `admin-bottom-nav-item${isActive ? ' active' : ''}`}

            >

              <Icon size={20} />

              <span>{label.split(' ')[0]}</span>

            </NavLink>

          ))}

        </nav>

      </div>

    </>

  )

}

