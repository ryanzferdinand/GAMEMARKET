import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MdAccountBalanceWallet, MdAdd, MdRemove, MdHistory,
  MdShoppingBag, MdTrendingUp,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useWalletStore from '../store/walletStore'
import useAuthStore from '../store/authStore'
import { getSocket } from '../lib/socket'

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n || 0)

const DEPOSIT_METHODS = [
  { id: 'qris', label: 'QRIS' },
  { id: 'gopay', label: 'GoPay' },
  { id: 'dana', label: 'DANA' },
]

const WITHDRAW_METHODS = [
  { id: 'gopay', label: 'GoPay' },
  { id: 'dana', label: 'DANA' },
  { id: 'ovo', label: 'OVO' },
  { id: 'shopeepay', label: 'ShopeePay' },
  { id: 'bank', label: 'Bank Transfer' },
]

const WITHDRAW_MIN = 50000

export default function WalletPage() {
  const { user } = useAuthStore()
  const {
    wallet, transactions, withdraws, paymentConfig, loading,
    fetchWallet, fetchTransactions, fetchWithdraws, fetchPaymentConfig,
    createDeposit, simulatePayment, checkPaymentStatus, withdraw,
  } = useWalletStore()

  const [tab, setTab] = useState('overview')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState('qris')
  const [pendingPayment, setPendingPayment] = useState(null)
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', method: 'gopay', accountNumber: '', accountName: '' })
  const [dashboard, setDashboard] = useState(null)
  const [busy, setBusy] = useState(false)

  const isSimulateMode = paymentConfig?.provider === 'simulate'
  const simulateAvailable = paymentConfig?.simulateAvailable !== false

  useEffect(() => {
    fetchWallet()
    fetchTransactions()
    fetchWithdraws()
    fetchPaymentConfig()
    loadDashboard()
  }, [])

  useEffect(() => {
    const socket = getSocket()
    const onWalletUpdate = ({ userId }) => {
      if (userId === user?._id?.toString()) {
        fetchWallet()
        fetchTransactions()
      }
    }
    socket?.on('wallet:updated', onWalletUpdate)
    return () => socket?.off('wallet:updated', onWalletUpdate)
  }, [user?._id])

  // Poll Midtrans payment status while pending
  useEffect(() => {
    if (!pendingPayment?.gatewayRef || pendingPayment.provider !== 'midtrans') return

    const poll = async () => {
      try {
        const data = await checkPaymentStatus(pendingPayment.gatewayRef)
        if (data.status === 'paid' || data.credited) {
          setPendingPayment(null)
          setDepositAmount('')
          toast.success('Deposit berhasil!')
        }
      } catch {}
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [pendingPayment?.gatewayRef, pendingPayment?.provider])

  const loadDashboard = async () => {
    try {
      const [buyerRes, sellerRes] = await Promise.all([
        api.get('/orders', { params: { role: 'buyer', limit: 5 } }),
        api.get('/orders', { params: { role: 'seller', limit: 5 } }),
      ])
      setDashboard({
        buyerOrders: buyerRes.data.orders,
        sellerOrders: sellerRes.data.orders,
      })
    } catch {}
  }

  const handleDeposit = async (e) => {
    e.preventDefault()
    const amount = Number(depositAmount)
    if (amount < 10000) return toast.error('Minimum deposit Rp10.000')
    setBusy(true)
    try {
      const data = await createDeposit(amount, depositMethod)
      setPendingPayment(data)
      toast.success('Payment dibuat — selesaikan pembayaran')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal deposit')
    } finally {
      setBusy(false)
    }
  }

  const handleSimulatePay = async () => {
    if (!pendingPayment?.gatewayRef) return
    setBusy(true)
    try {
      const result = await simulatePayment(pendingPayment.gatewayRef)
      if (result.credited || result.payment?.status === 'paid') {
        setPendingPayment(null)
        setDepositAmount('')
        toast.success('Deposit berhasil!')
      } else {
        toast.error('Pembayaran belum dikreditkan — coba lagi')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Simulasi gagal')
    } finally {
      setBusy(false)
    }
  }

  const handleCheckStatus = async () => {
    if (!pendingPayment?.gatewayRef) return
    setBusy(true)
    try {
      const data = await checkPaymentStatus(pendingPayment.gatewayRef)
      if (data.status === 'paid' || data.credited) {
        setPendingPayment(null)
        setDepositAmount('')
        toast.success('Deposit berhasil!')
      } else {
        toast(`Status: ${data.status || 'menunggu'}`, { icon: '⏳' })
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal cek status')
    } finally {
      setBusy(false)
    }
  }

  const handleWithdraw = async (e) => {
    e.preventDefault()
    const amount = Number(withdrawForm.amount)
    if (amount < WITHDRAW_MIN) return toast.error(`Minimum withdraw ${fmt(WITHDRAW_MIN)}`)
    setBusy(true)
    try {
      await withdraw(withdrawForm)
      setWithdrawForm({ amount: '', method: 'gopay', accountNumber: '', accountName: '' })
      toast.success('Permintaan withdraw diajukan')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal withdraw')
    } finally {
      setBusy(false)
    }
  }

  const TABS = [
    { id: 'overview', label: 'Overview', icon: MdAccountBalanceWallet },
    { id: 'deposit', label: 'Deposit', icon: MdAdd },
    { id: 'withdraw', label: 'Withdraw', icon: MdRemove },
    { id: 'history', label: 'Riwayat', icon: MdHistory },
  ]

  return (
    <div className="space-y-6 animate-fade-up max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Wallet</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Kelola saldo, deposit, dan withdraw</p>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Tersedia', val: wallet?.availableBalance, color: 'text-emerald-600' },
          { label: 'Pending', val: wallet?.pendingBalance, color: 'text-amber-600' },
          { label: 'Dibekukan', val: wallet?.frozenBalance, color: 'text-red-500' },
        ].map(({ label, val, color }) => (
          <div key={label} className="card p-5">
            <p className="text-xs text-neutral-400 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>
              {loading ? '—' : fmt(val)}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
            }`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
        <Link to="/orders" className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-accent-500/10 text-accent-600 ml-auto">
          <MdShoppingBag size={15} /> Pesanan
        </Link>
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MdShoppingBag className="text-accent-500" />
              <h2 className="text-sm font-semibold">Pesanan Pembelian</h2>
            </div>
            {dashboard?.buyerOrders?.length ? dashboard.buyerOrders.map((o) => (
              <Link key={o._id} to={`/orders/${o._id}`} className="block py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                <p className="text-sm font-medium truncate">{o.post?.title}</p>
                <p className="text-xs text-neutral-400">{o.orderNumber} · {o.status}</p>
              </Link>
            )) : <p className="text-sm text-neutral-400">Belum ada pesanan</p>}
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MdTrendingUp className="text-emerald-500" />
              <h2 className="text-sm font-semibold">Penjualan</h2>
            </div>
            {dashboard?.sellerOrders?.length ? dashboard.sellerOrders.map((o) => (
              <Link key={o._id} to={`/orders/${o._id}`} className="block py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                <p className="text-sm font-medium truncate">{o.post?.title}</p>
                <p className="text-xs text-neutral-400">{fmt(o.sellerAmount)} · {o.status}</p>
              </Link>
            )) : <p className="text-sm text-neutral-400">Belum ada penjualan</p>}
          </div>
        </div>
      )}

      {tab === 'deposit' && (
        <div className="card p-5 space-y-4">
          <div className={`text-xs px-3 py-2 rounded-lg ${
            isSimulateMode
              ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
              : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
          }`}>
            {isSimulateMode
              ? 'Mode simulasi aktif — Midtrans belum dikonfigurasi. Gunakan "Simulasi Bayar" setelah buat payment.'
              : `Midtrans ${paymentConfig?.midtrans?.isProduction ? 'Production' : 'Sandbox'} aktif — bayar via link/QR di bawah.`}
          </div>

          <form onSubmit={handleDeposit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase">Jumlah</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="100000"
                className="input mt-1 w-full"
                min={10000}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase">Metode</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {DEPOSIT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setDepositMethod(m.id)}
                    className={`py-2 rounded-xl text-sm font-medium border ${
                      depositMethod === m.id
                        ? 'border-accent-500 bg-accent-500/10 text-accent-600'
                        : 'border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
              Buat Pembayaran
            </button>
          </form>

          {pendingPayment && (
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold">Menunggu Pembayaran</p>
              <p className="text-xs text-neutral-400">
                Ref: {pendingPayment.gatewayRef}
                {pendingPayment.provider && ` · ${pendingPayment.provider}`}
              </p>

              {pendingPayment.redirectUrl && (
                <a
                  href={pendingPayment.redirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full justify-center text-sm"
                >
                  Buka Halaman Bayar (GoPay/DANA)
                </a>
              )}

              {pendingPayment.qrString && (
                <div className="space-y-2">
                  {pendingPayment.qrString.startsWith('http') ? (
                    <img src={pendingPayment.qrString} alt="QRIS" className="mx-auto max-w-[200px] rounded-lg" />
                  ) : (
                    <p className="text-xs font-mono break-all bg-white dark:bg-neutral-900 p-2 rounded">
                      {pendingPayment.qrString}
                    </p>
                  )}
                  <p className="text-2xs text-neutral-400 text-center">Scan QRIS dengan e-wallet Anda</p>
                </div>
              )}

              {!isSimulateMode && (
                <button onClick={handleCheckStatus} disabled={busy} className="btn-secondary w-full justify-center text-sm">
                  Cek Status Pembayaran
                </button>
              )}

              {simulateAvailable && (
                <button onClick={handleSimulatePay} disabled={busy} className="btn-secondary w-full justify-center text-sm">
                  {isSimulateMode ? 'Simulasi Bayar' : 'Simulasi Bayar (Dev)'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'withdraw' && (
        <div className="card p-5">
          <p className="text-xs text-neutral-400 mb-4">Minimum withdraw {fmt(WITHDRAW_MIN)}</p>
          <form onSubmit={handleWithdraw} className="space-y-4">
            <input type="number" placeholder="Jumlah" value={withdrawForm.amount}
              onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
              className="input w-full" min={WITHDRAW_MIN} />
            <select value={withdrawForm.method} onChange={(e) => setWithdrawForm({ ...withdrawForm, method: e.target.value })}
              className="input w-full">
              {WITHDRAW_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <input type="text" placeholder="Nomor rekening / e-wallet" value={withdrawForm.accountNumber}
              onChange={(e) => setWithdrawForm({ ...withdrawForm, accountNumber: e.target.value })}
              className="input w-full" />
            <input type="text" placeholder="Nama pemilik (opsional)" value={withdrawForm.accountName}
              onChange={(e) => setWithdrawForm({ ...withdrawForm, accountName: e.target.value })}
              className="input w-full" />
            <button type="submit" disabled={busy} className="btn-primary w-full justify-center">Ajukan Withdraw</button>
          </form>

          {withdraws.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs font-semibold text-neutral-500 uppercase">Riwayat Withdraw</p>
              {withdraws.slice(0, 5).map((w) => (
                <div key={w._id} className="flex justify-between text-sm py-2 border-b border-neutral-100 dark:border-neutral-800">
                  <span>{fmt(w.amount)} · {w.method}</span>
                  <span className="text-neutral-400 capitalize">{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="card divide-y divide-neutral-100 dark:divide-neutral-800">
          {transactions.length ? transactions.map((tx) => (
            <div key={tx._id} className="p-4 flex justify-between items-start">
              <div>
                <p className="text-sm font-medium capitalize">{tx.type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-neutral-400">{tx.description}</p>
                <p className="text-2xs text-neutral-400">{new Date(tx.createdAt).toLocaleString('id-ID')}</p>
              </div>
              <p className={`text-sm font-semibold ${
                ['deposit', 'escrow_release', 'escrow_refund', 'unfreeze', 'withdraw_refund'].includes(tx.type)
                  ? 'text-emerald-600' : 'text-neutral-700 dark:text-neutral-300'
              }`}>
                {['deposit', 'escrow_release', 'escrow_refund', 'unfreeze', 'withdraw_refund'].includes(tx.type) ? '+' : '-'}
                {fmt(tx.amount)}
              </p>
            </div>
          )) : <p className="p-6 text-sm text-neutral-400 text-center">Belum ada transaksi</p>}
        </div>
      )}
    </div>
  )
}
