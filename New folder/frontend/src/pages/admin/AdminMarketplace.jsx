import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MdAccountBalanceWallet, MdLock, MdPayments, MdGavel, MdHistory,
} from 'react-icons/md'
import api from '../../lib/api'

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0)

function StatCard({ label, value, icon: Icon, color, link }) {
  const Wrap = link ? Link : 'div'
  return (
    <Wrap to={link} className={`card p-5 flex items-start gap-4 ${link ? 'card-interactive' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-xl font-bold tracking-tight leading-none mb-1">{value ?? '—'}</p>
        <p className="text-xs text-neutral-400">{label}</p>
      </div>
    </Wrap>
  )
}

export default function AdminMarketplace() {
  const [stats, setStats] = useState(null)
  const [withdraws, setWithdraws] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [sRes, wRes] = await Promise.all([
        api.get('/marketplace-admin/stats'),
        api.get('/marketplace-admin/withdraws'),
      ])
      setStats(sRes.data)
      setWithdraws(wRes.data.withdraws)
    } catch {
      setStats({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const processWithdraw = async (id, action) => {
    try {
      await api.post(`/marketplace-admin/withdraws/${id}/process`, { action })
      load()
    } catch {}
  }

  const CARDS = [
    { label: 'Total Wallet', val: fmt(stats?.totalWalletBalance), icon: MdAccountBalanceWallet, color: 'bg-emerald-500' },
    { label: 'Escrow Aktif', val: fmt(stats?.totalEscrow), icon: MdLock, color: 'bg-amber-500' },
    { label: 'Revenue Platform', val: fmt(stats?.totalRevenue), icon: MdPayments, color: 'bg-purple-500' },
    { label: 'Dispute Aktif', val: stats?.activeDisputes, icon: MdGavel, color: 'bg-red-500', link: '/admin/disputes' },
    { label: 'Withdraw Pending', val: stats?.pendingWithdraws, icon: MdHistory, color: 'bg-blue-500' },
    { label: 'Total Pesanan', val: stats?.totalOrders, icon: MdAccountBalanceWallet, color: 'bg-accent-500' },
  ]

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Wallet, escrow, revenue & withdraw</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CARDS.map(({ label, val, icon, color, link }) => (
          <StatCard key={label} label={label} value={loading ? null : val} icon={icon} color={color} link={link} />
        ))}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-4">Withdraw Pending</h2>
        {withdraws.length ? withdraws.map((w) => (
          <div key={w._id} className="flex items-center justify-between py-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
            <div>
              <p className="text-sm font-medium">{w.user?.username} · {fmt(w.amount)}</p>
              <p className="text-xs text-neutral-400">{w.method} · {w.accountNumber}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => processWithdraw(w._id, 'processing')} className="btn-secondary text-xs px-3 py-1">Proses</button>
              <button onClick={() => processWithdraw(w._id, 'complete')} className="btn-primary text-xs px-3 py-1">Selesai</button>
              <button onClick={() => processWithdraw(w._id, 'reject')} className="text-xs px-3 py-1 text-red-600">Tolak</button>
            </div>
          </div>
        )) : <p className="text-sm text-neutral-400">Tidak ada withdraw pending</p>}
      </div>

      <Link to="/admin/audit-logs" className="text-sm text-accent-600">Lihat Audit Logs →</Link>
    </div>
  )
}
