import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdArticle, MdPeople, MdSchedule, MdBarChart, MdArrowForward } from 'react-icons/md'
import api from '../../lib/api'

function StatCard({ label, value, icon: Icon, color, link }) {
  const Wrap = link ? Link : 'div'
  return (
    <Wrap
      to={link}
      className={`card p-5 flex items-start gap-4 ${link ? 'card-interactive' : ''}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 leading-none mb-1">
          {value === null ? '—' : value.toLocaleString()}
        </p>
        <p className="text-xs text-neutral-400">{label}</p>
      </div>
    </Wrap>
  )
}

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

export default function AdminDashboard() {
  const [stats, setStats]     = useState(null)
  const [pending, setPending] = useState([])
  const [loading, setL]       = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/posts', { params: { status: 'pending', limit: 5 } }),
    ])
      .then(([sRes, pRes]) => {
        setStats(sRes.data)
        setPending(pRes.data.posts || [])
      })
      .catch(() => setStats({ totalPosts: 0, totalUsers: 0, pendingPosts: 0, totalViews: 0 }))
      .finally(() => setL(false))
  }, [])

  const CARDS = [
    { label: 'Total Postingan',    val: stats?.totalPosts,    icon: MdArticle,  color: 'bg-accent-500' },
    { label: 'Total Pengguna',     val: stats?.totalUsers,    icon: MdPeople,   color: 'bg-emerald-500' },
    { label: 'Menunggu Review',    val: stats?.pendingPosts,  icon: MdSchedule, color: 'bg-amber-500', link: '/admin/posts' },
    { label: 'Laporan Pending',    val: stats?.pendingReports, icon: MdBarChart, color: 'bg-red-500', link: '/admin/reports' },
    { label: 'Total Tayangan',     val: stats?.totalViews,    icon: MdBarChart, color: 'bg-purple-500' },
  ]

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Dashboard</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Ringkasan platform GameMarket</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {CARDS.map(({ label, val, icon, color, link }) => (
          <StatCard
            key={label}
            label={label}
            value={loading ? null : val}
            icon={icon}
            color={color}
            link={link}
          />
        ))}
      </div>

      {/* Pending posts */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Menunggu Review</h2>
          <Link to="/admin/posts" className="flex items-center gap-1 text-xs text-accent-600 hover:underline">
            Lihat semua <MdArrowForward size={13} />
          </Link>
        </div>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-2">
              <MdArticle size={18} className="text-emerald-500" />
            </div>
            <p className="text-xs text-neutral-400">Tidak ada postingan yang perlu ditinjau</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((post) => (
              <div key={post._id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
                <div className="w-12 h-9 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-700 shrink-0">
                  {post.images?.[0]
                    ? <img src={post.images[0]} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">—</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{post.title}</p>
                  <p className="text-xs text-neutral-400">{post.seller?.username} · {fmt(post.price)}</p>
                </div>
                <Link to="/admin/posts" className="btn-secondary text-xs py-1 px-3 shrink-0">
                  Review
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
