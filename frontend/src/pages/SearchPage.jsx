import React, { useEffect, useLayoutEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { MdSearch, MdPerson } from 'react-icons/md'
import toast from 'react-hot-toast'
import PostCard from '../components/common/PostCard'
import FilterBar from '../components/common/FilterBar'
import UserBadge from '../components/common/UserBadge'
import StarRating from '../components/common/StarRating'
import api from '../lib/api'
import { getAvatar } from '../lib/avatar'

function SkeletonCard() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton" style={{ aspectRatio: '16/9' }} />
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 16, width: '75%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 12, width: '50%', borderRadius: 6 }} />
      </div>
    </div>
  )
}

function UserCard({ user }) {
  return (
    <Link to={`/profile/${user.username}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="card-interactive" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={getAvatar(user.avatar, user.username)} alt={user.username}
          style={{ width: 48, height: 48, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.224px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</span>
            {user.verified && <span style={{ fontSize: 12, color: 'var(--accent)' }}>✓</span>}
            <UserBadge role={user.role} mini />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.totalSales || 0} terjual</span>
            {user.rating > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#ff9f0a' }}>
                <StarRating value={user.rating} readonly size={11} />
                {user.rating.toFixed(1)}
              </span>
            )}
          </div>
          {user.bio && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.bio}</p>}
        </div>
      </div>
    </Link>
  )
}

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''

  const [tab, setTab]         = useState('posts') // 'posts' | 'users'
  const [posts, setPosts]     = useState([])
  const [users, setUsers]     = useState([])
  const [loading, setL]       = useState(false)
  const [error, setError]     = useState(null)
  const [page, setPage]       = useState(1)
  const [hasMore, setMore]    = useState(false)
  const [total, setTotal]     = useState(0)
  const [filters, setFilters] = useState({ sort: 'newest', minPrice: '', maxPrice: '', rank: '' })

  useLayoutEffect(() => {
    setPage(1)
    setPosts([])
    setUsers([])
  }, [query, filters, tab])

  useEffect(() => {
    if (!query) { setPosts([]); setUsers([]); setError(null); setTotal(0); return }

    let cancelled = false
    setL(true)
    setError(null)

    if (tab === 'users') {
      api.get('/search/users', { params: { q: query } })
        .then(({ data }) => { if (!cancelled) { setUsers(data); setTotal(data.length); setMore(false) } })
        .catch(() => { if (!cancelled) setError('Gagal memuat hasil.') })
        .finally(() => { if (!cancelled) setL(false) })
    } else {
      api.get('/posts', {
        params: {
          search: query, sort: filters.sort, page, limit: 12,
          ...(filters.minPrice && { minPrice: filters.minPrice }),
          ...(filters.maxPrice && { maxPrice: filters.maxPrice }),
          ...(filters.rank && { sellerRank: filters.rank }),
        },
      })
        .then(({ data }) => {
          if (!cancelled) {
            setPosts(page === 1 ? data.posts || [] : (prev) => [...prev, ...(data.posts || [])])
            setMore(data.hasMore)
            setTotal(data.total || 0)
          }
        })
        .catch(() => {
          if (!cancelled) {
            const msg = 'Gagal memuat hasil pencarian.'
            setError(msg)
            toast.error(msg)
            if (page === 1) setPosts([])
          }
        })
        .finally(() => { if (!cancelled) setL(false) })
    }

    return () => { cancelled = true }
  }, [query, filters, page, tab])

  const updatePost = (u) => setPosts((prev) => prev.map((p) => p._id === u._id ? u : p))

  const TAB_STYLE = (active) => ({
    padding: '7px 18px', borderRadius: 9999,
    fontSize: 14, fontWeight: active ? 600 : 400,
    letterSpacing: '-0.224px', border: 'none', cursor: 'pointer',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    backgroundColor: active ? 'var(--text-primary)' : 'var(--bg-secondary)',
    color: active ? 'var(--bg)' : 'var(--text-secondary)',
  })

  return (
    <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontSize: 24, fontWeight: 600, letterSpacing: '-0.374px', color: 'var(--text-primary)', margin: 0 }}>
          {query ? `"${query}"` : 'Cari'}
        </h1>
        {!loading && query && !error && total > 0 && (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>{total} hasil ditemukan</p>
        )}
      </div>

      {/* Tabs */}
      {query && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={TAB_STYLE(tab === 'posts')} onClick={() => setTab('posts')}>Postingan</button>
          <button style={TAB_STYLE(tab === 'users')} onClick={() => setTab('users')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MdPerson size={14} />Penjual</span>
          </button>
          {tab === 'posts' && <FilterBar filters={filters} onChange={(f) => { setFilters(f); setPage(1) }} />}
        </div>
      )}

      {/* Error */}
      {error && page === 1 && !loading && (
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--color-red)', margin: 0 }}>{error}</p>
          <button onClick={() => setPage(1)} className="btn-dark" style={{ fontSize: 13 }}>Coba Lagi</button>
        </div>
      )}

      {/* Empty state */}
      {!query && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <MdSearch size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Ketikkan kata kunci di search bar</p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (tab === 'posts' ? posts : users).length === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* No results */}
      {!loading && query && !error && tab === 'posts' && posts.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <MdSearch size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Tidak ada postingan</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 5 }}>Coba kata kunci berbeda atau cari penjual</p>
        </div>
      )}
      {!loading && query && !error && tab === 'users' && users.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <MdPerson size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Penjual tidak ditemukan</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 5 }}>Coba kata kunci berbeda</p>
        </div>
      )}

      {/* Posts grid */}
      {tab === 'posts' && posts.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {posts.map((p) => <PostCard key={p._id} post={p} onUpdate={updatePost} />)}
          </div>
          {hasMore && (
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => setPage((p) => p + 1)} disabled={loading} className="btn-secondary" style={{ minWidth: 180 }}>
                {loading ? 'Memuat…' : 'Muat Lebih Banyak'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Users grid */}
      {tab === 'users' && users.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {users.map((u) => <UserCard key={u._id} user={u} />)}
        </div>
      )}
    </div>
  )
}
