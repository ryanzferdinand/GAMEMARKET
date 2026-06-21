import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MdMenu, MdSearch, MdAdd,
  MdLightMode, MdDarkMode, MdLogout, MdPerson,
  MdAdminPanelSettings, MdArticle, MdClose,
  MdChatBubbleOutline,
  MdAccountBalanceWallet,
  MdBarChart,
} from 'react-icons/md'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'
import useWalletStore from '../../store/walletStore'
import UserBadge from '../common/UserBadge'
import { getAvatar, getImageUrl } from '../../lib/avatar'
import { getSocket } from '../../lib/socket'
import api from '../../lib/api'
import NotificationDropdown from '../notifications/NotificationDropdown'

const NAV_H = 50

function useDebounce(value, delay) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)


// ── SearchBox is defined OUTSIDE Navbar so React never remounts it on re-render ──
function SearchBox({ inputRef, query, setQuery, suggestions, showSugg, setShowSugg, onSubmit, onPick, compact = false }) {
  const containerRef = useRef(null)

  // Close on outside tap/click
  useEffect(() => {
    const h = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setShowSugg(false)
    }
    document.addEventListener('mousedown', h)
    document.addEventListener('touchstart', h, { passive: true })
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('touchstart', h)
    }
  }, [setShowSugg])

  const hasSugg = suggestions.posts.length > 0 || suggestions.users.length > 0

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <MdSearch style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#7a7a7a', pointerEvents: 'none', zIndex: 1 }} size={15} />
      <input
        ref={inputRef}
        type="text"
        inputMode="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (e.target.value.trim().length >= 2) setShowSugg(true)
          else setShowSugg(false)
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#2997ff'
          e.target.style.backgroundColor = 'rgba(255,255,255,0.13)'
          if (query.trim().length >= 2 && hasSugg) setShowSugg(true)
        }}
        onBlur={(e) => {
          e.target.style.borderColor = compact ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.1)'
          e.target.style.backgroundColor = compact ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.08)'
          // Never close suggestions on blur — handled by outside listener
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onSubmit() }
          if (e.key === 'Escape') { setShowSugg(false); setQuery('') }
        }}
        placeholder="Cari akun, game, penjual…"
        style={{
          width: '100%',
          paddingLeft: 32,
          paddingRight: query ? 30 : 14,
          paddingTop: compact ? 10 : 6,
          paddingBottom: compact ? 10 : 6,
          borderRadius: 9999,
          border: compact ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.1)',
          backgroundColor: compact ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.08)',
          color: '#f5f5f7',
          fontSize: 16,   /* ≥16px prevents iOS auto-zoom which dismisses keyboard */
          letterSpacing: '-0.12px',
          height: compact ? 42 : 30,
          outline: 'none',
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
          WebkitAppearance: 'none',
        }}
      />

      {/* Clear button */}
      {query && (
        <button
          onMouseDown={(e) => { e.preventDefault(); setQuery(''); setShowSugg(false) }}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#7a7a7a', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', zIndex: 2 }}
        >
          <MdClose size={14} />
        </button>
      )}

      {/* Suggestions dropdown */}
      {showSugg && hasSugg && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, backgroundColor: 'rgba(28, 28, 30, 0.94)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.4)', overflow: 'hidden', zIndex: 9999 }}
        >
          {suggestions.users.length > 0 && (
            <SuggSection label="Penjual">
              {suggestions.users.map(u => (
                <SuggRow key={u._id} onPick={() => onPick(`/profile/${u.username}`)}>
                  <img src={getAvatar(u.avatar, u.username)} alt="" style={{ width: 28, height: 28, borderRadius: 9999, objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{u.totalSales || 0} terjual{u.rating > 0 ? ` · ★ ${u.rating.toFixed(1)}` : ''}</p>
                  </div>
                  <UserBadge role={u.role} mini />
                </SuggRow>
              ))}
            </SuggSection>
          )}
          {suggestions.posts.length > 0 && (
            <SuggSection label="Postingan" topBorder={suggestions.users.length > 0}>
              {suggestions.posts.map(p => (
                <SuggRow key={p._id} onPick={() => onPick(`/post/${p._id}`)}>
                  {p.images?.[0]
                    ? <img src={getImageUrl(p.images[0])} alt="" style={{ width: 36, height: 26, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 36, height: 26, borderRadius: 6, backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--accent)', margin: 0, fontWeight: 500 }}>{fmt(p.price)}</p>
                  </div>
                </SuggRow>
              ))}
            </SuggSection>
          )}
          {/* Show all — always navigates to search page with current query */}
          <SuggRow onPick={onSubmit} style={{ borderTop: '1px solid var(--border-soft)' }}>
            <MdSearch size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
              Lihat semua hasil untuk &ldquo;{query}&rdquo;
            </span>
          </SuggRow>
        </div>
      )}
    </div>
  )
}

function SuggSection({ label, children, topBorder = false }) {
  return (
    <>
      <div style={{ padding: '8px 14px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: topBorder ? '1px solid var(--border-soft)' : 'none' }}>
        {label}
      </div>
      {children}
    </>
  )
}

function SuggRow({ children, onPick, style: extraStyle }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onPick() }}
      onTouchEnd={(e) => { e.preventDefault(); onPick() }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.1s ease', ...extraStyle }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {children}
    </button>
  )
}


export default function Navbar() {
  const { user, logout }                            = useAuthStore()
  const { toggleSidebar, toggleDarkMode, darkMode } = useUIStore()
  const wallet = useWalletStore((s) => s.wallet)
  const [query, setQuery]           = useState('')
  const [mobileSearch, setMobile]   = useState(false)
  const [userMenuOpen, setUserMenu] = useState(false)
  const [unreadCount, setUnread]    = useState(0)
  const [suggestions, setSuggestions] = useState({ posts: [], users: [] })
  const [showSugg, setShowSugg]     = useState(false)
  const navigate  = useNavigate()
  const menuRef   = useRef(null)
  const desktopRef = useRef(null)
  const mobileRef  = useRef(null)
  const debouncedQuery = useDebounce(query, 200)

  // Close user menu on outside click
  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Focus search on mobile drawer open
  useEffect(() => {
    if (mobileSearch) setTimeout(() => mobileRef.current?.focus(), 50)
  }, [mobileSearch])

  // Fetch suggestions
  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q || q.length < 2) { setSuggestions({ posts: [], users: [] }); setShowSugg(false); return }
    let cancelled = false
    api.get('/search/suggestions', { params: { q } })
      .then(({ data }) => {
        if (!cancelled) {
          setSuggestions(data)
          if (data.posts.length > 0 || data.users.length > 0) setShowSugg(true)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [debouncedQuery])

  // Unread message count
  useEffect(() => {
    if (!user) return
    const load = async () => {
      try { const { data } = await api.get('/chat/conversations'); setUnread(data.reduce((s, c) => s + (c.unreadCount || 0), 0)) }
      catch { /* silent */ }
    }
    load()
    const socket = getSocket()
    const onConv = () => load()
    const onMsg  = (msg) => { if ((msg.sender?._id || msg.sender) !== user._id) setUnread(n => n + 1) }
    socket.on('chat:conversation-update', onConv)
    socket.on('chat:message', onMsg)
    socket.on('chat:read-receipt', onConv)
    return () => { socket.off('chat:conversation-update', onConv); socket.off('chat:message', onMsg); socket.off('chat:read-receipt', onConv) }
  }, [user?._id])

  const goSearch = () => {
    if (!query.trim()) return
    setShowSugg(false)
    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    setMobile(false)
  }

  const pickSugg = (path) => {
    setShowSugg(false)
    setQuery('')
    navigate(path)
    setMobile(false)
  }

  const handleLogout = () => { logout(); navigate('/'); setUserMenu(false) }

  const sharedSearchProps = { query, setQuery, suggestions, showSugg, setShowSugg, onSubmit: goSearch, onPick: pickSugg }


  return (
    <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: NAV_H, backgroundColor: 'rgba(12, 12, 14, 0.78)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>

      {/* Main bar */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 12px', position: 'relative' }}>

        {/* LEFT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, zIndex: 1 }}>
          <NavBtn onClick={toggleSidebar} aria-label="Menu"><MdMenu size={19} /></NavBtn>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: '#0066cc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="5" width="3" height="4" rx="1" fill="white" opacity=".8"/>
                <rect x="5.5" y="2" width="3" height="10" rx="1" fill="white"/>
                <rect x="10" y="4" width="3" height="6" rx="1" fill="white" opacity=".6"/>
              </svg>
            </div>
            <span className="hidden-mobile" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: 600, fontSize: 15, letterSpacing: '-0.2px', color: '#f5f5f7' }}>GameMarket</span>
          </Link>
        </div>

        {/* CENTER — absolutely centered search */}
        <div className="desktop-search" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: '36%', minWidth: 260, maxWidth: 480, display: 'none' }}>
          <SearchBox inputRef={desktopRef} {...sharedSearchProps} />
        </div>

        <div style={{ flex: 1 }} />

        {/* RIGHT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, zIndex: 1 }}>
          <NavBtn onClick={() => setMobile(v => !v)} aria-label="Cari" className="mobile-search-btn">
            {mobileSearch ? <MdClose size={18} /> : <MdSearch size={18} />}
          </NavBtn>

          <NavBtn onClick={toggleDarkMode} aria-label="Tema" className="desktop-only">
            {darkMode ? <MdLightMode size={17} /> : <MdDarkMode size={17} />}
          </NavBtn>

          {user ? (
            <>
              <Link to="/create-post" className="desktop-only" aria-label="Jual Akun" title="Jual Akun"
                style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: '#0066cc', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0, transition: 'background-color 0.15s ease', marginLeft: 2 }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0071e3'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0066cc'}>
                <MdAdd size={17} />
              </Link>
              <span className="desktop-only"><NotificationDropdown dark /></span>
              <Link to="/inbox" onClick={() => setUnread(0)} className="desktop-only" style={{ position: 'relative', display: 'inline-flex' }}>
                <NavBtn as="span"><MdChatBubbleOutline size={18} />{unreadCount > 0 && <Badge count={unreadCount} />}</NavBtn>
              </Link>

              {/* Avatar */}
              <div style={{ position: 'relative', marginLeft: 2 }} ref={menuRef}>
                <button onClick={() => setUserMenu(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 3px', borderRadius: 9999, border: 'none', cursor: 'pointer', backgroundColor: 'transparent', transition: 'background-color 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={getAvatar(user.avatar, user.username)} alt={user.username}
                      style={{ width: 28, height: 28, borderRadius: 9999, objectFit: 'cover', display: 'block', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.2)' }} />
                    {unreadCount > 0 && <span className="mobile-only" style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 9999, backgroundColor: '#ff3b30', boxShadow: '0 0 0 1.5px #000', display: 'block' }} />}
                  </div>
                  <span className="desktop-only" style={{ fontSize: 13, color: '#f5f5f7', letterSpacing: '-0.12px', maxWidth: 88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</span>
                </button>

                {userMenuOpen && (
                  <div className="dropdown animate-scale-in" style={{ right: 0, top: '100%', marginTop: 6, width: 230, paddingTop: 4, paddingBottom: 4, backgroundColor: 'rgba(28, 28, 30, 0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.10)', boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06) inset' }}>
                    <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border-soft)' }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{user.username}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, marginBottom: 0 }}>{user.email}</p>
                      <div style={{ marginTop: 7 }}><UserBadge role={user.role} mini /></div>
                    </div>
                    <div style={{ padding: '4px 0' }}>
                      {[
                        { to: `/profile/${user.username}`, icon: MdPerson, label: 'Profil Saya' },
                        { to: '/wallet', icon: MdAccountBalanceWallet, label: `Wallet${wallet ? ` · ${fmt(wallet.availableBalance)}` : ''}` },
                        { to: '/orders', icon: MdArticle, label: 'Pesanan' },
                        { to: '/my-posts', icon: MdArticle, label: 'Postingan Saya' },
                        { to: '/seller/dashboard', icon: MdBarChart, label: 'Dashboard Penjual', sellerOnly: true },
                        { to: '/inbox', icon: MdChatBubbleOutline, label: 'Pesan', badge: unreadCount },
                        { to: '/create-post', icon: MdAdd, label: 'Jual Akun', mobileOnly: true },
                        ...(user.role === 'admin' || user.role === 'moderator' || user.role === 'supervisor' ? [{ to: '/admin', icon: MdAdminPanelSettings, label: 'Admin Panel' }] : []),
                      ].map(({ to, icon: Icon, label, badge, mobileOnly, sellerOnly }) => {
                        if (sellerOnly && user.role === 'buyer') return null
                        return (
                        <Link key={to} to={to} onClick={() => { setUserMenu(false); if (badge) setUnread(0) }}
                          className={`dropdown-item${mobileOnly ? ' mobile-menu-only' : ''}`}
                          style={{ justifyContent: 'space-between', textDecoration: 'none' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />{label}</span>
                          {badge > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999, backgroundColor: '#0066cc', color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge > 99 ? '99+' : badge}</span>}
                        </Link>
                        )
                      })}
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-soft)', padding: '4px 0' }}>
                      <button onClick={() => { toggleDarkMode(); setUserMenu(false) }} className="dropdown-item" style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                          {darkMode ? <MdLightMode size={15} style={{ color: 'var(--text-muted)' }} /> : <MdDarkMode size={15} style={{ color: 'var(--text-muted)' }} />}
                          {darkMode ? 'Mode Terang' : 'Mode Gelap'}
                        </span>
                      </button>
                      <button onClick={handleLogout} className="dropdown-item"
                        style={{ width: '100%', color: 'var(--color-red)', border: 'none', background: 'none', textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,59,48,0.07)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                        <MdLogout size={15} style={{ flexShrink: 0 }} />Keluar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
              <Link to="/login" style={{ color: '#f5f5f7', fontSize: 13, textDecoration: 'none', padding: '5px 10px', borderRadius: 9999, transition: 'background-color 0.15s ease', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Masuk</Link>
              <Link to="/register" style={{ backgroundColor: '#0066cc', color: '#ffffff', padding: '5px 13px', borderRadius: 9999, fontSize: 13, textDecoration: 'none', flexShrink: 0, transition: 'background-color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0071e3'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0066cc'}>Daftar</Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile search drawer */}
      {mobileSearch && (
        <div className="animate-fade-down" style={{ padding: '8px 12px 12px', borderTop: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(10, 10, 12, 0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
          <SearchBox inputRef={mobileRef} {...sharedSearchProps} compact />
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .desktop-search    { display: flex !important; }
          .mobile-search-btn { display: none !important; }
          .desktop-only      { display: inline-flex !important; }
          .mobile-menu-only  { display: none !important; }
          .mobile-only       { display: none !important; }
          .hidden-mobile     { display: inline !important; }
        }
        @media (max-width: 767px) {
          .desktop-search    { display: none !important; }
          .desktop-only      { display: none !important; }
          .mobile-search-btn { display: inline-flex !important; }
          .hidden-mobile     { display: none !important; }
        }
      `}</style>
    </header>
  )
}

function NavBtn({ children, as: Tag = 'button', className = '', ...props }) {
  return (
    <Tag {...props} className={className}
      style={{ width: 36, height: 36, borderRadius: 9999, backgroundColor: 'transparent', color: '#f5f5f7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background-color 0.15s ease', position: 'relative', textDecoration: 'none' }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
      {children}
    </Tag>
  )
}

function Badge({ count }) {
  return (
    <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 9999, backgroundColor: '#ff3b30', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 0 0 1.5px #000' }}>
      {count > 9 ? '9+' : count}
    </span>
  )
}
