import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { MdFlag, MdCheckCircle, MdCancel, MdOpenInNew } from 'react-icons/md'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { getAvatar } from '../../lib/avatar'

const STATUS = {
  pending:       { label: 'Menunggu', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  reviewed:      { label: 'Ditinjau', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' },
  dismissed:     { label: 'Ditolak', cls: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400' },
  action_taken:  { label: 'Ditindaklanjuti', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
}

const REASON_LABELS = {
  spam: 'Spam', scam: 'Penipuan', inappropriate: 'Tidak pantas',
  fake: 'Informasi palsu', harassment: 'Pelecehan', other: 'Lainnya',
}

const TABS = ['pending', 'reviewed', 'dismissed', 'action_taken', 'all']

export default function AdminReports() {
  const [reports, setReports] = useState([])
  const [loading, setL] = useState(true)
  const [tab, setTab] = useState('pending')
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')

  const load = async () => {
    setL(true)
    try {
      const { data } = await api.get('/reports/admin', { params: { status: tab } })
      setReports(data.reports || [])
    } catch { toast.error('Gagal memuat laporan') }
    finally { setL(false) }
  }

  useEffect(() => { load() }, [tab])

  const resolve = async (status) => {
    if (!selected) return
    try {
      await api.patch(`/reports/admin/${selected._id}`, { status, reviewNotes: notes })
      toast.success('Laporan diperbarui')
      setSelected(null)
      setNotes('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui')
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Laporan</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Tinjau laporan dari pengguna</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium capitalize transition-all
              ${tab === t
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
              }`}
          >
            {t === 'all' ? 'Semua' : STATUS[t]?.label || t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 h-20 skeleton animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <MdFlag size={28} className="text-neutral-300 mb-2" />
          <p className="text-sm text-neutral-400">Tidak ada laporan</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const s = STATUS[r.status] || STATUS.pending
            return (
              <div key={r._id} className="card p-4 flex items-start gap-3">
                <img src={getAvatar(r.reporter?.avatar, r.reporter?.username)} alt="" className="w-9 h-9 rounded-full shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-neutral-900 dark:text-white">{r.reporter?.username}</span>
                    <span className={`px-2 py-0.5 rounded-full text-2xs font-medium ${s.cls}`}>{s.label}</span>
                    <span className="text-2xs text-neutral-400 capitalize">{r.targetType}</span>
                  </div>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="font-medium">{REASON_LABELS[r.reason] || r.reason}</span>
                    {r.description && ` — ${r.description}`}
                  </p>
                  {r.targetSnapshot && (
                    <p className="text-xs text-neutral-400 mt-1 truncate">
                      Target: {r.targetSnapshot.title || r.targetSnapshot.username || r.targetSnapshot.content}
                    </p>
                  )}
                  <p className="text-2xs text-neutral-400 mt-1">
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: localeId })}
                  </p>
                </div>
                {r.status === 'pending' && (
                  <button onClick={() => { setSelected(r); setNotes('') }} className="btn-secondary text-xs shrink-0">
                    Tinjau
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-md shadow-xl animate-scale-in p-5 space-y-4">
            <h3 className="text-sm font-semibold">Tinjau Laporan</h3>
            <p className="text-xs text-neutral-500">
              {REASON_LABELS[selected.reason]} — {selected.targetType}
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan moderator (opsional)…"
              className="input resize-none min-h-[72px]"
            />
            <div className="flex gap-2">
              <button onClick={() => setSelected(null)} className="btn-secondary flex-1">Batal</button>
              <button onClick={() => resolve('dismissed')} className="btn-secondary flex-1 gap-1">
                <MdCancel size={14} /> Tolak
              </button>
              <button onClick={() => resolve('action_taken')} className="btn-accent flex-1 gap-1">
                <MdCheckCircle size={14} /> Tindaklanjuti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
