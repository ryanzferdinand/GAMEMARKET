import React, { useEffect, useState } from 'react'

import { Link } from 'react-router-dom'

import { MdAdd, MdDelete, MdOpenInNew, MdCheckCircleOutline, MdSchedule, MdCancel, MdSell, MdEdit } from 'react-icons/md'

import { formatDistanceToNow } from 'date-fns'

import { id as localeId } from 'date-fns/locale'

import api from '../lib/api'

import { getImageUrl } from '../lib/avatar'

import useAuthStore from '../store/authStore'

import CategoryBadge from '../components/common/CategoryBadge'

import toast from 'react-hot-toast'



const STATUS = {

  pending:  { label: 'Menunggu',  cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', icon: MdSchedule },

  approved: { label: 'Aktif',     cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', icon: MdCheckCircleOutline },

  rejected: { label: 'Ditolak',   cls: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400', icon: MdCancel },

  sold:     { label: 'Terjual',   cls: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400', icon: MdSell },

}



const TABS = ['all', 'pending', 'approved', 'sold', 'rejected']



const fmt = (n) =>

  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)



export default function MyPostsPage() {

  const [posts, setPosts]   = useState([])

  const [loading, setL]     = useState(true)

  const [loadingMore, setLoadingMore] = useState(false)

  const [page, setPage]     = useState(1)

  const [hasMore, setHasMore] = useState(false)

  const [tab, setTab]       = useState('all')

  const [deleting, setDel]  = useState(null)

  const { updateUser } = useAuthStore()



  const load = async (pageNum = 1, append = false) => {

    if (append) setLoadingMore(true)

    else setL(true)

    try {

      const params = { myPosts: true, page: pageNum, limit: 12 }

      if (tab !== 'all') params.status = tab

      const { data } = await api.get('/posts', { params })

      setPosts((prev) => append ? [...prev, ...(data.posts || [])] : (data.posts || []))

      setHasMore(data.hasMore ?? false)

      setPage(pageNum)

    } catch { toast.error('Gagal memuat') }

    finally {

      setL(false)

      setLoadingMore(false)

    }

  }



  useEffect(() => {

    setPage(1)

    load(1)

  }, [tab])



  const del = async (id) => {

    if (!window.confirm('Hapus postingan ini?')) return

    setDel(id)

    try {

      await api.delete(`/posts/${id}`)

      setPosts((prev) => prev.filter((p) => p._id !== id))

      toast.success('Postingan dihapus')

    } catch { toast.error('Gagal menghapus') }

    finally  { setDel(null) }

  }



  const markSold = async (id) => {

    try {

      const { data } = await api.patch(`/posts/${id}`, { status: 'sold' })

      setPosts((prev) => prev.map((p) => p._id === id ? { ...p, status: 'sold' } : p))

      const newTotalSales = data.post?.seller?.totalSales

      if (newTotalSales !== undefined) {

        updateUser({ totalSales: newTotalSales })

      }

      toast.success('Ditandai terjual')

    } catch (err) {

      const status = err.response?.status

      const msg = err.response?.data?.message

      const orderId = err.response?.data?.orderId

      if (status === 409 && orderId) {

        toast.error('Tidak bisa ditandai terjual — ada pesanan escrow aktif. Selesaikan pesanan terlebih dahulu.')

      } else {

        toast.error(msg || 'Gagal mengupdate')

      }

    }

  }



  return (

    <div className="space-y-4 sm:space-y-5 animate-fade-up">

      {/* Header */}

      <div className="my-posts-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Postingan Saya</h1>

          <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">Kelola semua postingan akun game Anda</p>

        </div>

        <Link to="/create-post" className="btn-accent gap-1.5 w-full sm:w-auto justify-center">

          <MdAdd size={16} /> Buat Baru

        </Link>

      </div>



      {/* Tabs */}

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">

        {TABS.map((t) => (

          <button

            key={t}

            onClick={() => setTab(t)}

            className={`shrink-0 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 capitalize

              ${tab === t

                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'

                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700'

              }`}

          >

            {t === 'all' ? 'Semua' : STATUS[t]?.label || t}

          </button>

        ))}

      </div>



      {/* List */}

      {loading ? (

        <div className="space-y-2.5">

          {Array.from({ length: 3 }).map((_, i) => (

            <div key={i} className="card p-3 sm:p-4 flex gap-3 animate-pulse">

              <div className="w-16 h-12 sm:w-20 sm:h-14 skeleton rounded-xl shrink-0" />

              <div className="flex-1 space-y-2">

                <div className="skeleton h-4 w-3/4 rounded" />

                <div className="skeleton h-3 w-1/3 rounded" />

              </div>

            </div>

          ))}

        </div>

      ) : posts.length === 0 ? (

        <div className="card flex flex-col items-center py-16 text-center">

          <p className="text-sm font-semibold text-neutral-500 mb-1">Tidak ada postingan</p>

          <p className="text-xs text-neutral-400 mb-4">

            {tab === 'all' ? 'Anda belum memiliki postingan.' : `Tidak ada postingan dengan status "${STATUS[tab]?.label || tab}".`}

          </p>

          {tab === 'all' && (

            <Link to="/create-post" className="btn-accent gap-1.5 text-sm">

              <MdAdd size={15} /> Buat Postingan

            </Link>

          )}

        </div>

      ) : (

        <div className="space-y-2.5">

          {posts.map((post) => {

            const s = STATUS[post.status] || STATUS.pending

            const Icon = s.icon



            return (

              <div key={post._id} className="my-post-item card p-3 sm:p-3.5">

                {/* Top row: thumbnail + info */}

                <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">

                  <Link to={`/post/${post._id}`} className="shrink-0">

                    <div className="w-16 h-12 sm:w-20 sm:h-14 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">

                      {post.images?.[0]

                        ? <img src={getImageUrl(post.images[0])} alt="" className="w-full h-full object-cover" />

                        : <div className="w-full h-full flex items-center justify-center text-neutral-400">

                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">

                              <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>

                            </svg>

                          </div>

                      }

                    </div>

                  </Link>



                  <div className="flex-1 min-w-0">

                    <div className="flex items-start justify-between gap-2">

                      <Link to={`/post/${post._id}`} className="min-w-0 flex-1">

                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2 sm:truncate hover:text-accent-600 dark:hover:text-accent-400 transition-colors">

                          {post.title}

                        </p>

                      </Link>

                      <span className="text-xs sm:text-sm font-bold text-accent-600 dark:text-accent-400 whitespace-nowrap shrink-0">

                        {fmt(post.price)}

                      </span>

                    </div>



                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">

                      {post.gameCategoryId && (

                        <span className="flex items-center gap-1">

                          <CategoryBadge

                            id={post.gameCategoryId}

                            icon={post.gameIcon}

                            name={post.gameCategory}

                            color={post.gameCategoryColor}

                            size="xs"

                          />

                          <span className="text-2xs text-neutral-400 hidden xs:inline truncate max-w-[80px] sm:max-w-none">

                            {post.gameCategory}

                          </span>

                        </span>

                      )}

                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium ${s.cls}`}>

                        <Icon size={11} />

                        {s.label}

                      </span>

                      <span className="text-2xs text-neutral-400 hidden sm:inline">

                        {post.createdAt && formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: localeId })}

                      </span>

                      <span className="text-2xs text-neutral-400">{post.views || 0} tayangan</span>

                    </div>



                    {post.status === 'rejected' && post.rejectionReason && (

                      <p className="text-xs text-red-500 mt-1 line-clamp-2">Alasan: {post.rejectionReason}</p>

                    )}

                  </div>

                </div>



                {/* Actions — full-width row on mobile */}

                <div className="my-post-actions flex items-center gap-1.5 sm:gap-2 mt-2.5 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 flex-wrap">

                  {post.status !== 'sold' && (

                    <Link to={`/edit-post/${post._id}`} className="btn-ghost py-1.5 px-2.5 text-2xs gap-1 flex-1 sm:flex-none justify-center">

                      <MdEdit size={12} /> Edit

                    </Link>

                  )}

                  {post.status === 'approved' && (

                    <button

                      onClick={() => markSold(post._id)}

                      className="text-2xs px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-medium transition-colors flex-1 sm:flex-none text-center"

                    >

                      Tandai Terjual

                    </button>

                  )}

                  <Link to={`/post/${post._id}`} className="btn-ghost py-1.5 px-2.5 text-2xs gap-1 flex-1 sm:flex-none justify-center">

                    <MdOpenInNew size={11} /> Lihat

                  </Link>

                  <button

                    onClick={() => del(post._id)}

                    disabled={deleting === post._id}

                    className="btn-danger py-1.5 px-2.5 text-2xs gap-1 sm:ml-auto flex-1 sm:flex-none justify-center"

                  >

                    <MdDelete size={12} />

                    {deleting === post._id ? '…' : 'Hapus'}

                  </button>

                </div>

              </div>

            )

          })}

        </div>

      )}



      {!loading && hasMore && (

        <div className="text-center pt-2">

          <button

            type="button"

            onClick={() => load(page + 1, true)}

            disabled={loadingMore}

            className="btn-secondary w-full sm:w-auto"

            style={{ minWidth: 180 }}

          >

            {loadingMore ? 'Memuat…' : 'Muat Lebih Banyak'}

          </button>

        </div>

      )}

    </div>

  )

}

