import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0)

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [resolveForm, setResolveForm] = useState({})
  const [busy, setBusy] = useState(null)

  const load = async () => {
    try {
      const { data } = await api.get('/disputes', { params: { queue: 'true' } })
      setDisputes(data.disputes)
    } catch {
      toast.error('Gagal memuat dispute')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const claim = async (id) => {
    try {
      await api.post(`/disputes/${id}/claim`)
      toast.success('Dispute diklaim')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal klaim')
    }
  }

  const resolve = async (id) => {
    const form = resolveForm[id]
    if (!form?.winner) return toast.error('Pilih pemenang')
    setBusy(id)
    try {
      await api.post(`/disputes/${id}/resolve`, form)
      toast.success('Dispute diselesaikan')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal resolve')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dispute Queue</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Auto-assign · claim · resolve</p>
      </div>

      {loading ? (
        <div className="skeleton h-32 rounded-xl" />
      ) : disputes.length ? (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div key={d._id} className="card p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold">Dispute #{d._id.slice(-6)}</p>
                  <p className="text-xs text-neutral-400">
                    Order: {d.order?.orderNumber} · {fmt(d.order?.amount)}
                  </p>
                  <p className="text-xs capitalize mt-1">Alasan: {d.reason?.replace(/_/g, ' ')} · {d.status}</p>
                  {d.moderator && <p className="text-xs text-accent-600">Moderator: {d.moderator?.username}</p>}
                </div>
                <span className="text-2xs px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 capitalize">{d.status}</span>
              </div>

              {d.description && <p className="text-sm text-neutral-600 dark:text-neutral-300">{d.description}</p>}

              <div className="flex flex-wrap gap-2">
                <Link to={`/orders/${d.order?._id || d.order}`} className="btn-secondary text-xs px-3 py-1">Lihat Order</Link>
                {!d.claimedBy && (
                  <button onClick={() => claim(d._id)} className="btn-primary text-xs px-3 py-1">Claim</button>
                )}
              </div>

              <div className="flex gap-2 items-end pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <select
                  value={resolveForm[d._id]?.winner || ''}
                  onChange={(e) => setResolveForm({ ...resolveForm, [d._id]: { ...resolveForm[d._id], winner: e.target.value } })}
                  className="input text-sm flex-1"
                >
                  <option value="">Pilih pemenang</option>
                  <option value="buyer">Pembeli menang (Refund)</option>
                  <option value="seller">Penjual menang (Release)</option>
                </select>
                <input
                  placeholder="Catatan..."
                  value={resolveForm[d._id]?.note || ''}
                  onChange={(e) => setResolveForm({ ...resolveForm, [d._id]: { ...resolveForm[d._id], note: e.target.value } })}
                  className="input text-sm flex-1"
                />
                <button onClick={() => resolve(d._id)} disabled={busy === d._id} className="btn-primary text-xs px-4 py-2">
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center text-neutral-400 text-sm">Tidak ada dispute aktif</div>
      )}
    </div>
  )
}
