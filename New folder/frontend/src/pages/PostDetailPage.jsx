import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  MdThumbUp, MdThumbDown, MdShare, MdArrowBack,
  MdVerified, MdChatBubbleOutline, MdShoppingCart,
  MdChevronLeft, MdChevronRight, MdSecurity, MdEdit,
  MdCancel, MdInfoOutline,
} from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import api from '../lib/api'
import { getSocket } from '../lib/socket'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import useRatingStore from '../store/ratingStore'
import UserBadge from '../components/common/UserBadge'
import CommentSection from '../components/common/CommentSection'
import ReviewSection from '../components/common/ReviewSection'
import WishlistButton from '../components/common/WishlistButton'
import { ReportButton } from '../components/common/ReportModal'
import StarRating from '../components/common/StarRating'
import RoleName from '../components/common/RoleName'
import OnlineDot from '../components/common/OnlineDot'
import { getAvatar, getImageUrl } from '../lib/avatar'
import toast from 'react-hot-toast'
import MobileActionBar, { ActionBarOutline, ActionBarPrimary } from '../components/common/MobileActionBar'

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)

export default function PostDetailPage() {
  const { id }  = useParams()
  const nav     = useNavigate()
  const { user } = useAuthStore()
  const { openChat } = useUIStore()

  const [post, setPost]             = useState(null)
  const [marketplace, setMarketplace] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [imgIdx, setImgIdx]         = useState(0)
  const [voting, setVoting]         = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const sellerCached = useRatingStore((s) =>
    post?.seller?._id ? s.cache[post.seller._id.toString()] : null
  )

  const handleSellerRatingUpdate = (stats) => {
    setPost((p) => p ? {
      ...p, seller: { ...p.seller, rating: stats.rating, ratingCount: stats.ratingCount },
    } : p)
  }

  const load = async () => {
    try {
      const { data } = await api.get(`/posts/${id}`)
      setPost(data.post)
      setMarketplace(data.marketplace || null)
    } catch {
      toast.error('Postingan tidak ditemukan')
      nav('/')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    const socket = getSocket()
    const sellerId = post?.seller?._id?.toString()
    if (sellerId) socket.emit('seller:join', { sellerId })

    const onStatsUpdated = ({ sellerId: sid, totalSales }) => {
      setPost((p) => {
        if (!p || p.seller?._id?.toString() !== sellerId) return p
        return { ...p, seller: { ...p.seller, totalSales } }
      })
    }
    const onCancelled = ({ orderId }) => {
      setMarketplace((m) => {
        if (!m) return m
        const active = m.activeOrder
        if (active && active._id?.toString() === orderId) {
          return { ...m, activeOrder: null, inTransaction: false, canPurchase: true }
        }
        return { ...m, inTransaction: false }
      })
      toast('Pesanan dibatalkan', { icon: 'ℹ️' })
      load()
    }
    socket.on('seller:stats-updated', onStatsUpdated)
    socket.on('order:cancelled', onCancelled)
    return () => {
      if (sellerId) socket.emit('seller:leave', { sellerId })
      socket.off('seller:stats-updated', onStatsUpdated)
      socket.off('order:cancelled', onCancelled)
    }
  }, [id, post?.seller?._id])

  const vote = async (type) => {
    if (!user) return toast.error('Login untuk memberi vote')
    if (voting) return
    // Owner can vote on their own post (toggling), but not on pending/sold
    if (post.status !== 'approved') return toast.error('Voting hanya tersedia pada postingan aktif')
    setVoting(true)
    try {
      const { data } = await api.post(`/posts/${id}/vote`, { type })
      setPost((p) => p ? {
        ...p,
        likes: data.post.likes,
        dislikes: data.post.dislikes,
        seller: data.post.seller?.username ? data.post.seller : p.seller,
      } : p)
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal vote') }
    finally { setVoting(false) }
  }

  const handlePurchase = async () => {
    if (!user) return toast.error('Login untuk membeli')
    if (purchasing) return
    if (marketplace?.activeOrder) { nav(`/orders/${marketplace.activeOrder._id}`); return }
    if (marketplace?.insufficientBalance) { toast.error('Saldo tidak cukup — deposit dulu di Wallet'); nav('/wallet'); return }
    setPurchasing(true)
    try {
      const { data } = await api.post('/orders/purchase', { postId: id })
      toast.success('Pembelian berhasil — escrow aktif')
      nav(`/orders/${data.order._id}`)
    } catch (err) {
      const status = err.response?.status
      const msg    = err.response?.data?.message
      const oid    = err.response?.data?.orderId
      if (status === 429) toast.error(msg || 'Terlalu banyak percobaan. Tunggu sebentar.')
      else if (status === 409 && oid) { toast('Pesanan aktif sudah ada', { icon: 'ℹ️' }); nav(`/orders/${oid}`) }
      else if (msg?.includes('Saldo')) { toast.error(msg); nav('/wallet') }
      else toast.error(msg || 'Gagal membeli')
    } finally { setPurchasing(false) }
  }

  const handleCancelRequest = async () => {
    if (!marketplace?.activeOrder) return
    if (!window.confirm('Minta pembatalan pesanan? Pihak lain harus menyetujui agar pesanan benar-benar dibatalkan.')) return
    setCancelling(true)
    try {
      const { data } = await api.post(`/orders/${marketplace.activeOrder._id}/cancel`, { reason: 'Dibatalkan oleh pembeli' })
      if (data.cancelled) {
        toast.success('Pesanan dibatalkan — saldo dikembalikan')
        load()
      } else {
        toast('Permintaan batal dikirim — menunggu konfirmasi penjual', { icon: '⏳' })
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengajukan pembatalan')
    } finally { setCancelling(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="animate-pulse">
      <div className="skeleton" style={{ height: 20, width: 110, borderRadius: 6 }} />
      <div className="skeleton" style={{ aspectRatio: '16/9', borderRadius: 18 }} />
      <div className="skeleton" style={{ height: 24, width: '75%', borderRadius: 6 }} />
    </div>
  )
  if (!post) return null

  const liked    = user && post.likes?.includes(user._id)
  const disliked = user && post.dislikes?.includes(user._id)
  const isOwner  = user && post.seller?._id?.toString() === user._id?.toString()
  const isSold    = post.status === 'sold'
  const isPending = post.status === 'pending'
  const isApproved = post.status === 'approved'
  // Interactions allowed on approved posts for everyone (including owner).
  // Pending/sold = no new votes or comments.
  const canInteract = isApproved
  const activeOrder    = marketplace?.activeOrder
  const walletBalance  = marketplace?.wallet?.availableBalance
  const needDeposit    = marketplace?.insufficientBalance
  const sellerRating   = sellerCached?.rating ?? post.seller?.rating
  const sellerRatingCount = sellerCached?.ratingCount ?? post.seller?.ratingCount
  // cancelRequestedBy comes through marketplace.activeOrder if populated
  const cancelPending  = activeOrder?.cancelRequestedBy != null

  // ── Mobile floating action bar content ─────────────────────────────────────
  const showMobileBar = !isOwner && !isSold

  const mobileChatBtn = (
    <ActionBarOutline
      icon={<MdChatBubbleOutline size={17} />}
      label=""
      onClick={() => {
        if (!user) return toast.error('Login untuk menghubungi penjual')
        openChat(post.seller)
      }}
    />
  )

  let mobileBuyBtn = null
  if (activeOrder) {
    mobileBuyBtn = (
      <ActionBarPrimary
        icon={<MdShoppingCart size={16} />}
        label="Lihat Pesanan"
        onClick={() => nav(`/orders/${activeOrder._id}`)}
      />
    )
  } else if (marketplace?.inTransaction) {
    mobileBuyBtn = (
      <ActionBarPrimary label="Sedang Transaksi" disabled />
    )
  } else if (needDeposit) {
    mobileBuyBtn = (
      <ActionBarPrimary
        icon={<MdShoppingCart size={16} />}
        label={`Deposit · ${fmt(post.price)}`}
        onClick={() => nav('/wallet')}
      />
    )
  } else {
    mobileBuyBtn = (
      <ActionBarPrimary
        icon={<MdShoppingCart size={16} />}
        label={!user ? 'Login' : purchasing ? 'Memproses…' : `Beli · ${fmt(post.price)}`}
        onClick={handlePurchase}
        disabled={purchasing || !user}
      />
    )
  }

  return (
    <>
      {/* ── Mobile floating action bar ── */}
      <MobileActionBar visible={showMobileBar}>
        {mobileChatBtn}
        {mobileBuyBtn}
      </MobileActionBar>

      <div className="space-y-5 animate-fade-up" style={{ paddingBottom: showMobileBar ? 96 : 0 }}>
      {/* Back */}
      <button onClick={() => nav(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, letterSpacing: '-0.224px', color: '#7a7a7a', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s ease', padding: 0 }}
        onMouseEnter={e => e.currentTarget.style.color = '#1d1d1f'} onMouseLeave={e => e.currentTarget.style.color = '#7a7a7a'}>
        <MdArrowBack size={16} /> Kembali
      </button>

      {/* Pending owner banner */}
      {isPending && isOwner && (
        <div className="flex gap-3 p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.25)' }}>
          <MdInfoOutline style={{ color: '#ff9f0a', flexShrink: 0, marginTop: 1 }} size={18} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#c77e00', marginBottom: 4 }}>Postingan sedang ditinjau</p>
            <p style={{ fontSize: 13, color: '#92600a', margin: 0 }}>Admin akan memeriksa postingan Anda. Anda tetap bisa mengedit selagi menunggu.</p>
            <Link to={`/edit-post/${post._id}`} className="btn-secondary" style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px', textDecoration: 'none' }}>
              <MdEdit size={14} /> Edit Postingan
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 post-detail-grid" style={{ display: 'grid', gap: 16 }}>
        {/* ── Left ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Gallery */}
          <div className="card overflow-hidden">
            <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800">
              {post.images?.length > 0 ? (
                <>
                  <img src={getImageUrl(post.images[imgIdx])} alt={post.title} className="w-full h-full object-cover" />
                  {post.images?.length > 1 && (
                    <>
                      <button onClick={() => setImgIdx((i) => (i - 1 + post.images.length) % post.images.length)}
                        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 9999, backgroundColor: 'rgba(20, 20, 22, 0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                        <MdChevronLeft size={20} />
                      </button>
                      <button onClick={() => setImgIdx((i) => (i + 1) % post.images.length)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 9999, backgroundColor: 'rgba(20, 20, 22, 0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                        <MdChevronRight size={20} />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-400 dark:text-neutral-600">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
              )}
              <div className="absolute top-3 left-3 flex gap-2">
                {isSold    && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500 text-white">Terjual</span>}
                {isPending && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white">Menunggu</span>}
              </div>
            </div>
            {post.images?.length > 1 && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 12px', overflowX: 'auto' }}>
                {post.images.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    style={{ flexShrink: 0, width: 64, height: 44, borderRadius: 8, overflow: 'hidden', border: i === imgIdx ? '2px solid #0066cc' : '2px solid transparent', opacity: i === imgIdx ? 1 : 0.55, cursor: 'pointer', padding: 0, transition: 'border-color 0.15s ease, opacity 0.15s ease' }}>
                    <img src={getImageUrl(img)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail */}
          <div className="card p-5 space-y-4">
            <div className="post-title-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <h1 style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontSize: 20, fontWeight: 600, letterSpacing: '-0.374px', color: 'var(--text-primary)', lineHeight: 1.2, margin: 0 }}>{post.title}</h1>
              <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.374px', color: 'var(--accent)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmt(post.price)}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-400">
              {post.gameCategory && <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">{post.gameCategory}</span>}
              <span>{post.createdAt && formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: localeId })}</span>
              <span>{post.views || 0} tayangan</span>
            </div>
            {post.description && (
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Deskripsi</p>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">{post.description}</p>
              </div>
            )}
            {post.details && Object.keys(post.details).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Detail Akun</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(post.details).map(([k, v]) => (
                    <div key={k} className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3">
                      <p className="text-2xs text-neutral-400 capitalize mb-0.5">{k}</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Vote + Share + Report — available on approved posts for everyone */}
            <div className="post-actions-row" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-soft)', flexWrap: 'wrap' }}>
              <button onClick={() => vote('like')} disabled={!canInteract}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9999, fontSize: 14, fontWeight: 500, letterSpacing: '-0.224px', border: liked ? '1px solid rgba(0,102,204,0.3)' : '1px solid var(--border)', backgroundColor: liked ? 'rgba(0,102,204,0.08)' : 'var(--bg-secondary)', color: liked ? 'var(--accent)' : 'var(--text-secondary)', cursor: canInteract ? 'pointer' : 'not-allowed', opacity: canInteract ? 1 : 0.4 }}>
                <MdThumbUp size={15} />{post.likes?.length || 0}
              </button>
              <button onClick={() => vote('dislike')} disabled={!canInteract}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9999, fontSize: 14, fontWeight: 500, letterSpacing: '-0.224px', border: disliked ? '1px solid rgba(255,59,48,0.3)' : '1px solid var(--border)', backgroundColor: disliked ? 'rgba(255,59,48,0.06)' : 'var(--bg-secondary)', color: disliked ? 'var(--color-red)' : 'var(--text-secondary)', cursor: canInteract ? 'pointer' : 'not-allowed', opacity: canInteract ? 1 : 0.4 }}>
                <MdThumbDown size={15} />{post.dislikes?.length || 0}
              </button>
              {canInteract && !isOwner && <ReportButton targetType="post" targetId={post._id} targetLabel={post.title} ownerId={post.seller?._id} iconOnly />}
              <button onClick={() => { if (!canInteract) return toast.error('Postingan tidak aktif'); navigator.clipboard.writeText(window.location.href); toast.success('Link disalin') }}
                disabled={!canInteract}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9999, fontSize: 14, fontWeight: 400, border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: canInteract ? 'pointer' : 'not-allowed', marginLeft: 'auto', opacity: canInteract ? 1 : 0.4 }}
                onMouseEnter={e => { if (canInteract) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)' }}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}>
                <MdShare size={15} />Bagikan
              </button>
            </div>
          </div>

          {/* Comments — shown on all statuses, but posting blocked on pending/sold */}
          <div className="card p-5">
            <CommentSection postId={id} commentCount={post.commentCount || 0} postStatus={post.status} isOwner={false} />
          </div>

          {post.seller?._id && post.seller?.username && (
            <div className="card p-5">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Review Penjual</p>
              <ReviewSection sellerId={post.seller._id} sellerUsername={post.seller.username} postId={id} onRatingUpdate={handleSellerRatingUpdate} />
            </div>
          )}
        </div>

        {/* ── Right — seller card ── */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Penjual</p>
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={getAvatar(post.seller?.avatar, post.seller?.username)} alt={post.seller?.username} className="w-11 h-11 rounded-2xl shrink-0 object-cover" />
                <OnlineDot userId={post.seller?._id} className="absolute -bottom-0.5 -right-0.5" />
              </div>
              <div className="min-w-0">
                <RoleName username={post.seller?.username} role={post.seller?.role} linkTo={`/profile/${post.seller?.username}`} size="sm" />
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {post.seller?.role && <UserBadge role={post.seller.role} mini />}
                  {post.seller?.verified && <MdVerified className="text-accent-500" size={13} />}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              {[{ label: 'Terjual', val: post.seller?.totalSales || 0 }, { label: 'Rating', val: sellerRating ? sellerRating.toFixed(1) : '—' }].map(({ label, val }) => (
                <div key={label} className="bg-neutral-50 dark:bg-neutral-800 rounded-xl py-2.5">
                  <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{val}</p>
                  <p className="text-2xs text-neutral-400">{label}</p>
                </div>
              ))}
            </div>
            {sellerRating > 0 && (
              <div className="flex flex-col items-center gap-0.5">
                <StarRating value={sellerRating} readonly size={14} />
                <p className="text-2xs text-neutral-400">{sellerRatingCount || 0} review</p>
              </div>
            )}
            <div className="flex items-center gap-2"><WishlistButton postId={post._id} /></div>

            {/* ── Desktop CTA (hidden on mobile, replaced by sticky bar) ── */}
            {!isOwner && !isSold && (
              <div className="space-y-2 hidden lg:block">
                {user && walletBalance != null && (
                  <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                    <span className="text-neutral-500">Saldo wallet</span>
                    <Link to="/wallet" className="font-semibold text-accent-600">{fmt(walletBalance)}</Link>
                  </div>
                )}
                {activeOrder ? (
                  <>
                    <Link to={`/orders/${activeOrder._id}`} className="btn-primary" style={{ width: '100%', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
                      <MdShoppingCart size={16} /> Lihat Pesanan Aktif
                    </Link>
                    {/* Cancel request button */}
                    <button onClick={handleCancelRequest} disabled={cancelling || cancelPending}
                      className="btn-secondary" style={{ width: '100%', justifyContent: 'center', gap: 6, color: '#ff3b30', borderColor: 'rgba(255,59,48,0.3)' }}>
                      <MdCancel size={14} />
                      {cancelling ? 'Mengajukan...' : cancelPending ? 'Menunggu konfirmasi lawan...' : 'Minta Batalkan Pesanan'}
                    </button>
                    {cancelPending && <p style={{ fontSize: 11, textAlign: 'center', color: '#ff9f0a' }}>Permintaan batal dikirim — menunggu persetujuan pihak lain</p>}
                  </>
                ) : marketplace?.inTransaction ? (
                  <div style={{ width: '100%', padding: '11px 0', borderRadius: 9999, backgroundColor: 'rgba(255,159,10,0.08)', color: '#ff9f0a', fontSize: 14, fontWeight: 500, textAlign: 'center' }}>
                    Sedang dalam transaksi
                  </div>
                ) : needDeposit ? (
                  <>
                    <Link to="/wallet" className="btn-primary" style={{ width: '100%', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
                      Deposit · Butuh {fmt(post.price)}
                    </Link>
                    <p style={{ fontSize: 11, textAlign: 'center', color: '#ff3b30' }}>Saldo tidak cukup untuk membeli</p>
                  </>
                ) : (
                  <button onClick={handlePurchase} disabled={purchasing || !user} className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', gap: 8, opacity: !user ? 0.6 : 1 }}>
                    <MdShoppingCart size={16} />
                    {!user ? 'Login untuk Beli' : purchasing ? 'Memproses...' : `Beli · ${fmt(post.price)}`}
                  </button>
                )}
                <button onClick={() => { if (!user) return toast.error('Login untuk menghubungi penjual'); openChat(post.seller) }}
                  className="btn-secondary" style={{ width: '100%', justifyContent: 'center', gap: 8 }}>
                  <MdChatBubbleOutline size={16} /> Chat Penjual
                </button>
                <p style={{ fontSize: 11, textAlign: 'center', color: '#7a7a7a' }}>Pembayaran via wallet · escrow otomatis · proteksi pembeli</p>
              </div>
            )}
            {isSold && <div style={{ width: '100%', padding: '11px 0', borderRadius: 9999, backgroundColor: 'rgba(255,59,48,0.08)', color: '#ff3b30', fontSize: 15, fontWeight: 400, textAlign: 'center', letterSpacing: '-0.224px' }}>Akun sudah terjual</div>}
            {isOwner && (
              <div className="space-y-2">
                {!isSold && (
                  <Link to={`/edit-post/${post._id}`} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', gap: 8, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                    <MdEdit size={14} /> Edit Postingan
                  </Link>
                )}
                <p style={{ fontSize: 13, textAlign: 'center', color: '#7a7a7a' }}>
                  {isPending ? 'Sedang ditinjau admin' : isSold ? 'Postingan sudah terjual' : 'Ini postingan Anda'}
                </p>
              </div>
            )}
          </div>
          <div style={{ backgroundColor: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.2)', borderRadius: 18, padding: '16px 18px' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <MdSecurity style={{ color: '#ff9f0a', flexShrink: 0, marginTop: 1 }} size={18} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#c77e00', marginBottom: 8, letterSpacing: '-0.224px' }}>Tips Keamanan</p>
                <ul style={{ fontSize: 13, color: '#92600a', letterSpacing: '-0.12px', paddingLeft: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>Bayar via wallet — escrow otomatis</li>
                  <li>Konfirmasi dalam 24 jam setelah delivery</li>
                  <li>Buka dispute jika ada masalah</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
