import React, { useEffect, useState } from 'react'
import {
  MdAdd, MdDelete, MdEdit, MdCheck, MdClose,
  MdVisibility, MdVisibilityOff,
} from 'react-icons/md'
import api from '../../lib/api'
import { invalidateCategoryCache } from '../../lib/useCategories'
import CategoryBadge from '../../components/common/CategoryBadge'
import toast from 'react-hot-toast'

const COLOR_PRESETS = [
  'from-blue-500 to-indigo-600',
  'from-red-500 to-rose-600',
  'from-amber-400 to-yellow-500',
  'from-orange-500 to-amber-500',
  'from-orange-600 to-red-600',
  'from-yellow-400 to-orange-400',
  'from-red-700 to-rose-800',
  'from-purple-500 to-indigo-600',
  'from-green-500 to-emerald-600',
  'from-red-400 to-pink-500',
  'from-slate-500 to-blue-700',
  'from-slate-400 to-slate-600',
  'from-cyan-500 to-blue-500',
  'from-teal-500 to-emerald-500',
  'from-pink-500 to-rose-500',
]

const EMPTY_FORM = { id: '', name: '', icon: 'GM', color: 'from-slate-400 to-slate-600' }

function CategoryForm({ initial = EMPTY_FORM, onSave, onCancel, isNew = false }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Nama kategori wajib diisi')
    if (isNew && !form.id.trim()) return toast.error('ID kategori wajib diisi')
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3 border-2 border-accent-200 dark:border-accent-800">
      <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
        {isNew ? 'Tambah Kategori Baru' : 'Edit Kategori'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isNew && (
          <div>
            <label className="input-label">ID Unik <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })}
              placeholder="contoh: mobile-legends"
              className="input text-sm"
              maxLength={40}
              required
            />
            <p className="text-2xs text-neutral-400 mt-0.5">Huruf kecil, angka, tanda hubung. Tidak bisa diubah setelah disimpan.</p>
          </div>
        )}
        <div>
          <label className="input-label">Nama Kategori <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="contoh: Mobile Legends"
            className="input text-sm"
            maxLength={60}
            required
          />
        </div>
        <div>
          <label className="input-label">Singkatan</label>
          <input
            type="text"
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) })}
            placeholder="ML"
            className="input text-sm font-mono uppercase"
            maxLength={5}
          />
          <p className="text-2xs text-neutral-400 mt-0.5">2–5 huruf, ditampilkan di badge gradient.</p>
        </div>
      </div>

      {/* Color picker */}
      <div>
        <label className="input-label">Warna Gradient</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {COLOR_PRESETS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setForm({ ...form, color: g })}
              className={`w-8 h-8 rounded-lg bg-gradient-to-br ${g} transition-transform shrink-0
                ${form.color === g ? 'scale-110 ring-2 ring-offset-2 ring-accent-500' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
              title={g}
            />
          ))}
        </div>
        <div className={`mt-2 h-10 rounded-lg bg-gradient-to-r ${form.color} flex items-center justify-center gap-2`}>
          <CategoryBadge icon={form.icon} name={form.name} color={form.color} size="sm" />
          <span className="text-white text-xs font-medium drop-shadow">{form.name || 'Preview'}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 gap-1">
          <MdClose size={14} /> Batal
        </button>
        <button type="submit" disabled={saving} className="btn-accent flex-1 gap-1">
          <MdCheck size={14} />
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/categories')
      setCategories(data)
    } catch {
      toast.error('Gagal memuat kategori')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (form) => {
    try {
      const { data } = await api.post('/admin/categories', form)
      invalidateCategoryCache()
      setCategories((prev) => [...prev, data])
      setShowAdd(false)
      toast.success('Kategori ditambahkan')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menambahkan')
      throw err
    }
  }

  const handleEdit = async (form) => {
    try {
      const { data } = await api.patch(`/admin/categories/${form.id || editingId}`, form)
      invalidateCategoryCache()
      setCategories((prev) => prev.map((c) => c.id === data.id ? data : c))
      setEditingId(null)
      toast.success('Kategori diperbarui')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui')
      throw err
    }
  }

  const toggleActive = async (cat) => {
    try {
      const { data } = await api.patch(`/admin/categories/${cat.id}`, { isActive: !cat.isActive })
      invalidateCategoryCache()
      setCategories((prev) => prev.map((c) => c.id === data.id ? data : c))
      toast.success(data.isActive ? 'Kategori diaktifkan' : 'Kategori dinonaktifkan')
    } catch {
      toast.error('Gagal mengubah status')
    }
  }

  const handleDelete = async (catId) => {
    if (!window.confirm('Hapus kategori ini? Postingan yang menggunakan kategori ini tidak akan terhapus.')) return
    setDeleting(catId)
    try {
      await api.delete(`/admin/categories/${catId}`)
      invalidateCategoryCache()
      setCategories((prev) => prev.filter((c) => c.id !== catId))
      toast.success('Kategori dihapus')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menghapus')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Kategori</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Kelola kategori game yang tersedia untuk postingan</p>
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="btn-accent gap-1.5">
            <MdAdd size={16} /> Tambah Kategori
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <CategoryForm
          isNew
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card h-14 skeleton" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="card flex flex-col items-center py-14 text-center">
          <p className="text-sm text-neutral-400">Belum ada kategori</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id}>
              {editingId === cat.id ? (
                <CategoryForm
                  initial={{ id: cat.id, name: cat.name, icon: cat.icon, color: cat.color }}
                  onSave={(form) => handleEdit({ ...form, id: cat.id })}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className={`card p-3.5 flex items-center gap-3.5 ${!cat.isActive ? 'opacity-50' : ''}`}>
                  {/* Color swatch + icon */}
                  <CategoryBadge cat={cat} size="md" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{cat.name}</p>
                      {!cat.isActive && (
                        <span className="px-1.5 py-0.5 rounded-md text-2xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
                          Nonaktif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 font-mono">id: {cat.id}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleActive(cat)}
                      title={cat.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      className="btn-icon w-8 h-8 rounded-xl text-neutral-400 hover:text-amber-500"
                    >
                      {cat.isActive ? <MdVisibility size={15} /> : <MdVisibilityOff size={15} />}
                    </button>
                    <button
                      onClick={() => { setEditingId(cat.id); setShowAdd(false) }}
                      title="Edit"
                      className="btn-icon w-8 h-8 rounded-xl text-neutral-400 hover:text-accent-500"
                    >
                      <MdEdit size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={deleting === cat.id}
                      title="Hapus"
                      className="btn-icon w-8 h-8 rounded-xl text-neutral-400 hover:text-red-500 disabled:opacity-40"
                    >
                      <MdDelete size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-neutral-400">
        Total: {categories.length} kategori · Aktif: {categories.filter((c) => c.isActive).length}
      </p>
    </div>
  )
}
