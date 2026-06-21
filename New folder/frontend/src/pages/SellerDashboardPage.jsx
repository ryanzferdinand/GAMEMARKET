import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MdTrendingUp,
  MdStar,
  MdShoppingBag,
  MdTimer,
  MdWarning,
  MdCheckCircle,
  MdBarChart,
  MdArrowUpward,
  MdArrowDownward,
  MdAccountBalanceWallet,
  MdList,
  MdStorefront,
  MdPeople,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/authStore'
import { getSocket } from '../lib/socket'
import RoleName from '../components/common/RoleName'
import { getAvatar } from '../lib/avatar'

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n ?? 0)

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatResponseTime(minutes) {
  if (!minutes || minutes === 0) return '< 1 menit'
  if (minutes < 60) return `${minutes} menit`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`
}

const STATUS_COLORS = {
  completed: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Selesai' },
  escrow_active: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Aktif' },
  delivered: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Terkirim' },
  disputed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Dispute' },
  cancelled: { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-500 dark:text-neutral-400', label: 'Dibatalkan' },
  refunded: { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-500 dark:text-neutral-400', label: 'Refund' },
}

function SkeletonBlock({ className = '' }) {
  return (
    <div className={`animate-pulse bg-neutral-200 dark:bg-neutral-700 rounded-xl ${className}`} />
  )
}

function StatCard({ label, value, sub, icon: Icon, colorClass, loading }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <>
            <SkeletonBlock className="h-6 w-24 mb-1" />
            <SkeletonBlock className="h-3 w-20" />
          </>
        ) : (
          <>
            <p className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 leading-tight">
              {value}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">{sub || label}</p>
          </>
        )}
      </div>
    </div>
  )
}

function RateCard({ label, value, icon: Icon, colorFn, formatVal, loading }) {
  const pct = loading ? 0 : (value ?? 0)
  const color = colorFn(pct)
  const barColors = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-400',
    red: 'bg-red-500',
  }
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-neutral-400 shrink-0" />
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          {label}
        </span>
      </div>
      {loading ? (
        <>
          <SkeletonBlock className="h-7 w-16 mb-2" />
          <SkeletonBlock className="h-2 w-full rounded-full" />
        </>
      ) : (
        <>
          <p className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
            {formatVal ? formatVal(pct) : `${pct}%`}
          </p>
          <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColors[color]}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </>
      )}
    </div>
  )
}

function MonthlyRevenueChart({ data, loading }) {
  if (loading) {
    return (
      <div className="card p-5">
        <SkeletonBlock className="h-5 w-40 mb-4" />
        <div className="flex items-end gap-2 h-32">
          {[...Array(6)].map((_, i) => (
            <SkeletonBlock key={i} className="flex-1" style={{ height: `${40 + i * 12}px` }} />
          ))}
        </div>
      </div>
    )
  }

  // Use last 6 months
  const months = Array.isArray(data) ? data.slice(-6) : []
  const maxRevenue = Math.max(...months.map((m) => m.revenue || 0), 1)
  const allZero = months.every((m) => !m.revenue)

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-5">
        <MdBarChart size={16} className="text-neutral-400" />
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Pendapatan Bulanan
        </h3>
      </div>
      {allZero ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MdTrendingUp size={32} className="text-neutral-300 dark:text-neutral-600 mb-2" />
          <p className="text-sm text-neutral-400">Belum ada pendapatan</p>
        </div>
      ) : (
        <div className="flex items-end gap-2" style={{ height: 120 }}>
          {months.map((m) => {
            const heightPct = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0
            return (
              <div
                key={`${m.year || ''}-${m.month || m.label}`}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-t-md bg-accent-500 hover:bg-accent-600 transition-colors cursor-default"
                  style={{ height: `${Math.max(heightPct, 3)}%`, minHeight: m.revenue > 0 ? 4 : 2 }}
                  title={fmt(m.revenue)}
                />
                <span className="text-[10px] text-neutral-400 truncate w-full text-center">
                  {m.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RatingBreakdown({ breakdown, total, loading }) {
  const STAR_COLORS = {
    5: 'bg-emerald-500',
    4: 'bg-lime-500',
    3: 'bg-amber-400',
    2: 'bg-orange-400',
    1: 'bg-red-500',
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <MdStar size={16} className="text-neutral-400" />
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Distribusi Rating
        </h3>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <SkeletonBlock key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = breakdown?.[star] || 0
            const pct = total > 0 ? (count / total) * 100 : 0
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 w-5 text-right shrink-0">
                  {star}★
                </span>
                <div className="flex-1 h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${STAR_COLORS[star]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-neutral-400 w-6 shrink-0">{count}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StarRating({ rating }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <MdStar
          key={s}
          size={13}
          className={s <= rating ? 'text-amber-400' : 'text-neutral-300 dark:text-neutral-600'}
        />
      ))}
    </span>
  )
}

export default function SellerDashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [wallet, setWallet] = useState(null)

  const fetchStats = async () => {
    try {
      const [statsRes, walletRes] = await Promise.all([
        api.get('/seller/stats'),
        api.get('/wallet'),
      ])
      setStats(statsRes.data)
      setWallet(walletRes.data)
    } catch (err) {
      toast.error('Gagal memuat data dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    const socket = getSocket()
    const onWalletUpdate = ({ userId }) => {
      if (user && user._id?.toString() === userId) {
        api.get('/wallet').then(({ data }) => setWallet(data)).catch(() => {})
      }
    }
    socket.on('wallet:updated', onWalletUpdate)
    return () => socket.off('wallet:updated', onWalletUpdate)
  }, [user?._id])

  // Access control
  if (user && user.role === 'buyer') {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center animate-fade-up">
        <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
          <MdStorefront size={28} className="text-neutral-400" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Halaman ini hanya untuk penjual
        </h1>
        <p className="text-sm text-neutral-500 mb-6">
          Buat postingan pertama kamu untuk menjadi penjual di GameMarket.
        </p>
        <Link to="/create-post" className="btn-primary">
          Mulai Jual Sekarang
        </Link>
      </div>
    )
  }

  const profile = stats?.profile || {}
  const rates = stats?.rates || {}
  const ratingStats = stats?.rating || {}
  const recentOrders = stats?.recentOrders || []
  const recentReviews = stats?.recentReviews || []
  const monthlyRevenue = stats?.monthlyRevenue || []
  const postMap = stats?.posts || {}
  const orderMap = stats?.orders || {}
  const activeListings = postMap.approved || 0
  const pendingOrders = (orderMap.escrow_active || 0) + (orderMap.delivered || 0)

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 space-y-6 animate-fade-up">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Dashboard Penjual
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Selamat datang,{' '}
            {user && (
              <RoleName
                username={user.username}
                role={user.role}
                linkTo={`/profile/${user.username}`}
              />
            )}
          </p>
        </div>
        {user && (
          <div className="shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-400 border border-accent-200 dark:border-accent-800">
              <MdStorefront size={13} />
              {user.role === 'trusted_seller' ? 'Trusted Seller' : user.role === 'seller' ? 'Seller' : user.role}
            </span>
          </div>
        )}
      </div>

      {/* ── Top stat cards (2 cols mobile / 4 cols desktop) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Pendapatan"
          value={fmt(profile.totalRevenue)}
          sub="Total Pendapatan"
          icon={MdAccountBalanceWallet}
          colorClass="bg-emerald-500"
          loading={loading}
        />
        <StatCard
          label="Total Terjual"
          value={loading ? '—' : (profile.completedOrders ?? 0).toLocaleString()}
          sub="Order Selesai"
          icon={MdShoppingBag}
          colorClass="bg-blue-500"
          loading={loading}
        />
        <StatCard
          label="Rating"
          value={loading ? '—' : `${(ratingStats.rating || 0).toFixed(1)} ★`}
          sub={`${(ratingStats.ratingCount || 0).toLocaleString()} ulasan`}
          icon={MdStar}
          colorClass="bg-amber-400"
          loading={loading}
        />
        <StatCard
          label="Saldo Tersedia"
          value={fmt(wallet?.availableBalance)}
          sub="Saldo Tersedia"
          icon={MdAccountBalanceWallet}
          colorClass="bg-purple-500"
          loading={loading}
        />
      </div>

      {/* ── Rate cards (3 cols) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <RateCard
          label="Tingkat Keberhasilan"
          value={rates.completionRate}
          icon={MdCheckCircle}
          colorFn={(v) => v >= 80 ? 'green' : v >= 60 ? 'amber' : 'red'}
          loading={loading}
        />
        <RateCard
          label="Tingkat Dispute"
          value={rates.disputeRate}
          icon={MdWarning}
          colorFn={(v) => v <= 5 ? 'green' : v <= 15 ? 'amber' : 'red'}
          loading={loading}
        />
        <RateCard
          label="Waktu Respons"
          value={profile.avgResponseMinutes}
          icon={MdTimer}
          colorFn={() => 'green'}
          formatVal={formatResponseTime}
          loading={loading}
        />
      </div>

      {/* ── Activity row (2 cols) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Active listings */}
        <Link to="/my-posts" className="card p-5 flex items-center gap-4 card-interactive" style={{ textDecoration: 'none' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-cyan-500">
            <MdList size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {loading ? (
              <>
                <SkeletonBlock className="h-6 w-12 mb-1" />
                <SkeletonBlock className="h-3 w-24" />
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 leading-none">
                  {activeListings.toLocaleString()}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">Listing Aktif</p>
              </>
            )}
          </div>
          <MdArrowUpward size={16} className="text-neutral-300 dark:text-neutral-600 shrink-0" />
        </Link>

        {/* Pending orders */}
        <Link to="/orders" className="card p-5 flex items-center gap-4 card-interactive" style={{ textDecoration: 'none' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-orange-500">
            <MdShoppingBag size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {loading ? (
              <>
                <SkeletonBlock className="h-6 w-12 mb-1" />
                <SkeletonBlock className="h-3 w-24" />
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 leading-none">
                  {pendingOrders.toLocaleString()}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">Pesanan Pending</p>
              </>
            )}
          </div>
          <MdArrowDownward size={16} className="text-neutral-300 dark:text-neutral-600 shrink-0" />
        </Link>
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MonthlyRevenueChart data={monthlyRevenue} loading={loading} />
        <RatingBreakdown
          breakdown={ratingStats.breakdown}
          total={ratingStats.ratingCount || 0}
          loading={loading}
        />
      </div>

      {/* ── Recent Reviews ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <MdStar size={16} className="text-neutral-400" />
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex-1">
            Ulasan Terbaru
          </h3>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <SkeletonBlock className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonBlock className="h-3 w-32" />
                  <SkeletonBlock className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : recentReviews.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <MdStar size={28} className="text-neutral-300 dark:text-neutral-600 mb-2" />
            <p className="text-sm text-neutral-400">Belum ada ulasan</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recentReviews.map((rev) => (
              <div key={rev._id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <img
                    src={getAvatar(rev.reviewer?.avatar, rev.reviewer?.username)}
                    alt={rev.reviewer?.username}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {rev.reviewer?.username || 'Anonim'}
                      </span>
                      <StarRating rating={rev.rating} />
                      <span className="text-xs text-neutral-400 ml-auto">{formatDate(rev.createdAt)}</span>
                    </div>
                    {rev.post?.title && (
                      <p className="text-xs text-neutral-400 mt-0.5 truncate">
                        {rev.post.title}
                      </p>
                    )}
                    {rev.comment && (
                      <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1 line-clamp-2">
                        {rev.comment}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Orders ── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <MdList size={16} className="text-neutral-400" />
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex-1">
            Pesanan Terbaru
          </h3>
          <Link to="/orders" className="text-xs text-accent-600 dark:text-accent-400 hover:underline">
            Lihat semua
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <SkeletonBlock key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <MdShoppingBag size={28} className="text-neutral-300 dark:text-neutral-600 mb-2" />
            <p className="text-sm text-neutral-400">Belum ada pesanan</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order) => {
              const sc = STATUS_COLORS[order.status] || STATUS_COLORS.cancelled
              return (
                <Link
                  key={order._id}
                  to={`/orders/${order._id}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  style={{ textDecoration: 'none' }}
                >
                  {/* Order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-neutral-400">
                        #{order.orderNumber?.slice(-8) || order._id?.slice(-8)}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                      >
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate mt-0.5">
                      {order.post?.title || '—'}
                    </p>
                    <p className="text-xs text-neutral-400">
                      Pembeli: {order.buyer?.username || '—'}
                    </p>
                  </div>
                  {/* Right: amount + date */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {fmt(order.sellerAmount || order.amount)}
                    </p>
                    <p className="text-xs text-neutral-400">{formatDate(order.createdAt)}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
