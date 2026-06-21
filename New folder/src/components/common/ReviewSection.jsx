import React, { useEffect, useState, useCallback, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { MdReply, MdSend, MdEdit, MdClose, MdCheck } from 'react-icons/md'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import useRatingStore from '../../store/ratingStore'
import { getSocket } from '../../lib/socket'
import StarRating, { RatingBreakdown } from './StarRating'
import { getAvatar } from '../../lib/avatar'
import RoleName from './RoleName'

export default function ReviewSection({
  sellerId,
  sellerUsername,
  postId,
  isSellerView = false,
  onRatingUpdate,
}) {
  const { user } = useAuthStore()
  const cachedStats = useRatingStore((s) => s.cache[sellerId?.toString()])
  const setSellerRating = useRatingStore((s) => s.setSellerRating)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [myReview, setMyReview] = useState(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyingId, setReplyingId] = useState(null)

  // Edit state
  const [editingId, setEditingId] = useState(null)
  const [editRating, setEditRating] = useState(5)
  const [editComment, setEditComment] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Keep a stable ref for onRatingUpdate so it never causes load() to re-run
  const onRatingUpdateRef = useRef(onRatingUpdate)
  useEffect(() => { onRatingUpdateRef.current = onRatingUpdate }, [onRatingUpdate])

  // Track if we just submitted to suppress the socket echo
  const justSubmittedId = useRef(null)

  const normId = (id) => id?.toString?.() ?? id

  const applyStats = useCallback((stats) => {
    if (!stats) return
    setData((prev) => ({
      ...(prev || { reviews: [], total: 0 }),
      stats,
    }))
    setSellerRating(sellerId, stats)
    onRatingUpdateRef.current?.(stats)
  }, [sellerId, setSellerRating])

  const load = useCallback(async (pageNum = 1, append = false) => {
    if (!sellerUsername || !sellerId) return
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const [{ data: reviewData }, myRes] = await Promise.all([
        api.get(`/reviews/seller/${sellerUsername}`, { params: { page: pageNum, limit: 5 } }),
        pageNum === 1 && postId && user
          ? api.get(`/reviews/my/${postId}`).catch(() => ({ data: { review: null } }))
          : { data: { review: null } },
      ])
      setData((prev) => ({
        ...reviewData,
        reviews: append ? [...(prev?.reviews || []), ...(reviewData.reviews || [])] : (reviewData.reviews || []),
      }))
      setHasMore(reviewData.hasMore ?? false)
      setPage(pageNum)
      setSellerRating(sellerId, reviewData.stats)
      onRatingUpdateRef.current?.(reviewData.stats)
      if (pageNum === 1) setMyReview(myRes.data.review)
    } catch (err) {
      if (err?.response?.status !== 404) {
        toast.error('Gagal memuat review')
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sellerUsername, sellerId, postId, user?._id, setSellerRating])

  useEffect(() => { load() }, [load])

  // Sync from global rating cache (socket updates)
  useEffect(() => {
    if (cachedStats) {
      setData((prev) => (prev ? { ...prev, stats: cachedStats } : prev))
      onRatingUpdateRef.current?.(cachedStats)
    }
  }, [cachedStats])

  // Real-time: new/updated review for this seller
  useEffect(() => {
    const socket = getSocket()
    const onRatingUpdated = (payload) => {
      if (payload.userId !== sellerId?.toString()) return

      const nextStats = {
        rating: payload.rating,
        ratingCount: payload.ratingCount,
        breakdown: payload.breakdown,
      }
      setSellerRating(sellerId, nextStats)
      onRatingUpdateRef.current?.(nextStats)

      if (payload.review) {
        const incomingId = normId(payload.review._id)

        // If we just submitted/edited this review locally, skip — we already applied it
        if (justSubmittedId.current && normId(justSubmittedId.current) === incomingId) {
          justSubmittedId.current = null
          // Still update stats only
          setData((prev) => prev ? { ...prev, stats: nextStats } : prev)
          return
        }

        setData((prev) => {
          if (!prev) return prev
          const existsIdx = prev.reviews?.findIndex((r) => normId(r._id) === incomingId)
          if (existsIdx >= 0) {
            // Update existing review in list (edit by someone else)
            const updated = [...prev.reviews]
            updated[existsIdx] = payload.review
            return { ...prev, stats: nextStats, reviews: updated }
          }
          // New review from someone else
          return {
            ...prev,
            stats: nextStats,
            reviews: [payload.review, ...(prev.reviews || [])],
            total: (prev.total || 0) + 1,
          }
        })
      } else {
        setData((prev) => prev ? { ...prev, stats: nextStats } : prev)
      }
    }
    socket.on('rating:updated', onRatingUpdated)
    return () => socket.off('rating:updated', onRatingUpdated)
  }, [sellerId, setSellerRating])

  // ── Submit new review ──────────────────────────────────────────
  const submitReview = async (e) => {
    e.preventDefault()
    if (!user) return toast.error('Login untuk memberi review')
    setSubmitting(true)
    try {
      const { data: res } = await api.post('/reviews', {
        revieweeId: sellerId,
        postId: postId || undefined,
        rating,
        comment,
      })
      toast.success('Review berhasil dikirim')
      setComment('')
      setRating(5)
      setMyReview(res.review)

      // Mark this ID so the socket echo is ignored
      justSubmittedId.current = res.review._id

      // Apply locally — single source of truth
      setData((prev) => ({
        ...(prev || {}),
        stats: res.stats,
        reviews: [res.review, ...(prev?.reviews || [])],
        total: (prev?.total || 0) + 1,
      }))
      setSellerRating(sellerId, res.stats)
      onRatingUpdateRef.current?.(res.stats)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim review')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Start editing a review ─────────────────────────────────────
  const startEdit = (review) => {
    setEditingId(review._id)
    setEditRating(review.rating)
    setEditComment(review.comment || '')
    // Close reply form if open
    setReplyingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditRating(5)
    setEditComment('')
  }

  // ── Submit edited review ───────────────────────────────────────
  const submitEdit = async (reviewId) => {
    setEditSubmitting(true)
    try {
      const { data: res } = await api.patch(`/reviews/${reviewId}`, {
        rating: editRating,
        comment: editComment,
      })
      toast.success('Review diperbarui')

      // Mark this ID so the socket echo is ignored
      justSubmittedId.current = res.review._id

      // Update review in list locally
      setData((prev) => {
        if (!prev) return prev
        const updated = prev.reviews.map((r) =>
          r._id === reviewId ? res.review : r
        )
        return { ...prev, stats: res.stats, reviews: updated }
      })
      setSellerRating(sellerId, res.stats)
      onRatingUpdateRef.current?.(res.stats)

      // Sync myReview if this is the user's own
      if (myReview?._id === reviewId) setMyReview(res.review)

      cancelEdit()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui review')
    } finally {
      setEditSubmitting(false)
    }
  }

  // ── Submit seller reply ────────────────────────────────────────
  const submitReply = async (reviewId) => {
    if (!replyText.trim()) return
    try {
      await api.patch(`/reviews/${reviewId}/reply`, { reply: replyText })
      toast.success('Balasan terkirim')
      setReplyingId(null)
      setReplyText('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membalas')
    }
  }

  // ── Render ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 w-32 skeleton rounded" />
        <div className="h-20 skeleton rounded-xl" />
      </div>
    )
  }

  const stats = data?.stats || cachedStats
  const reviews = data?.reviews || []
  const canReview = user && user._id !== sellerId && !myReview && !isSellerView

  return (
    <div className="space-y-5">
      {/* Rating summary */}
      <div className="flex gap-6 flex-wrap">
        <div className="text-center">
          <p className="text-3xl font-bold text-neutral-900 dark:text-white tabular-nums">
            {stats?.rating ? stats.rating.toFixed(1) : '—'}
          </p>
          <StarRating value={stats?.rating || 0} readonly size={14} />
          <p className="text-2xs text-neutral-400 mt-1">{stats?.ratingCount || 0} review</p>
        </div>
        {(stats?.ratingCount || 0) > 0 && (
          <div className="flex-1 min-w-[160px] max-w-xs">
            <RatingBreakdown breakdown={stats.breakdown} total={stats.ratingCount} />
          </div>
        )}
      </div>

      {/* Write new review form */}
      {canReview && (
        <form onSubmit={submitReview} className="card p-4 space-y-3">
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Tulis Review</p>
          <StarRating value={rating} onChange={setRating} size={22} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ceritakan pengalaman transaksi Anda…"
            className="input resize-none min-h-[72px]"
            maxLength={1000}
          />
          <button type="submit" disabled={submitting} className="btn-accent text-sm gap-1.5">
            <MdSend size={14} />
            {submitting ? 'Mengirim…' : 'Kirim Review'}
          </button>
        </form>
      )}

      {/* Already reviewed indicator */}
      {myReview && !isSellerView && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          ✓ Anda sudah memberikan review ({myReview.rating}/5) — klik ikon edit pada review Anda untuk mengubahnya
        </p>
      )}

      {/* Review list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-6">Belum ada review</p>
      ) : (
        <>
          <div className="space-y-3">
            {reviews.map((r) => {
            const isOwner = user && r.reviewer?._id?.toString() === user._id?.toString()
            const isEditing = editingId === r._id

            return (
              <div key={r._id} className="card p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <img
                    src={getAvatar(r.reviewer?.avatar, r.reviewer?.username)}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <RoleName username={r.reviewer?.username} role={r.reviewer?.role} size="sm" />
                      {!isEditing && <StarRating value={r.rating} readonly size={12} />}
                      <span className="text-2xs text-neutral-400 ml-auto">
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: localeId })}
                      </span>
                      {/* Edit button — only visible to review owner */}
                      {isOwner && !isEditing && (
                        <button
                          onClick={() => startEdit(r)}
                          className="p-1 rounded-lg text-neutral-400 hover:text-accent-500 hover:bg-accent-50 dark:hover:bg-accent-950/20 transition-colors"
                          title="Edit review"
                        >
                          <MdEdit size={14} />
                        </button>
                      )}
                    </div>

                    {r.post?.title && (
                      <p className="text-2xs text-neutral-400 mt-0.5">Re: {r.post.title}</p>
                    )}

                    {/* Inline edit form */}
                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <StarRating value={editRating} onChange={setEditRating} size={20} />
                        <textarea
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                          placeholder="Ceritakan pengalaman transaksi Anda…"
                          className="input resize-none min-h-[64px] text-sm"
                          maxLength={1000}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => submitEdit(r._id)}
                            disabled={editSubmitting}
                            className="btn-accent text-xs py-1.5 px-3 gap-1"
                          >
                            <MdCheck size={13} />
                            {editSubmitting ? 'Menyimpan…' : 'Simpan'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={editSubmitting}
                            className="btn-secondary text-xs py-1.5 px-3 gap-1"
                          >
                            <MdClose size={13} /> Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      r.comment && (
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1.5 leading-relaxed">
                          {r.comment}
                        </p>
                      )
                    )}
                  </div>
                </div>

                {/* Seller reply */}
                {r.sellerReply && !isEditing && (
                  <div className="ml-11 pl-3 border-l-2 border-accent-200 dark:border-accent-800">
                    <p className="text-2xs font-semibold text-accent-600 dark:text-accent-400 mb-0.5">Balasan penjual</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">{r.sellerReply}</p>
                  </div>
                )}

                {/* Seller reply button */}
                {isSellerView && !r.sellerReply && !isEditing && replyingId !== r._id && (
                  <button
                    onClick={() => { setReplyingId(r._id); setEditingId(null) }}
                    className="ml-11 flex items-center gap-1 text-2xs text-neutral-400 hover:text-accent-500"
                  >
                    <MdReply size={13} /> Balas
                  </button>
                )}

                {replyingId === r._id && (
                  <div className="ml-11 flex gap-2">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Tulis balasan…"
                      className="input input-sm flex-1"
                      maxLength={500}
                      autoFocus
                    />
                    <button onClick={() => submitReply(r._id)} className="btn-accent px-3 text-xs">Kirim</button>
                    <button onClick={() => setReplyingId(null)} className="btn-secondary px-3 text-xs">Batal</button>
                  </div>
                )}
              </div>
            )
          })}
          </div>
          {hasMore && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => load(page + 1, true)}
                disabled={loadingMore}
                className="btn-secondary text-sm"
                style={{ minWidth: 180 }}
              >
                {loadingMore ? 'Memuat…' : 'Muat Review Lainnya'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
