import React, { useEffect, useLayoutEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import PostCard from '../components/common/PostCard'
import FilterBar from '../components/common/FilterBar'
import CategoryBadge from '../components/common/CategoryBadge'
import api from '../lib/api'
import { useCategories } from '../lib/useCategories'

function SkeletonCard() {
  return (
    <div className="card overflow-hidden">
      <div className="aspect-[16/9] skeleton" />
      <div className="p-3.5 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  )
}

export default function CategoryPage() {
  const { slug } = useParams()
  const { categories } = useCategories()
  const cat = categories.find((c) => c.id === slug)
  const [posts, setPosts] = useState([])
  const [loading, setL] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setMore] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ sort: 'newest', minPrice: '', maxPrice: '', rank: '' })

  useLayoutEffect(() => {
    setPage(1)
    setPosts([])
  }, [slug])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setL(true)
      setError(null)
      try {
        const { data } = await api.get('/posts', {
          params: {
            page, limit: 12, category: slug, sort: filters.sort,
            ...(filters.minPrice && { minPrice: filters.minPrice }),
            ...(filters.maxPrice && { maxPrice: filters.maxPrice }),
            ...(filters.rank && { sellerRank: filters.rank }),
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
  }, [slug, filters, page])

  const handleFilterChange = (f) => {
    setFilters(f)
    setPage(1)
  }

  const updatePost = (u) => setPosts((prev) => prev.map((p) => p._id === u._id ? u : p))

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="card p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
        <CategoryBadge cat={cat} size="lg" className="!w-12 !h-12 !text-xs" />
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {cat?.name || 'Kategori'}
          </h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {loading ? '…' : `${posts.length > 0 ? posts.length + '+' : 'Belum ada'} akun tersedia`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Semua Penawaran</p>
        <FilterBar filters={filters} onChange={handleFilterChange} />
      </div>

      {error && page === 1 && !loading && (
        <div className="card p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button onClick={() => setPage(1)} className="btn-secondary text-xs shrink-0">
            Coba Lagi
          </button>
        </div>
      )}

      {loading && posts.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <CategoryBadge cat={cat} size="xl" className="mb-3" />
          <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
            Belum ada akun {cat?.name}
          </p>
          <p className="text-xs text-neutral-400 mt-1">Jadilah penjual pertama di kategori ini</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} onUpdate={updatePost} />
            ))}
          </div>
          {hasMore && (
            <div className="text-center pt-2">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="btn-secondary px-8 py-2.5"
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
