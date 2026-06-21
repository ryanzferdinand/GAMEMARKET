import React, { useEffect, useState } from 'react'
import { MdSearch, MdVerified, MdBlock, MdCheckCircle } from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import UserBadge from '../../components/common/UserBadge'
import api from '../../lib/api'
import { ROLE_CONFIG } from '../../lib/constants'
import { getAvatar } from '../../lib/avatar'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

function BanModal({ user, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="card w-full sm:max-w-md p-6 shadow-xl animate-scale-in rounded-b-none sm:rounded-2xl">
        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">
          Blokir @{user.username}
        </h2>
        <p className="text-sm text-neutral-400 mb-4">
          Pengguna tidak akan bisa login atau menggunakan platform.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Alasan pemblokiran (wajib)…"
          className="input resize-none min-h-[80px] mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || loading}
            className="flex-1 btn py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            Blokir Pengguna
          </button>
        </div>
      </div>
    </div>
  )
}

function UserActions({ u, currentUserId, updating, onRoleChange, onVerify, onBan, onUnban }) {
  const isSelf = u._id === currentUserId
  const isAdmin = u.role === 'admin'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={u.role}
        onChange={(e) => onRoleChange(u._id, e.target.value)}
        disabled={updating === u._id || isAdmin}
        className="text-xs px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700
                   bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300
                   focus:outline-none cursor-pointer disabled:opacity-50 transition-colors"
      >
        {Object.entries(ROLE_CONFIG).map(([r, c]) => (
          <option key={r} value={r}>{c.label || r}</option>
        ))}
      </select>
      <button
        onClick={() => onVerify(u._id, !u.verified)}
        className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors
          ${u.verified
            ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/30 dark:text-accent-400 hover:bg-accent-100 dark:hover:bg-accent-950/50'
            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
      >
        {u.verified ? 'Verified' : 'Verifikasi'}
      </button>
      {!isSelf && !isAdmin && (
        u.isBanned ? (
          <button
            onClick={() => onUnban(u._id)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium
                       bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400
                       hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
          >
            <MdCheckCircle size={13} /> Unban
          </button>
        ) : (
          <button
            onClick={() => onBan(u)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium
                       bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400
                       hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
          >
            <MdBlock size={13} /> Ban
          </button>
        )
      )}
    </div>
  )
}

export default function AdminUsers() {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers]   = useState([])
  const [loading, setL]     = useState(true)
  const [search, setSearch] = useState('')
  const [updating, setUpd]  = useState(null)
  const [banTarget, setBanTarget] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      setL(true)
      try {
        const { data } = await api.get('/admin/users', { params: search ? { search } : {} })
        setUsers(data)
      } catch { setUsers([]) }
      finally  { setL(false) }
    }
    fetch()
  }, [search])

  const changeRole = async (id, role) => {
    setUpd(id)
    try {
      await api.patch(`/admin/users/${id}/role`, { role })
      setUsers((p) => p.map((u) => u._id === id ? { ...u, role } : u))
      toast.success(`Role diubah ke ${ROLE_CONFIG[role]?.label || role}`)
    } catch { toast.error('Gagal mengubah role') }
    finally  { setUpd(null) }
  }

  const verify = async (id, verified) => {
    try {
      await api.patch(`/admin/users/${id}/verify`, { verified })
      setUsers((p) => p.map((u) => u._id === id ? { ...u, verified } : u))
      toast.success(verified ? 'Diverifikasi' : 'Verifikasi dicabut')
    } catch { toast.error('Gagal mengubah verifikasi') }
  }

  const banUser = async (reason) => {
    if (!banTarget) return
    setUpd(banTarget._id)
    try {
      await api.patch(`/admin/users/${banTarget._id}/ban`, { reason })
      setUsers((p) => p.map((u) => u._id === banTarget._id
        ? { ...u, isBanned: true, banReason: reason.trim() }
        : u))
      setBanTarget(null)
      toast.success('Pengguna diblokir')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memblokir')
    } finally { setUpd(null) }
  }

  const unbanUser = async (id) => {
    if (!window.confirm('Cabut pemblokiran pengguna ini?')) return
    setUpd(id)
    try {
      await api.patch(`/admin/users/${id}/unban`)
      setUsers((p) => p.map((u) => u._id === id
        ? { ...u, isBanned: false, banReason: null }
        : u))
      toast.success('Pemblokiran dicabut')
    } catch { toast.error('Gagal unban') }
    finally { setUpd(null) }
  }

  const userRow = (u) => (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        <img
          src={getAvatar(u.avatar, u.username)}
          className="w-8 h-8 rounded-full shrink-0 object-cover"
          alt=""
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
              {u.username}
            </p>
            {u.verified && <MdVerified size={13} className="text-accent-500 shrink-0" />}
            {u.isBanned && (
              <span className="text-2xs px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 font-medium">
                Banned
              </span>
            )}
          </div>
          <p className="text-2xs text-neutral-400 truncate">{u.email}</p>
          {u.isBanned && u.banReason && (
            <p className="text-2xs text-red-500 truncate mt-0.5">{u.banReason}</p>
          )}
        </div>
      </div>
      <UserBadge role={u.role} mini />
    </>
  )

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Kelola Pengguna</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Atur role, verifikasi, dan status blokir</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" size={16} />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari username / email…"
            className="input pl-9 w-full"
          />
        </div>
      </div>

      {/* Mobile cards */}
      <div className="admin-user-card space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 skeleton h-28" />
          ))
        ) : users.length === 0 ? (
          <div className="card p-8 text-center text-sm text-neutral-400">
            Tidak ada pengguna ditemukan
          </div>
        ) : users.map((u) => (
          <div key={u._id} className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              {userRow(u)}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
              <span>
                {u.createdAt && formatDistanceToNow(new Date(u.createdAt), { addSuffix: true, locale: localeId })}
              </span>
              <span>{u.totalSales || 0} terjual</span>
            </div>
            <UserActions
              u={u}
              currentUserId={currentUser?._id}
              updating={updating}
              onRoleChange={changeRole}
              onVerify={verify}
              onBan={setBanTarget}
              onUnban={unbanUser}
            />
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="admin-user-table card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                {['Pengguna', 'Role', 'Bergabung', 'Terjual', 'Aksi'].map((h, i) => (
                  <th
                    key={h}
                    className={`text-left px-4 py-3 text-2xs font-semibold text-neutral-400 uppercase tracking-wider
                      ${i >= 2 ? 'hidden md:table-cell' : ''}
                      ${i === 3 ? 'hidden lg:table-cell' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-50 dark:border-neutral-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full skeleton shrink-0" />
                        <div className="skeleton h-3 w-24 rounded" />
                      </div>
                    </td>
                    {[1,2,3,4].map((x) => (
                      <td key={x} className="px-4 py-3 hidden md:table-cell">
                        <div className="skeleton h-3 w-16 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-neutral-400">
                    Tidak ada pengguna ditemukan
                  </td>
                </tr>
              ) : users.map((u) => (
                <tr
                  key={u._id}
                  className={`border-b border-neutral-50 dark:border-neutral-800/50
                             hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors
                             ${u.isBanned ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={getAvatar(u.avatar, u.username)}
                        className="w-8 h-8 rounded-full shrink-0 object-cover"
                        alt=""
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                            {u.username}
                          </p>
                          {u.verified && <MdVerified size={13} className="text-accent-500 shrink-0" />}
                          {u.isBanned && (
                            <span className="text-2xs px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 font-medium shrink-0">
                              Banned
                            </span>
                          )}
                        </div>
                        <p className="text-2xs text-neutral-400 truncate">{u.email}</p>
                        {u.isBanned && u.banReason && (
                          <p className="text-2xs text-red-500 truncate max-w-[200px]">{u.banReason}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <UserBadge role={u.role} mini />
                  </td>

                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-neutral-400">
                      {u.createdAt && formatDistanceToNow(new Date(u.createdAt), { addSuffix: true, locale: localeId })}
                    </span>
                  </td>

                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {u.totalSales || 0}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <UserActions
                      u={u}
                      currentUserId={currentUser?._id}
                      updating={updating}
                      onRoleChange={changeRole}
                      onVerify={verify}
                      onBan={setBanTarget}
                      onUnban={unbanUser}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {banTarget && (
        <BanModal
          user={banTarget}
          onClose={() => setBanTarget(null)}
          onConfirm={banUser}
          loading={updating === banTarget._id}
        />
      )}
    </div>
  )
}
