import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MdArrowBack, MdThumbUp, MdThumbDown, MdSend, MdReply } from 'react-icons/md'
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

// ── Optimistic vote helpers ─────────────────────────────────────────────────

function applyOptimisticVote(votes = [], userId, type) {
  const existing = votes.find((v) => v.user?.toString() === userId?.toString())
  if (existing?.type === type) {
    // toggle off — same type clicked again
    return votes.filter((v) => v.user?.toString() !== userId?.toString())
  }
  if (existing) {
    // switch type
    return votes.map((v) =>
      v.user?.toString() === userId?.toString() ? { ...v, type } : v,
    )
  }
  // new vote
  return [...votes, { user: userId, type }]
}

function applyVoteToReplyTree(replies, targetId, userId, type) {
  return replies.map((r) => {
    if (r._id === targetId) {
      return { ...r, votes: applyOptimisticVote(r.votes, userId, type) }
    }
    if (r.replies?.length) {
      return { ...r, replies: applyVoteToReplyTree(r.replies, targetId, userId, type) }
    }
    return r
  })
}

/* ── Reply item (recursive) ────────────────────────────── */
function ReplyItem({ reply, threadId, onVote, onRefresh, depth = 0 }) {
  const { user }        = useAuthStore()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sub, setSub]   = useState(false)
  const [voting, setVoting] = useState(false)

  const myVote = user && reply.votes?.find((v) => v.user?.toString() === user._id?.toString())
  const score  = reply.votes?.reduce((a, v) => a + (v.type === 'up' ? 1 : -1), 0) || 0

  const vote = async (type) => {
    if (!user) return toast.error('Login untuk vote')
    if (voting) return
    setVoting(true)
    // Optimistic update first
    onVote(reply._id, user._id, type)
    try {
      await api.post(`/forum/${threadId}/replies/${reply._id}/vote`, { type })
      // Server succeeded — local state already correct
    } catch {
      toast.error('Gagal vote')
      // Rollback — re-apply same vote to invert optimistic change
      onVote(reply._id, user._id, type)
    } finally {
      setVoting(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setSub(true)
    try {
      await api.post(`/forum/${threadId}/replies`, { content: text, parentReply: reply._id })
      setText(''); setOpen(false); onRefresh()
    } catch { toast.error('Gagal mengirim') }
    finally  { setSub(false) }
  }

  return (
    <div className={depth > 0 ? 'ml-7 pl-4 border-l border-neutral-100 dark:border-neutral-800' : ''}>
      <div className="flex gap-3 py-4">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
          <button
            onClick={() => vote('up')}
            disabled={voting}
            className={`p-0.5 rounded transition-colors ${myVote?.type === 'up' ? 'text-accent-600' : 'text-neutral-300 hover:text-accent-500'}`}
          >
            <MdThumbUp size={13} />
          </button>
          <span className={`text-2xs font-bold tabular-nums ${score > 0 ? 'text-emerald-500' : score < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
            {score}
          </span>
          <button
            onClick={() => vote('down')}
            disabled={voting}
            className={`p-0.5 rounded transition-colors ${myVote?.type === 'down' ? 'text-red-500' : 'text-neutral-300 hover:text-red-400'}`}
          >
            <MdThumbDown size={13} />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <img
              src={getAvatar(reply.author?.avatar, reply.author?.username)}
              className="w-5 h-5 rounded-full object-cover"
              alt=""
            />
            <RoleName username={reply.author?.username} role={reply.author?.role} size="sm"
              linkTo={`/profile/${reply.author?.username}`} />
            {reply.author?.role && <UserBadge role={reply.author.role} mini />}
            <span className="text-2xs text-neutral-400">
              {reply.createdAt && formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true, locale: localeId })}
            </span>
          </div>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
            <MentionText text={reply.content} />
          </p>
          {user && depth < 3 && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 mt-2 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              <MdReply size={13} /> Balas
            </button>
          )}
          {open && (
            <form onSubmit={submit} className="mt-2.5 flex gap-2">
              <MentionInput
                value={text}
                onChange={setText}
                placeholder={`Balas @${reply.author?.username}…`}
                className="input text-xs py-2 flex-1"
                autoFocus
              />
              <button type="submit" disabled={sub} className="btn-accent px-3 py-2">
                <MdSend size={13} />
              </button>
            </form>
          )}
        </div>
      </div>
      {reply.replies?.map((r) => (
        <ReplyItem key={r._id} reply={r} threadId={threadId} onVote={onVote} onRefresh={onRefresh} depth={depth + 1} />
      ))}
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────── */
export default function ForumDetailPage() {
  const { id }   = useParams()
  const nav      = useNavigate()
  const { user } = useAuthStore()
  const [thread, setThread]   = useState(null)
  const [replies, setReplies] = useState([])
  const [replyTotal, setReplyTotal] = useState(0)
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setL]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [text, setText]       = useState('')
  const [sub, setSub]         = useState(false)
  const [votingThread, setVotingThread] = useState(false)

  const load = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true)
    else setL(true)
    try {
      const { data } = await api.get(`/forum/${id}`, { params: { page: pageNum, limit: 5 } })
      if (!append) setThread(data.thread)
      setReplies((prev) => append ? [...prev, ...(data.replies || [])] : (data.replies || []))
      setReplyTotal(data.replyTotal ?? data.replies?.length ?? 0)
      setHasMore(data.replyHasMore ?? false)
      setPage(pageNum)
    } catch {
      if (!append) { toast.error('Thread tidak ditemukan'); nav('/forum') }
    } finally {
      setL(false)
      setLoadingMore(false)
    }
  }, [id, nav])

  useEffect(() => {
    setPage(1)
    load(1)
  }, [load])

  // ── Optimistic vote for the thread ─────────────────────────────────────
  const voteThread = async (type) => {
    if (!user) return toast.error('Login untuk vote')
    if (votingThread) return
    setVotingThread(true)
    // Apply optimistically
    setThread((t) => ({
      ...t,
      votes: applyOptimisticVote(t.votes || [], user._id, type),
    }))
    try {
      const { data } = await api.post(`/forum/${id}/vote`, { type })
      // Use server-authoritative votes on success
      setThread((t) => ({ ...t, votes: data.votes }))
    } catch {
      toast.error('Gagal vote')
      // Rollback
      setThread((t) => ({
        ...t,
        votes: applyOptimisticVote(t.votes || [], user._id, type),
      }))
    } finally {
      setVotingThread(false)
    }
  }

  // ── Optimistic vote for replies ────────────────────────────────────────
  const handleReplyVote = useCallback((replyId, userId, type) => {
    setReplies((prev) => applyVoteToReplyTree(prev, replyId, userId, type))
  }, [])

  const submitReply = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    if (!user) return toast.error('Login untuk membalas')
    setSub(true)
    try {
      await api.post(`/forum/${id}/replies`, { content: text })
      setText(''); load(1)
    } catch { toast.error('Gagal mengirim') }
    finally  { setSub(false) }
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="skeleton h-5 w-28 rounded" />
      <div className="skeleton h-32 rounded-2xl" />
    </div>
  )
  if (!thread) return null

  const score    = thread.votes?.reduce((a, v) => a + (v.type === 'up' ? 1 : -1), 0) || 0
  const myVote   = user && thread.votes?.find((v) => v.user?.toString() === user._id?.toString())
  const topLevel = replies.filter((r) => !r.parentReply)

  return (
    <div className="space-y-5 animate-fade-up">
      <button
        onClick={() => nav('/forum')}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
      >
        <MdArrowBack size={16} /> Forum
      </button>

      {/* Thread */}
      <div className="card p-5 flex gap-4">
        <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
          <button
            onClick={() => voteThread('up')}
            disabled={votingThread}
            className={`p-1.5 rounded-xl transition-all ${myVote?.type === 'up' ? 'bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400' : 'text-neutral-300 hover:text-accent-500 hover:bg-accent-50 dark:hover:bg-accent-950/20'}`}
          >
            <MdThumbUp size={17} />
          </button>
          <span className={`text-sm font-bold tabular-nums ${score > 0 ? 'text-emerald-500' : score < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
            {score}
          </span>
          <button
            onClick={() => voteThread('down')}
            disabled={votingThread}
            className={`p-1.5 rounded-xl transition-all ${myVote?.type === 'down' ? 'bg-red-50 text-red-500 dark:bg-red-950/40' : 'text-neutral-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20'}`}
          >
            <MdThumbDown size={17} />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-100 leading-snug mb-2">
            {thread.title}
          </h1>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line mb-4">
            <MentionText text={thread.content} />
          </p>
          <div className="flex items-center gap-3 text-xs text-neutral-400 flex-wrap">
            <div className="flex items-center gap-1.5">
              <img src={getAvatar(thread.author?.avatar, thread.author?.username)} className="w-4 h-4 rounded-full object-cover" alt="" />
              <RoleName username={thread.author?.username} role={thread.author?.role} size="xs"
                linkTo={`/profile/${thread.author?.username}`} />
              {thread.author?.role && <UserBadge role={thread.author.role} mini />}
            </div>
            <span>{thread.createdAt && formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true, locale: localeId })}</span>
            <span>{replyTotal || replies.length} balasan</span>
          </div>
        </div>
      </div>

      {/* Reply form */}
      {user && (
        <div className="card p-4">
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">Tulis Balasan</p>
          <form onSubmit={submitReply} className="flex gap-3">
            <img src={getAvatar(user.avatar, user.username)} className="w-8 h-8 rounded-full shrink-0 mt-0.5 object-cover" alt="" />
            <div className="flex-1 flex gap-2">
              <MentionInput
                multiline
                value={text}
                onChange={setText}
                placeholder="Tulis balasan Anda… Ketik @username untuk tag user"
                className="input resize-none min-h-[72px] flex-1"
              />
              <button type="submit" disabled={sub || !text.trim()} className="btn-accent px-3 self-start">
                <MdSend size={15} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Replies */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
          {replyTotal || replies.length} Balasan
        </p>
        {topLevel.length === 0 ? (
          <p className="text-xs text-neutral-400 py-8 text-center">Belum ada balasan. Jadilah yang pertama.</p>
        ) : (
          <>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {topLevel.map((r) => (
                <ReplyItem
                  key={r._id}
                  reply={r}
                  threadId={id}
                  onVote={handleReplyVote}
                  onRefresh={() => load(1)}
                  depth={0}
                />
              ))}
            </div>
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={() => load(page + 1, true)}
                  disabled={loadingMore}
                  className="btn-secondary text-sm"
                  style={{ minWidth: 180 }}
                >
                  {loadingMore ? 'Memuat…' : 'Muat Balasan Lainnya'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
