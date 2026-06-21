import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdFavorite } from 'react-icons/md'
import PostCard from '../components/common/PostCard'
import api from '../lib/api'
import toast from 'react-hot-toast'

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

export default function WishlistPage() {
  const [posts, setPosts] = useState([])
  const [loading, setL] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    setL(true)
    api.get('/wishlist', { params: { page, limit: 12 } })
      .then(({ data }) => {
        if (!cancelled) {
          setPosts(page === 1 ? data.posts : (prev) => [...prev, ...data.posts])
          setMore(data.hasMore)
        }
      })
      .catch(() => { if (!cancelled) toast.error('Gagal memuat wishlist') })
      .finally(() => { if (!cancelled) setL(false) })
    return () => { cancelled = true }
  }, [page])

  const updatePost = (u) => setPosts((prev) => prev.map((p) => p._id === u._id ? u : p))
  const removePost = (id) => setPosts((prev) => prev.filter((p) => p._id !== id))

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Wishlist</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Akun game yang Anda simpan</p>
      </div>

      {loading && posts.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
            <MdFavorite size={24} className="text-neutral-400" />
          </div>
          <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">Wishlist kosong</p>
          <p className="text-xs text-neutral-400 mt-1 mb-4">Simpan postingan favorit dengan ikon hati</p>
          <Link to="/" className="btn-accent text-sm">Jelajahi Postingan</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <PostCard key={post._id} post={post} onUpdate={updatePost} onRemove={removePost} />
            ))}
          </div>
          {hasMore && (
            <div className="text-center pt-2">
              <button onClick={() => setPage((p) => p + 1)} disabled={loading} className="btn-secondary px-8 py-2.5">
                {loading ? 'Memuat…' : 'Muat Lebih Banyak'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
