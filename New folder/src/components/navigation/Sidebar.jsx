import React, { useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import {
  MdHome, MdTrendingUp, MdArticle, MdForum,
  MdNewReleases, MdAdd, MdKeyboardArrowDown,
  MdChatBubbleOutline, MdFavorite,
} from 'react-icons/md'
import { useCategories } from '../../lib/useCategories'
import useAuthStore from '../../store/authStore'
import CategoryBadge from '../common/CategoryBadge'

const NAV = [
  { path: '/',              label: 'Beranda',  icon: MdHome,        match: 'home'    },
  { path: '/?sort=newest',  label: 'Terbaru',  icon: MdNewReleases, match: 'newest'  },
  { path: '/?sort=popular', label: 'Trending', icon: MdTrendingUp,  match: 'popular' },
]

function isNavActive(match, searchParams) {
  const sort = searchParams.get('sort')
  if (match === 'home')    return !sort
  if (match === 'newest')  return sort === 'newest'
  if (match === 'popular') return sort === 'popular'
  return false
}

function SideLink({ active, icon: Icon, label }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        borderRadius: 9999,
        fontSize: 14, fontWeight: active ? 600 : 400,
        letterSpacing: '-0.12px',
        color: active ? 'var(--bg)' : 'var(--text-secondary)',
        backgroundColor: active ? 'var(--text-primary)' : 'transparent',
        transition: 'background-color 0.15s ease, color 0.15s ease',
        cursor: 'pointer',
      }}
      className={active ? '' : 'side-link-hover'}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  )
}

export default function Sidebar() {
  const { user }           = useAuthStore()
  const [searchParams]     = useSearchParams()
  const [expanded, setExp] = useState(false)
  const { categories }     = useCategories()
  const visible            = expanded ? categories : categories.slice(0, 7)

  return (
    <>
      {/* Hover styles injected once */}
      <style>{`
        .side-link-hover:hover {
          background-color: var(--bg-secondary) !important;
          color: var(--text-primary) !important;
        }
        .cat-link-hover:hover {
          background-color: var(--bg-secondary) !important;
          color: var(--text-primary) !important;
        }
      `}</style>

      <nav
        style={{
          height: '100%',
          backgroundColor: 'var(--bg-elevated)',
          borderRight: '1px solid var(--border-soft)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: 2 }}>

          {NAV.map(({ path, label, icon, match }) => {
            const active = isNavActive(match, searchParams)
            return (
              <NavLink key={path + label} to={path} style={{ textDecoration: 'none' }}>
                {() => <SideLink active={active} icon={icon} label={label} />}
              </NavLink>
            )
          })}

          {user && (
            <NavLink to="/my-posts" style={{ textDecoration: 'none' }}>
              {({ isActive }) => <SideLink active={isActive} icon={MdArticle} label="Postingan Saya" />}
            </NavLink>
          )}
          {user && (
            <NavLink to="/wishlist" style={{ textDecoration: 'none' }}>
              {({ isActive }) => <SideLink active={isActive} icon={MdFavorite} label="Wishlist" />}
            </NavLink>
          )}
          {user && (
            <NavLink to="/inbox" style={{ textDecoration: 'none' }}>
              {({ isActive }) => <SideLink active={isActive} icon={MdChatBubbleOutline} label="Pesan" />}
            </NavLink>
          )}
          <NavLink to="/forum" style={{ textDecoration: 'none' }}>
            {({ isActive }) => <SideLink active={isActive} icon={MdForum} label="Forum" />}
          </NavLink>

          {/* Categories */}
          <div style={{ paddingTop: 20, paddingBottom: 6, paddingLeft: 12 }}>
            <span className="section-label">Kategori</span>
          </div>

          {visible.map((cat) => (
            <NavLink key={cat.id} to={`/category/${cat.id}`} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <div
                  className={isActive ? '' : 'cat-link-hover'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 12px',
                    borderRadius: 9999,
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    letterSpacing: '-0.12px',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease, color 0.15s ease',
                  }}
                >
                  <CategoryBadge cat={cat} size="sm" />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat.name}
                  </span>
                </div>
              )}
            </NavLink>
          ))}

          {categories.length > 7 && (
            <button
              onClick={() => setExp((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                width: '100%', padding: '7px 12px',
                fontSize: 12, color: 'var(--text-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                letterSpacing: '-0.12px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <MdKeyboardArrowDown
                size={13}
                style={{
                  transition: 'transform 0.2s ease',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  flexShrink: 0,
                }}
              />
              {expanded ? 'Lebih sedikit' : `Lihat ${categories.length - 7} lainnya`}
            </button>
          )}
        </div>

        {/* Sell button */}
        {user && (
          <div style={{ padding: '10px', borderTop: '1px solid var(--border-soft)' }}>
            <NavLink
              to="/create-post"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', padding: '10px 0',
                borderRadius: 9999,
                backgroundColor: '#0066cc',
                color: '#ffffff',
                fontSize: 14, fontWeight: 400,
                letterSpacing: '-0.224px',
                textDecoration: 'none',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0071e3'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0066cc'}
            >
              <MdAdd size={15} />
              Jual Akun
            </NavLink>
          </div>
        )}
      </nav>
    </>
  )
}
