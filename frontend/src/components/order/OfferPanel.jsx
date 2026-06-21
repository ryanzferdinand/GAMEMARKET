/**
 * OfferPanel.jsx
 *
 * Panel tawar-menawar harga di dalam halaman detail pesanan.
 * Hanya aktif saat order.status === 'escrow_active'.
 *
 * Fitur:
 *  - Buat tawaran baru (dengan pesan opsional)
 *  - Lihat semua riwayat tawaran
 *  - Terima / Tolak tawaran yang masuk
 *  - Batalkan tawaran yang kita buat
 *  - Realtime update via socket event order:offer
 */

import { useEffect, useState, useRef } from 'react'
import {
  MdLocalOffer,
  MdCheck,
  MdClose,
  MdArrowUpward,
  MdArrowDownward,
  MdExpandMore,
  MdExpandLess,
} from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import api from '../../lib/api'
import { getSocket } from '../../lib/socket'
import toast from 'react-hot-toast'

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n || 0)

// Badge warna per status
const STATUS_BADGE = {
  pending:   { label: 'Menunggu',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  accepted:  { label: 'Diterima',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected:  { label: 'Ditolak',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400' },
}

export default function OfferPanel({ orderId, order, currentUserId, disabled }) {
  const [offers, setOffers]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [busy, setBusy]               = useState(null)   // offerId being actioned
  const [expanded, setExpanded]       = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [amount, setAmount]           = useState('')
  const [message, setMessage]         = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const amountRef = useRef(null)

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadOffers = async () => {
    try {
      const { data } = await api.get(`/orders/${orderId}/offers`)
      setOffers(data.offers || [])
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOffers() }, [orderId])

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket()
    const onOffer = ({ offer }) => {
      setOffers((prev) => {
        const idx = prev.findIndex((o) => o._id === offer._id)
        if (idx >= 0) {
          // update existing
          const next = [...prev]
          next[idx] = offer
          return next
        }
        // new offer — prepend
        return [offer, ...prev]
      })
    }
    socket?.on('order:offer', onOffer)
    return () => socket?.off('order:offer', onOffer)
  }, [])

  // ── Actions ───────────────────────────────────────────────────────────────
  const submitOffer = async (e) => {
    e.preventDefault()
    const parsed = Number(String(amount).replace(/\D/g, ''))
    if (!parsed || parsed <= 0) { toast.error('Masukkan nominal yang valid'); return }
    setSubmitting(true)
    try {
      await api.post(`/orders/${orderId}/offers`, { amount: parsed, message: message.trim() || undefined })
      toast.success('Tawaran terkirim')
      setShowForm(false)
      setAmount('')
      setMessage('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim tawaran')
    } finally { setSubmitting(false) }
  }

  const accept = async (offerId) => {
    setBusy(offerId)
    try {
      await api.post(`/orders/${orderId}/offers/${offerId}/accept`)
      toast.success('Tawaran diterima')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menerima tawaran')
    } finally { setBusy(null) }
  }

  const reject = async (offerId) => {
    setBusy(offerId)
    try {
      await api.post(`/orders/${orderId}/offers/${offerId}/reject`)
      toast('Tawaran ditolak', { icon: '↩️' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menolak tawaran')
    } finally { setBusy(null) }
  }

  const cancel = async (offerId) => {
    setBusy(offerId)
    try {
      await api.post(`/orders/${orderId}/offers/${offerId}/cancel`)
      toast('Tawaran dibatalkan', { icon: '✖' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membatalkan tawaran')
    } finally { setBusy(null) }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const pendingOffers = offers.filter((o) => o.status === 'pending')
  const hasPendingForMe = pendingOffers.some(
    (o) => o.offeredTo?._id?.toString() === currentUserId || o.offeredTo?.toString() === currentUserId,
  )
  const originalPrice = order?.amount || 0

  // Format input while typing (thousand separator, no prefix)
  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '')
    setAmount(raw ? Number(raw).toLocaleString('id-ID') : '')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MdLocalOffer size={16} className="text-accent-500" />
          Tawar Harga
          {hasPendingForMe && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-2xs font-bold">
              {pendingOffers.filter(
                (o) =>
                  o.offeredTo?._id?.toString() === currentUserId ||
                  o.offeredTo?.toString() === currentUserId,
              ).length}
            </span>
          )}
        </div>
        {expanded ? <MdExpandLess size={18} className="text-neutral-400" /> : <MdExpandMore size={18} className="text-neutral-400" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Disclaimer */}
          <p className="text-2xs text-neutral-400 leading-snug">
            Tawaran hanya bisa dibuat selama escrow aktif. Pihak lain harus menyetujui — tidak ada perubahan harga otomatis.
          </p>

          {/* New offer button / form */}
          {!disabled && (
            <>
              {!showForm ? (
                <button
                  type="button"
                  onClick={() => { setShowForm(true); setTimeout(() => amountRef.current?.focus(), 50) }}
                  className="btn-secondary text-sm w-full justify-center flex items-center gap-1"
                >
                  <MdLocalOffer size={14} />
                  Buat Tawaran Baru
                </button>
              ) : (
                <form onSubmit={submitOffer} className="space-y-2 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl p-3">
                  <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Tawaran Harga</p>

                  {/* Amount input */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 pointer-events-none">Rp</span>
                    <input
                      ref={amountRef}
                      type="text"
                      inputMode="numeric"
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder="0"
                      className="input w-full pl-9"
                      required
                    />
                  </div>

                  {/* Comparison with original */}
                  {amount && (() => {
                    const parsed = Number(String(amount).replace(/\D/g, ''))
                    if (!parsed) return null
                    const diff = parsed - originalPrice
                    const pct  = originalPrice > 0 ? ((Math.abs(diff) / originalPrice) * 100).toFixed(1) : 0
                    return (
                      <div className={`flex items-center gap-1 text-2xs font-medium ${diff < 0 ? 'text-emerald-600' : diff > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                        {diff < 0 ? <MdArrowDownward size={12} /> : diff > 0 ? <MdArrowUpward size={12} /> : null}
                        {diff === 0
                          ? 'Sama dengan harga asli'
                          : `${fmt(parsed)} (${diff < 0 ? '-' : '+'}${pct}% dari ${fmt(originalPrice)})`}
                      </div>
                    )
                  })()}

                  {/* Optional message */}
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Pesan opsional (maks 500 karakter)"
                    maxLength={500}
                    className="input w-full text-sm"
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setAmount(''); setMessage('') }}
                      className="btn-secondary text-xs flex-1 justify-center"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !amount}
                      className="btn-primary text-xs flex-1 justify-center"
                    >
                      {submitting ? 'Mengirim...' : 'Kirim Tawaran'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Offers list */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
              ))}
            </div>
          ) : offers.length === 0 ? (
            <p className="text-center text-sm text-neutral-400 py-3">Belum ada tawaran</p>
          ) : (
            <div className="space-y-2">
              {offers.map((offer) => {
                const isFromMe =
                  offer.offeredBy?._id?.toString() === currentUserId ||
                  offer.offeredBy?.toString() === currentUserId
                const isForMe =
                  offer.offeredTo?._id?.toString() === currentUserId ||
                  offer.offeredTo?.toString() === currentUserId

                const badge = STATUS_BADGE[offer.status] || STATUS_BADGE.pending
                const diff = offer.amount - originalPrice
                const pct  = originalPrice > 0 ? ((Math.abs(diff) / originalPrice) * 100).toFixed(1) : 0

                return (
                  <div
                    key={offer._id}
                    className={`rounded-xl border p-3 space-y-1.5 transition-colors ${
                      offer.status === 'pending' && isForMe
                        ? 'border-accent-300 bg-accent-50/40 dark:border-accent-700 dark:bg-accent-900/10'
                        : 'border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30'
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                          {fmt(offer.amount)}
                        </span>
                        {diff !== 0 && (
                          <span className={`text-2xs font-medium flex items-center gap-0.5 ${diff < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {diff < 0 ? <MdArrowDownward size={11} /> : <MdArrowUpward size={11} />}
                            {pct}%
                          </span>
                        )}
                      </div>
                      <span className={`text-2xs px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-2xs text-neutral-400">
                      <span>
                        {isFromMe ? '📤 Tawaran Anda' : `📥 dari ${offer.offeredBy?.username || '?'}`}
                      </span>
                      <span>
                        {formatDistanceToNow(new Date(offer.createdAt), { addSuffix: true, locale: localeId })}
                      </span>
                    </div>

                    {/* Optional message */}
                    {offer.message && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 italic">
                        "{offer.message}"
                      </p>
                    )}

                    {/* Action buttons — only for pending */}
                    {offer.status === 'pending' && (
                      <div className="flex gap-1.5 pt-0.5">
                        {isForMe && (
                          <>
                            <button
                              type="button"
                              disabled={busy === offer._id}
                              onClick={() => accept(offer._id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              <MdCheck size={13} />
                              Terima
                            </button>
                            <button
                              type="button"
                              disabled={busy === offer._id}
                              onClick={() => reject(offer._id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                            >
                              <MdClose size={13} />
                              Tolak
                            </button>
                          </>
                        )}
                        {isFromMe && (
                          <button
                            type="button"
                            disabled={busy === offer._id}
                            onClick={() => cancel(offer._id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                          >
                            <MdClose size={13} />
                            Batalkan
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
