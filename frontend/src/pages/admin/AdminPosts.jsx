import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdCheckCircle, MdCancel, MdOpenInNew, MdSearch, MdDelete } from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

function ReasonModal({ title, description, placeholder, confirmLabel, confirmClass, value, onChange, onClose, onConfirm, loading, requireReason = true }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="card w-full sm:max-w-md p-6 shadow-xl animate-scale-in rounded-b-none sm:rounded-2xl">
        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">{title}</h2>
        <p className="text-sm text-neutral-400 mb-4">{description}</p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input resize-none min-h-[80px] mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
          <button
            onClick={onConfirm}
            disabled={(requireReason && !value.trim()) || loading}
            className={`flex-1 btn py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPosts() {
  const [posts, setPosts]       = useState([])
  const [loading, setL]         = useState(true)
  const [tab, setTab]           = useState('pending')
  const [search, setSearch]     = useState('')
  const [reject, setReject]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [processing, setProc]   = useState(null)

  const load = async () => {
    setL(true)
    try {
      const params = { status: tab, limit: 50 }
      if (search) params.search = search
      const { data } = await api.get('/admin/posts', { params })
      setPosts(data.posts || data || [])
    } catch { setPosts([]) }
    finally  { setL(false) }
  }

  useEffect(() => { load() }, [tab, search])

  const approve = async (id) => {
    setProc(id)
    try {
      await api.post(`/admin/posts/${id}/approve`)
      setPosts((p) => p.filter((x) => x._id !== id))
      toast.success('Postingan disetujui')
    } catch { toast.error('Gagal menyetujui') }
    finally  { setProc(null) }
  }

  const doReject = async () => {
    if (!reject) return
    setProc(reject.id)
    try {
      await api.post(`/admin/posts/${reject.id}/reject`, { reason: reject.reason })
      setPosts((p) => p.filter((x) => x._id !== reject.id))
      setReject(null)
      toast.success('Postingan ditolak')
    } catch { toast.error('Gagal menolak') }
    finally  { setProc(null) }
  }

  const doDelete = async () => {
    if (!deleteTarget || !deleteReason.trim()) return
    setProc(deleteTarget)
    try {
      await api.delete(`/admin/posts/${deleteTarget}`, { data: { reason: deleteReason.trim() } })
      setPosts((p) => p.filter((x) => x._id !== deleteTarget))
      setDeleteTarget(null)
      setDeleteReason('')
      toast.success('Postingan dihapus')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus')
    } finally  { setProc(null) }
  }

  const openDelete = (id) => {
    setDeleteTarget(id)
    setDeleteReason('')
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Kelola Postingan</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Tinjau, setujui, tolak, atau hapus postingan</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full sm:max-w-sm">
          <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" size={16} />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul, penjual…"
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['pending', 'approved', 'rejected'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all
                ${tab === t
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
            >
              {t === 'pending' ? 'Menunggu' : t === 'approved' ? 'Aktif' : 'Ditolak'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-24 sm:h-16 skeleton" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="card flex flex-col items-center py-14 text-center">
          <p className="text-sm text-neutral-400">
            {tab === 'pending' ? 'Tidak ada postingan yang perlu ditinjau' : 'Tidak ada postingan'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div key={post._id} className="card p-3.5 admin-post-row">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-14 h-10 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0">
                  {post.images?.[0]
                    ? <img src={post.images[0]} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">—</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{post.title}</p>
                    <span className="text-sm font-bold text-accent-600 dark:text-accent-400 shrink-0">{fmt(post.price)}</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    @{post.seller?.username} · {post.gameCategory} ·{' '}
                    {post.createdAt && formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: localeId })}
                  </p>
                  {post.rejectionReason && tab === 'rejected' && (
                    <p className="text-xs text-red-500 mt-1 line-clamp-2">{post.rejectionReason}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0 sm:justify-end">
                <Link
                  to={`/post/${post._id}`} target="_blank"
                  className="btn-icon w-8 h-8 rounded-xl"
                  title="Lihat"
                >
                  <MdOpenInNew size={15} />
                </Link>
                {tab === 'pending' && (
                  <>
                    <button
                      onClick={() => approve(post._id)}
                      disabled={processing === post._id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <MdCheckCircle size={13} /> Setujui
                    </button>
                    <button
                      onClick={() => setReject({ id: post._id, reason: '' })}
                      disabled={processing === post._id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <MdCancel size={13} /> Tolak
                    </button>
                  </>
                )}
                <button
                  onClick={() => openDelete(post._id)}
                  disabled={processing === post._id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <MdDelete size={13} /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reject && (
        <ReasonModal
          title="Tolak Postingan"
          description="Berikan alasan agar penjual dapat memperbaiki postingannya."
          placeholder="Alasan penolakan (opsional)…"
          confirmLabel="Tolak Postingan"
          confirmClass="bg-amber-500 hover:bg-amber-600"
          value={reject.reason}
          onChange={(v) => setReject({ ...reject, reason: v })}
          onClose={() => setReject(null)}
          onConfirm={doReject}
          loading={!!processing}
          requireReason={false}
        />
      )}

      {deleteTarget && (
        <ReasonModal
          title="Hapus Postingan"
          description="Postingan akan dihapus permanen. Penjual akan menerima notifikasi beserta alasan."
          placeholder="Alasan penghapusan (wajib)…"
          confirmLabel="Hapus Postingan"
          confirmClass="bg-red-500 hover:bg-red-600"
          value={deleteReason}
          onChange={setDeleteReason}
          onClose={() => { setDeleteTarget(null); setDeleteReason('') }}
          onConfirm={doDelete}
          loading={!!processing}
        />
      )}
    </div>
  )
}
