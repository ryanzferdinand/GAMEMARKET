import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MdArrowBack, MdSend, MdCheck, MdWarning, MdTimer, MdImage, MdClose, MdCancel, MdVisibility, MdVisibilityOff, MdContentCopy } from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import api from '../lib/api'
import useAuthStore from '../store/authStore'
import { getSocket } from '../lib/socket'
import { getAvatar, getImageUrl } from '../lib/avatar'
import toast from 'react-hot-toast'
import MentionInput from '../components/common/MentionInput'
import MentionText from '../components/common/MentionText'
import StarRating from '../components/common/StarRating'

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0)

const DISPUTE_REASONS = [
  { id: 'hackback', label: 'Hackback' },
  { id: 'wrong_account', label: 'Akun salah' },
  { id: 'banned_account', label: 'Akun banned' },
  { id: 'recovery_issue', label: 'Masalah recovery' },
  { id: 'description_mismatch', label: 'Tidak sesuai deskripsi' },
  { id: 'seller_inactive', label: 'Penjual tidak responsif' },
]

export default function OrderDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [order, setOrder] = useState(null)
  const [escrow, setEscrow] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgText, setMsgText] = useState('')
  const [imgPreview, setImgPreview] = useState(null) // { file, localUrl }
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showDeliver, setShowDeliver] = useState(false)
  const [showDispute, setShowDispute] = useState(false)
  const [delivery, setDelivery] = useState({ email: '', password: '', recovery: '', notes: '' })
  const [disputeForm, setDisputeForm] = useState({ reason: 'wrong_account', description: '' })
  const [countdown, setCountdown] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [ratingValue, setRatingValue] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const chatEnd = useRef(null)
  const fileRef = useRef(null)

  const load = async () => {
    try {
      const [{ data: orderData }, { data: msgData }] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/orders/${id}/messages`),
      ])
      setOrder(orderData.order)
      setEscrow(orderData.escrow)
      setMessages(msgData.messages)
    } catch {
      toast.error('Pesanan tidak ditemukan')
      nav('/orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    const socket = getSocket()
    socket?.emit('order:join', { orderId: id })

    const onMsg = (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev
        return [...prev, msg]
      })
    }

    const onCancelRequested = ({ orderId: oid, requestedBy }) => {
      if (oid !== id) return
      load()
      const currentUser = user
      if (requestedBy !== currentUser?._id?.toString()) {
        toast('Pihak lain meminta pembatalan pesanan', { icon: '⚠️' })
      }
    }

    const onCancelled = ({ orderId: oid }) => {
      if (oid !== id) return
      toast('Pesanan dibatalkan — saldo dikembalikan', { icon: 'ℹ️' })
      load()
    }

    const onOrderUpdated = ({ orderId: oid }) => {
      if (oid !== id) return
      load()
    }

    socket?.on('order:message', onMsg)
    socket?.on('order:cancel-requested', onCancelRequested)
    socket?.on('order:cancelled', onCancelled)
    socket?.on('order:updated', onOrderUpdated)
    return () => {
      socket?.emit('order:leave', { orderId: id })
      socket?.off('order:message', onMsg)
      socket?.off('order:cancel-requested', onCancelRequested)
      socket?.off('order:cancelled', onCancelled)
      socket?.off('order:updated', onOrderUpdated)
    }
  }, [id])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!order?.buyerCheckDeadline || order.status !== 'delivered') return
    const tick = () => {
      const diff = new Date(order.buyerCheckDeadline) - Date.now()
      setCountdown(diff > 0 ? diff : 0)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [order?.buyerCheckDeadline, order?.status])

  const isBuyer  = user?._id?.toString() === order?.buyer?._id?.toString()
  const isSeller = user?._id?.toString() === order?.seller?._id?.toString()
  const isClosed = order?.status === 'completed' || order?.status === 'refunded' || order?.status === 'cancelled'

  // Cancel request state
  const cancelRequestedBy = order?.cancelRequestedBy?.toString?.() ?? order?.cancelRequestedBy ?? null
  const myId = user?._id?.toString()
  const cancelPending   = Boolean(cancelRequestedBy)                   // someone requested
  const iRequestedCancel = cancelPending && cancelRequestedBy === myId  // it was me
  const theyRequestedCancel = cancelPending && cancelRequestedBy !== myId // other party wants to cancel

  const handleCancelRequest = async () => {
    if (!order) return
    const confirmMsg = theyRequestedCancel
      ? 'Pihak lain sudah meminta pembatalan. Setujui dan batalkan pesanan sekarang?'
      : 'Ajukan permintaan pembatalan? Pihak lain harus menyetujui agar pesanan dibatalkan.'
    if (!window.confirm(confirmMsg)) return
    setCancelling(true)
    try {
      const { data } = await api.post(`/orders/${id}/cancel`, { reason: 'Dibatalkan bersama' })
      if (data.cancelled) {
        toast.success('Pesanan dibatalkan — saldo dikembalikan')
        load()
      } else {
        toast('Permintaan batal dikirim — menunggu konfirmasi pihak lain', { icon: '⏳' })
        load()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengajukan pembatalan')
    } finally { setCancelling(false) }
  }

  const pickImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Maksimal 5MB'); return }
    setImgPreview({ file, localUrl: URL.createObjectURL(file) })
    e.target.value = ''
  }

  const cancelImage = () => {
    if (imgPreview) URL.revokeObjectURL(imgPreview.localUrl)
    setImgPreview(null)
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    const text = msgText.trim()
    if (!text && !imgPreview) return
    setBusy(true)

    try {
      let imageUrl = null

      // Upload image first if selected
      if (imgPreview) {
        setUploading(true)
        try {
          const fd = new FormData()
          fd.append('image', imgPreview.file)
          const { data: upData } = await api.post('/chat/upload-image', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          imageUrl = upData.url
        } catch {
          toast.error('Gagal upload gambar')
          setUploading(false)
          setBusy(false)
          return
        }
        setUploading(false)
        cancelImage()
      }

      const { data } = await api.post(`/orders/${id}/messages`, { content: text, imageUrl })

      // Add to local state immediately (socket may also fire — deduplicated by _id)
      setMessages((prev) => {
        if (prev.some((m) => m._id === data.message._id)) return prev
        return [...prev, data.message]
      })

      if (data.warnings?.length) toast.error(data.warnings[0])
      setMsgText('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal kirim pesan')
    } finally {
      setBusy(false)
    }
  }

  const handleDeliver = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post(`/orders/${id}/deliver`, delivery)
      toast.success('Akun berhasil dikirim')
      setShowDeliver(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal kirim')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await api.post(`/orders/${id}/confirm`)
      toast.success('Pesanan dikonfirmasi — escrow selesai')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal konfirmasi')
    } finally {
      setBusy(false)
    }
  }

  const handleDispute = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/disputes', { orderId: id, ...disputeForm })
      toast.success('Dispute dibuka — moderator akan ditugaskan')
      setShowDispute(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal buka dispute')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post(`/orders/${id}/review`, {
        rating: ratingValue,
        comment: ratingComment,
      })
      toast.success('Review berhasil dikirim')
      setShowRatingModal(false)
      setRatingComment('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim review')
    } finally {
      setBusy(false)
    }
  }

  const formatCountdown = (ms) => {
    if (ms <= 0) return 'Waktu habis'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${h}j ${m}m ${s}d`
  }

  if (loading) return <div className="skeleton h-96 rounded-xl animate-pulse" />
  if (!order) return null

  return (
    <div className="space-y-5 animate-fade-up max-w-3xl mx-auto">
      <button onClick={() => nav('/orders')} className="flex items-center gap-2 text-sm text-neutral-500">
        <MdArrowBack size={16} /> Kembali
      </button>

      {/* Order header */}
      <div className="card p-5 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-neutral-400">{order.orderNumber}</p>
            <h1 className="text-lg font-bold">{order.post?.title}</h1>
          </div>
          <p className="text-lg font-bold text-accent-600">{fmt(order.amount)}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 capitalize">{order.status.replace(/_/g, ' ')}</span>
          {escrow && <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/20">Escrow: {escrow.status}</span>}
          {countdown !== null && order.status === 'delivered' && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/20">
              <MdTimer size={12} /> {formatCountdown(countdown)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <div>
            <p className="text-2xs text-neutral-400">Pembeli</p>
            <Link to={`/profile/${order.buyer?.username}`} className="font-medium">{order.buyer?.username}</Link>
          </div>
          <div>
            <p className="text-2xs text-neutral-400">Penjual</p>
            <Link to={`/profile/${order.seller?.username}`} className="font-medium">{order.seller?.username}</Link>
          </div>
        </div>

        {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        {isSeller && order.status === 'escrow_active' && (
          <button onClick={() => setShowDeliver(true)} className="btn-primary text-sm">Kirim Akun</button>
        )}
        {isBuyer && order.status === 'delivered' && (
          <>
            <button onClick={handleConfirm} disabled={busy} className="btn-primary text-sm flex items-center gap-1">
              <MdCheck size={14} /> Konfirmasi
            </button>
            <button onClick={() => setShowDispute(true)} className="btn-secondary text-sm flex items-center gap-1 text-red-600">
              <MdWarning size={14} /> Buka Dispute
            </button>
          </>
        )}
        {isBuyer && order.status === 'completed' && !order.review && (
          <button onClick={() => setShowRatingModal(true)} className="btn-primary text-sm flex items-center gap-1">
            Beri Penilaian
          </button>
        )}
        {order.review && (
          <div className="w-full card p-4 mt-2">
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Penilaian Anda</p>
            <div className="flex items-center gap-2 mb-2">
              <StarRating value={order.review.rating} readonly size={16} />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">{order.review.rating}/5</span>
            </div>
            {order.review.comment && (
              <p className="text-sm text-neutral-700 dark:text-neutral-300">{order.review.comment}</p>
            )}
          </div>
        )}
          {/* Cancel — only on escrow_active, for both buyer and seller */}
          {(isBuyer || isSeller) && order.status === 'escrow_active' && (
            <button
              onClick={handleCancelRequest}
              disabled={cancelling || iRequestedCancel}
              className="btn-secondary text-sm flex items-center gap-1"
              style={{ color: '#ff3b30', borderColor: 'rgba(255,59,48,0.3)', marginLeft: 'auto' }}
            >
              <MdCancel size={14} />
              {cancelling
                ? 'Mengajukan...'
                : theyRequestedCancel
                ? 'Setujui Pembatalan'
                : iRequestedCancel
                ? 'Menunggu konfirmasi...'
                : 'Minta Batalkan'}
            </button>
          )}
        </div>

        {/* Cancel-request banner */}
        {cancelPending && order.status === 'escrow_active' && (
          <div style={{ padding: '10px 14px', borderRadius: 12, backgroundColor: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.25)', fontSize: 13 }}>
            {iRequestedCancel
              ? '⏳ Permintaan batal Anda dikirim — menunggu persetujuan pihak lain.'
              : '⚠️ Pihak lain meminta pembatalan pesanan. Klik "Setujui Pembatalan" untuk memproses.'}
          </div>
        )}

        {order.delivery?.deliveredAt && (
          <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-4 text-sm space-y-3">
            <p className="font-semibold text-emerald-700 mb-2">Detail Akun Dikirim</p>
            
            {/* Email */}
            {order.delivery.email && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-600 dark:text-neutral-400 w-20 shrink-0">Email:</span>
                <span className="flex-1 break-all">{order.delivery.email}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(order.delivery.email);
                    toast.success('Email disalin');
                  }}
                  className="text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                  <MdContentCopy size={16} />
                </button>
              </div>
            )}
            
            {/* Password */}
            {order.delivery.password && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-600 dark:text-neutral-400 w-20 shrink-0">Password:</span>
                <span className="flex-1 break-all font-mono">{showPassword ? order.delivery.password : '••••••••'}</span>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                  {showPassword ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(order.delivery.password);
                    toast.success('Password disalin');
                  }}
                  className="text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                  <MdContentCopy size={16} />
                </button>
              </div>
            )}
            
            {/* Recovery */}
            {order.delivery.recovery && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-600 dark:text-neutral-400 w-20 shrink-0">Recovery:</span>
                <span className="flex-1 break-all">{order.delivery.recovery}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(order.delivery.recovery);
                    toast.success('Recovery disalin');
                  }}
                  className="text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                  <MdContentCopy size={16} />
                </button>
              </div>
            )}
            
            {/* Notes */}
            {order.delivery.notes && (
              <div className="pt-2 border-t border-emerald-100 dark:border-emerald-800">
                <p className="text-neutral-600 dark:text-neutral-400 mb-1">Catatan:</p>
                <p className="text-neutral-800 dark:text-neutral-200">{order.delivery.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order chat */}
      <div className="card flex flex-col" style={{ height: 480 }}>
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
          <p className="text-sm font-semibold">Chat Pesanan</p>
          <p className="text-2xs text-neutral-400">Pesan permanen · tidak bisa edit/hapus · anti-fraud aktif</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => {
            const senderId = msg.sender?._id || msg.sender
            const isMe = senderId?.toString() === user?._id?.toString()
            const displayContent = msg.fraudDetected ? msg.maskedContent : msg.content

            return (
              <div key={msg._id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <img
                  src={getAvatar(msg.sender?.avatar, msg.sender?.username)}
                  alt=""
                  className="w-7 h-7 rounded-full shrink-0 object-cover"
                />
                <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <p className="text-2xs text-neutral-400 mb-0.5">{msg.sender?.username}</p>

                  {/* Image */}
                  {msg.imageUrl && (
                    <a href={getImageUrl(msg.imageUrl)} target="_blank" rel="noreferrer"
                      className="block mb-1 rounded-xl overflow-hidden"
                      style={{ maxWidth: 220 }}>
                      <img
                        src={getImageUrl(msg.imageUrl)}
                        alt="foto"
                        style={{ width: '100%', height: 'auto', maxHeight: 240, objectFit: 'cover', display: 'block' }}
                      />
                    </a>
                  )}

                  {/* Text bubble */}
                  {displayContent && (
                    <div className={`inline-block px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                      msg.isSystem
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 font-mono text-xs'
                        : isMe
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                    }`}>
                      {msg.isSystem ? displayContent : <MentionText text={displayContent} />}
                    </div>
                  )}

                  {msg.fraudDetected && (
                    <p className="text-2xs text-red-500 mt-0.5">⚠ Kontak eksternal terdeteksi & dimasker</p>
                  )}
                  <p className="text-2xs text-neutral-400 mt-0.5">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: localeId })}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={chatEnd} />
        </div>

        {/* Image preview strip */}
        {imgPreview && (
          <div className="px-3 pb-1 pt-2 border-t border-neutral-100 dark:border-neutral-800 bg-[var(--bg-elevated)]">
            <div className="relative inline-block">
              <img
                src={imgPreview.localUrl}
                alt="preview"
                style={{ height: 64, width: 'auto', borderRadius: 8, display: 'block', border: '1px solid var(--border)' }}
              />
              <button
                onClick={cancelImage}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 20, height: 20, borderRadius: 9999,
                  backgroundColor: '#ff3b30', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <MdClose size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={sendMessage}
          className="p-3 border-t border-neutral-100 dark:border-neutral-800 flex gap-2 items-center"
        >
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickImage} />

          {/* Image button */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isClosed}
            title="Kirim foto"
            style={{
              width: 36, height: 36, borderRadius: 9999, flexShrink: 0,
              backgroundColor: 'transparent', border: 'none', cursor: isClosed ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: imgPreview ? 'var(--accent)' : 'var(--text-muted)',
              opacity: isClosed ? 0.4 : 1,
              transition: 'color 0.15s ease',
            }}
          >
            <MdImage size={20} />
          </button>

          <MentionInput
            value={msgText}
            onChange={setMsgText}
            placeholder={isClosed ? 'Pesanan sudah selesai' : 'Ketik pesan... Ketik @ untuk tag'}
            className="input flex-1"
            disabled={isClosed}
            maxLength={5000}
          />

          <button
            type="submit"
            disabled={busy || uploading || isClosed || (!msgText.trim() && !imgPreview)}
            className="btn-primary px-4 shrink-0"
            style={{ opacity: (!msgText.trim() && !imgPreview) ? 0.4 : 1 }}
          >
            {uploading
              ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: 9999, display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              : <MdSend size={16} />
            }
          </button>
        </form>
      </div>

      {/* Deliver modal */}
      {showDeliver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleDeliver} className="card p-5 w-full max-w-md space-y-3">
            <h2 className="font-bold">Kirim Detail Akun</h2>
            {['email', 'password', 'recovery', 'notes'].map((field) => (
              <input
                key={field}
                type={field === 'password' ? 'password' : 'text'}
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={delivery[field]}
                onChange={(e) => setDelivery({ ...delivery, [field]: e.target.value })}
                className="input w-full"
              />
            ))}
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowDeliver(false)} className="btn-secondary flex-1 justify-center">Batal</button>
              <button type="submit" disabled={busy} className="btn-primary flex-1 justify-center">Kirim</button>
            </div>
          </form>
        </div>
      )}

      {/* Dispute modal */}
      {showDispute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleDispute} className="card p-5 w-full max-w-md space-y-3">
            <h2 className="font-bold">Buka Dispute</h2>
            <select
              value={disputeForm.reason}
              onChange={(e) => setDisputeForm({ ...disputeForm, reason: e.target.value })}
              className="input w-full"
            >
              {DISPUTE_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <textarea
              placeholder="Jelaskan masalah..."
              value={disputeForm.description}
              onChange={(e) => setDisputeForm({ ...disputeForm, description: e.target.value })}
              className="input w-full h-24 resize-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowDispute(false)} className="btn-secondary flex-1 justify-center">Batal</button>
              <button type="submit" disabled={busy} className="btn-primary flex-1 justify-center bg-red-600">Buka Dispute</button>
            </div>
          </form>
        </div>
      )}

      {/* Rating modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmitReview} className="card p-5 w-full max-w-md space-y-4">
            <h2 className="font-bold text-lg">Beri Penilaian</h2>
            <div className="flex flex-col items-center gap-2">
              <StarRating
                value={ratingValue}
                onChange={(newRating) => setRatingValue(newRating)}
                size={24}
              />
              <p className="text-sm text-neutral-500">Rating: {ratingValue}/5</p>
            </div>
            <textarea
              placeholder="Tulis komentar Anda (opsional)..."
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              className="input w-full h-24 resize-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowRatingModal(false)} className="btn-secondary flex-1 justify-center">Batal</button>
              <button type="submit" disabled={busy} className="btn-primary flex-1 justify-center">Kirim</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
