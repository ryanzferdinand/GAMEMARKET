import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MdThumbUp, MdThumbDown, MdReply, MdSend } from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import UserBadge from './UserBadge'
import RoleName from './RoleName'
import useAuthStore from '../../store/authStore'
import api from '../../lib/api'
import { getAvatar } from '../../lib/avatar'
import toast from 'react-hot-toast'

const COMMENTS_LIMIT = 5

/* ── Single comment (recursive) ───────────────────────── */
function CommentItem({ comment, postId, onRefresh, depth = 0 }) {
  const { user }       = useAuthStore()
  const [reply, setReply]   = useState('')
  const [open, setOpen]     = useState(false)
  const [submitting, setSub] = useState(false)

  const myVote   = user && comment.votes?.find((v) => v.user === user._id)
  const upCount  = comment.votes?.filter((v) => v.type === 'up').length  || 0
  const dnCount  = comment.votes?.filter((v) => v.type === 'down').length || 0
  const score    = upCount - dnCount

  const handleVote = async (type) => {
    if (!user) return toast.error('Login untuk vote')
    try {
      await api.post(`/posts/${postId}/comments/${comment._id}/vote`, { type })
      onRefresh()
    } catch { toast.error('Gagal vote') }
  }

  const handleReply = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    setSub(true)
    try {
      await api.post(`/posts/${postId}/comments`, { content: reply, parentComment: comment._id })
      setReply('')
      setOpen(false)
      onRefresh()
    } catch { toast.error('Gagal mengirim') }
    finally  { setSub(false) }
  }

  return (
    <div className={depth > 0 ? 'ml-7 pl-4 border-l border-neutral-100 dark:border-neutral-800' : ''}>
      <div className="flex gap-3 py-3.5">
        <Link to={`/profile/${comment.author?.username}`} className="shrink-0 mt-0.5">
          <img
            src={getAvatar(comment.author?.avatar, comment.author?.username)}
            alt={comment.author?.username}
            className="w-7 h-7 rounded-full object-cover"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <RoleName
              username={comment.author?.username}
              role={comment.author?.role}
              linkTo={`/profile/${comment.author?.username}`}
              size="sm"
            />
            {comment.author?.role && <UserBadge role={comment.author.role} mini />}
            <span className="text-2xs text-neutral-400">
              {comment.createdAt && formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: localeId })}
            </span>
          </div>

          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
            {comment.content}
          </p>

          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => handleVote('up')}
              className={`flex items-center gap-1 text-xs transition-colors
                ${myVote?.type === 'up' ? 'text-accent-600 dark:text-accent-400' : 'text-neutral-400 hover:text-accent-500'}`}
            >
              <MdThumbUp size={13} /> {upCount}
            </button>
            <button
              onClick={() => handleVote('down')}
              className={`flex items-center gap-1 text-xs transition-colors
                ${myVote?.type === 'down' ? 'text-red-500' : 'text-neutral-400 hover:text-red-400'}`}
            >
              <MdThumbDown size={13} /> {dnCount}
            </button>
            <span className={`text-xs font-medium ${score > 0 ? 'text-emerald-500' : score < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
              {score > 0 ? `+${score}` : score}
            </span>
            {user && depth < 3 && (
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              >
                <MdReply size={13} /> Balas
              </button>
            )}
          </div>

          {open && (
            <form onSubmit={handleReply} className="mt-3 flex gap-2">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={`Balas @${comment.author?.username}…`}
                className="input text-xs py-2 flex-1"
                autoFocus
              />
              <button type="submit" disabled={submitting || !reply.trim()} className="btn-primary px-3 py-2">
                <MdSend size={13} />
              </button>
            </form>
          )}
        </div>
      </div>

      {comment.replies?.map((r) => (
        <CommentItem key={r._id} comment={r} postId={postId} onRefresh={onRefresh} depth={depth + 1} />
      ))}
    </div>
  )
}

/* ── CommentSection root ───────────────────────────────── */
export default function CommentSection({ postId, commentCount = 0, postStatus = 'approved', isOwner = false }) {
  const { user }       = useAuthStore()
  const [text, setText]     = useState('')
  const [submitting, setSub] = useState(false)
  const [comments, setComments] = useState([])
  const [total, setTotal] = useState(commentCount)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Comments are open on approved posts for everyone (including owner).
  // Pending/sold posts: read-only.
  const canComment = user && postStatus === 'approved'

  const fetchComments = useCallback(async (pageNum, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const { data } = await api.get(`/posts/${postId}/comments`, {
        params: { page: pageNum, limit: COMMENTS_LIMIT },
      })
      setComments((prev) => append ? [...prev, ...(data.comments || [])] : (data.comments || []))
      setTotal(data.total ?? 0)
      setHasMore(data.hasMore ?? false)
      setPage(pageNum)
    } catch {
      toast.error('Gagal memuat komentar')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [postId])

  useEffect(() => {
    setPage(1)
    fetchComments(1)
  }, [fetchComments])

  const refresh = () => fetchComments(1)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    if (!user) return toast.error('Login untuk berkomentar')
    if (postStatus !== 'approved') return toast.error('Komentar hanya tersedia pada postingan aktif')
    setSub(true)
    try {
      await api.post(`/posts/${postId}/comments`, { content: text })
      setText('')
      refresh()
    } catch { toast.error('Gagal mengirim komentar') }
    finally  { setSub(false) }
  }

  const countLabel = total || commentCount

  return (
    <div className="space-y-4">
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
        Komentar
        <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontWeight: 400 }}>({countLabel})</span>
      </h3>

      {canComment ? (
        <form onSubmit={handleSubmit} className="comment-compose" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <img src={getAvatar(user.avatar, user.username)} alt="You"
            style={{ width: 32, height: 32, borderRadius: 9999, flexShrink: 0, marginTop: 2, objectFit: 'cover' }} />
          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
            <input type="text" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Tulis komentar…" className="input-rect" style={{ flex: 1, height: 40, fontSize: 14 }} />
            <button type="submit" disabled={submitting || !text.trim()} className="btn-primary"
              style={{ padding: '8px 14px', fontSize: 14, flexShrink: 0, gap: 0 }}>
              <MdSend size={15} />
            </button>
          </div>
        </form>
      ) : user && postStatus !== 'approved' ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', borderRadius: 11, padding: '10px 14px' }}>
          Komentar tidak tersedia — postingan {postStatus === 'sold' ? 'sudah terjual' : 'sedang ditinjau'}
        </p>
      ) : (
        <p style={{ fontSize: 14, color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', borderRadius: 11, padding: '12px 16px' }}>
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Masuk</Link>
          {' '}untuk berkomentar
        </p>
      )}

      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {loading ? (
          <div className="space-y-3 py-4 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-7 h-7 rounded-full skeleton shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-24 rounded" />
                  <div className="skeleton h-3 w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-neutral-400 py-8 text-center">
            Belum ada komentar. Jadilah yang pertama.
          </p>
        ) : comments.map((c) => (
          <CommentItem key={c._id} comment={c} postId={postId} onRefresh={refresh} />
        ))}
      </div>

      {hasMore && (
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => fetchComments(page + 1, true)}
            disabled={loadingMore}
            className="btn-secondary text-sm"
            style={{ minWidth: 180 }}
          >
            {loadingMore ? 'Memuat…' : 'Muat Komentar Lainnya'}
          </button>
        </div>
      )}
    </div>
  )
}
