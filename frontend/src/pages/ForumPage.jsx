import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdAdd, MdThumbUp, MdThumbDown, MdChatBubbleOutline, MdVisibility, MdPushPin } from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import UserBadge from '../components/common/UserBadge'
import RoleName from '../components/common/RoleName'
import MentionText from '../components/common/MentionText'
import MentionInput from '../components/common/MentionInput'
import api from '../lib/api'
import useAuthStore from '../store/authStore'
import { getAvatar } from '../lib/avatar'
import toast from 'react-hot-toast'

const CATS = [
  { id: 'all',          label: 'Semua' },
  { id: 'discussion',   label: 'Diskusi' },
  { id: 'tips',         label: 'Tips & Trik' },
  { id: 'review',       label: 'Review' },
  { id: 'question',     label: 'Pertanyaan' },
  { id: 'announcement', label: 'Pengumuman' },
]

function ThreadRow({ thread, onVote }) {
  const { user }  = useAuthStore()
  const myVote    = user && thread.votes?.find((v) => v.user?.toString() === user._id?.toString())
  const score     = thread.votes?.reduce((a, v) => a + (v.type === 'up' ? 1 : -1), 0) || 0
  const catLabel  = CATS.find((c) => c.id === thread.category)?.label || thread.category

  return (
    <div className="card-interactive p-4 flex gap-3.5">
      {/* Vote column */}
      <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
        <button
          onClick={(e) => { e.preventDefault(); onVote(thread._id, 'up') }}
          className={`p-1 rounded-lg transition-colors ${myVote?.type === 'up' ? 'text-accent-600' : 'text-neutral-300 hover:text-accent-500'}`}
        >
          <MdThumbUp size={15} />
        </button>
        <span className={`text-xs font-bold tabular-nums ${score > 0 ? 'text-emerald-500' : score < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
          {score}
        </span>
        <button
          onClick={(e) => { e.preventDefault(); onVote(thread._id, 'down') }}
          className={`p-1 rounded-lg transition-colors ${myVote?.type === 'down' ? 'text-red-500' : 'text-neutral-300 hover:text-red-400'}`}
        >
          <MdThumbDown size={15} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="px-2 py-0.5 text-2xs font-medium rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
            {catLabel}
          </span>
          {thread.isPinned && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-2xs font-medium rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
              <MdPushPin size={10} /> Pinned
            </span>
          )}
        </div>

        <Link to={`/forum/${thread._id}`}>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 hover:text-accent-600 dark:hover:text-accent-400 transition-colors leading-snug mb-1">
            {thread.title}
          </h3>
        </Link>
        <p className="text-xs text-neutral-400 line-clamp-2 mb-2.5">
          <MentionText text={thread.content} />
        </p>

        <div className="flex items-center gap-3 flex-wrap text-xs text-neutral-400">
          <div className="flex items-center gap-1.5">
            <img
              src={getAvatar(thread.author?.avatar, thread.author?.username)}
              className="w-4 h-4 rounded-full object-cover"
              alt=""
            />
            <RoleName username={thread.author?.username} role={thread.author?.role} size="xs" />
            {thread.author?.role && <UserBadge role={thread.author.role} mini />}
          </div>
          <span>{thread.createdAt && formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true, locale: localeId })}</span>
          <span className="flex items-center gap-1 ml-auto">
            <MdChatBubbleOutline size={12} /> {thread.replyCount || 0}
          </span>
          <span className="flex items-center gap-1">
            <MdVisibility size={12} /> {thread.views || 0}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function ForumPage() {
  const { user }      = useAuthStore()
  const [threads, setThreads] = useState([])
  const [loading, setL]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [cat, setCat]         = useState('all')
  const [modal, setModal]     = useState(false)
  const [newThread, setNew]   = useState({ title: '', content: '', category: 'discussion' })
  const [creating, setCreating] = useState(false)

  const load = async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true)
    else setL(true)
    try {
      const params = { page: pageNum, limit: 10 }
      if (cat !== 'all') params.category = cat
      const { data } = await api.get('/forum', { params })
      setThreads((prev) => append ? [...prev, ...(data.threads || [])] : (data.threads || []))
      setHasMore(data.hasMore ?? false)
      setPage(pageNum)
    } catch { if (!append) setThreads([]) }
    finally {
      setL(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    setPage(1)
    load(1)
  }, [cat])

  const handleVote = async (id, type) => {
    if (!user) return toast.error('Login untuk vote')
    try {
      const { data } = await api.post(`/forum/${id}/vote`, { type })
      setThreads((prev) => prev.map((t) => t._id === id ? { ...t, votes: data.votes } : t))
    } catch { toast.error('Gagal vote') }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newThread.title.trim()) return toast.error('Judul wajib diisi')
    if (!newThread.content.trim()) return toast.error('Konten wajib diisi')
    setCreating(true)
    try {
      await api.post('/forum', newThread)
      toast.success('Thread dibuat')
      setModal(false)
      setNew({ title: '', content: '', category: 'discussion' })
      load(1)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuat thread')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Forum</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Diskusi seputar jual beli akun game</p>
        </div>
        {user && (
          <button onClick={() => setModal(true)} className="btn-accent gap-1.5">
            <MdAdd size={16} /> Buat Thread
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150
              ${cat === c.id
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Threads */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2 animate-pulse">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
            <MdChatBubbleOutline size={24} className="text-neutral-400" />
          </div>
          <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">Belum ada diskusi</p>
          {user && (
            <button onClick={() => setModal(true)} className="btn-accent mt-4 gap-1.5">
              <MdAdd size={15} /> Mulai Diskusi
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {threads.map((t) => <ThreadRow key={t._id} thread={t} onVote={handleVote} />)}
          </div>
          {hasMore && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => load(page + 1, true)}
                disabled={loadingMore}
                className="btn-secondary"
                style={{ minWidth: 180 }}
              >
                {loadingMore ? 'Memuat…' : 'Muat Thread Lainnya'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 shadow-xl animate-scale-in">
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-4">Thread Baru</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="input-label">Kategori</label>
                <select value={newThread.category} onChange={(e) => setNew({ ...newThread, category: e.target.value })} className="input appearance-none cursor-pointer">
                  {CATS.filter((c) => c.id !== 'all').map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Judul</label>
                <input type="text" value={newThread.title} onChange={(e) => setNew({ ...newThread, title: e.target.value })} placeholder="Judul thread…" className="input" maxLength={150} />
              </div>
              <div>
                <label className="input-label">Konten</label>
                <MentionInput
                  multiline
                  value={newThread.content}
                  onChange={(content) => setNew({ ...newThread, content })}
                  placeholder="Tulis diskusi Anda… Ketik @username untuk tag user"
                  className="input resize-none min-h-[100px]"
                  maxLength={5000}
                />
                <p className="text-2xs text-neutral-400 mt-1">Ketik <span className="font-medium">@username</span> untuk men-tag user</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Batal</button>
                <button type="submit" disabled={creating} className="btn-accent flex-1">
                  {creating ? 'Mengirim…' : 'Buat Thread'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
