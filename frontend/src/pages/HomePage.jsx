import React, { useEffect, useLayoutEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import PromoBanner from '../components/banners/PromoBanner'
import PostCard from '../components/common/PostCard'
import FilterBar from '../components/common/FilterBar'
import api from '../lib/api'

function SkeletonCard() {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e0e0e0',
        borderRadius: 18,
        overflow: 'hidden',
      }}
    >
      <div
        style={{ aspectRatio: '16/9' }}
        className="skeleton"
      />
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="skeleton" style={{ height: 16, width: '75%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 12, width: '50%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 12, width: '35%', borderRadius: 6, marginTop: 4 }} />
      </div>
    </div>
  )
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlSort = searchParams.get('sort') === 'popular' ? 'popular' : 'newest'

  const [posts, setPosts]   = useState([])
  const [loading, setL]     = useState(true)
  const [page, setPage]     = useState(1)
  const [hasMore, setMore]  = useState(true)
  const [error, setError]   = useState(null)
  const [filters, setFilters] = useState({
    sort: urlSort, minPrice: '', maxPrice: '', rank: '',
  })

  useLayoutEffect(() => {
    setFilters((f) => (f.sort === urlSort ? f : { ...f, sort: urlSort }))
    setPage(1)
  }, [urlSort])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setL(true)
      setError(null)
      try {
        const { data } = await api.get('/posts', {
          params: {
            page, limit: 12, sort: urlSort,
            ...(filters.minPrice && { minPrice: filters.minPrice }),
            ...(filters.maxPrice && { maxPrice: filters.maxPrice }),
            ...(filters.rank     && { sellerRank: filters.rank }),
          },
        })
        if (!cancelled) {
          setPosts(page === 1 ? data.posts : (prev) => [...prev, ...data.posts])
          setMore(data.hasMore)
        }
      } catch {
        if (!cancelled) {
          const msg = 'Gagal memuat postingan. Periksa koneksi Anda.'
          setError(msg)
          toast.error(msg)
          if (page === 1) setPosts([])
        }
      } finally {
        if (!cancelled) setL(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filters, page, urlSort])

  const handleFilterChange = (f) => {
    setFilters(f)
    setPage(1)
    if (f.sort === 'newest') setSearchParams({}, { replace: true })
    else setSearchParams({ sort: f.sort }, { replace: true })
  }

  const updatePost = (u) => setPosts((prev) => prev.map((p) => p._id === u._id ? u : p))
  const isTrending = filters.sort === 'popular'

  return (
    <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <PromoBanner />

      {/* Section header */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              fontSize: 28, fontWeight: 600, letterSpacing: '-0.374px',
              color: '#1d1d1f', lineHeight: 1.14, margin: 0,
            }}
          >
            {isTrending ? 'Trending' : 'Postingan Terbaru'}
          </h1>
          <p style={{ fontSize: 15, color: '#7a7a7a', marginTop: 5, letterSpacing: '-0.224px' }}>
            {isTrending ? 'Paling banyak dilihat saat ini' : 'Ditambahkan paling baru'}
          </p>
        </div>
        <FilterBar filters={filters} onChange={handleFilterChange} />
      </div>

      {error && page === 1 && !loading && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: 18,
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}
        >
          <p style={{ fontSize: 15, color: '#ff3b30', letterSpacing: '-0.224px' }}>{error}</p>
          <button
            onClick={() => setPage(1)}
            className="btn-dark"
            style={{ fontSize: 13, flexShrink: 0 }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {loading && posts.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          title="Belum ada postingan"
          sub="Jadilah yang pertama menjual akun game."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} onUpdate={updatePost} />
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="btn-secondary"
                style={{ minWidth: 180 }}
              >
                {loading ? 'Memuat…' : 'Muat Lebih Banyak'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EmptyState({ title, sub }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', paddingTop: 80, paddingBottom: 80,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56, height: 56, borderRadius: 18,
          backgroundColor: '#f5f5f7',
          border: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: '#7a7a7a' }}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </div>
      <p
        style={{
          fontSize: 17, fontWeight: 600, color: '#1d1d1f',
          letterSpacing: '-0.374px', marginBottom: 6,
        }}
      >
        {title}
      </p>
      {sub && (
        <p style={{ fontSize: 15, color: '#7a7a7a', letterSpacing: '-0.224px' }}>{sub}</p>
      )}
    </div>
  )
}
