import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { getSocket } from '../lib/socket'

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0)

const STATUS_LABELS = {
  escrow_active: { label: 'Escrow Aktif', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  delivered: { label: 'Menunggu Konfirmasi', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  completed: { label: 'Selesai', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
  disputed: { label: 'Dispute', color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
  refunded: { label: 'Refund', color: 'text-neutral-600 bg-neutral-100 dark:bg-neutral-800' },
  cancelled: { label: 'Dibatalkan', color: 'text-neutral-500 bg-neutral-100' },
}

export default function OrdersPage() {
  const [role, setRole] = useState('buyer')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/orders', { params: { role } })
      setOrders(data.orders)
    } catch {
      toast.error('Gagal memuat pesanan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [role])

  useEffect(() => {
    const socket = getSocket()

    const onOrderUpdated = () => {
      load()
    }

    socket?.on('order:updated', onOrderUpdated)
    return () => {
      socket?.off('order:updated', onOrderUpdated)
    }
  }, [role])

  return (
    <div className="space-y-6 animate-fade-up max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Pesanan</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Kelola transaksi escrow Anda</p>
      </div>

      <div className="flex gap-2">
        {['buyer', 'seller'].map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              role === r ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'
            }`}
          >
            {r === 'buyer' ? 'Pembelian' : 'Penjualan'}
          </button>
        ))}
        <Link to="/wallet" className="ml-auto text-sm text-accent-600 self-center">Wallet →</Link>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : orders.length ? (
        <div className="space-y-3">
          {orders.map((order) => {
            const st = STATUS_LABELS[order.status] || STATUS_LABELS.escrow_active
            return (
              <Link key={order._id} to={`/orders/${order._id}`} className="card p-4 flex gap-4 card-interactive">
                {order.post?.images?.[0] && (
                  <img src={order.post.images[0]} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{order.post?.title}</p>
                  <p className="text-xs text-neutral-400">{order.orderNumber}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-2xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    <span className="text-sm font-bold">{fmt(order.amount)}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="card p-8 text-center text-neutral-400 text-sm">Belum ada pesanan</div>
      )}
    </div>
  )
}
