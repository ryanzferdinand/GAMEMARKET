import React, { useEffect, useState } from 'react'
import { MdAdd, MdDelete, MdEdit, MdToggleOn, MdToggleOff } from 'react-icons/md'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const GRADIENTS = [
  'from-accent-600 to-accent-800',
  'from-neutral-700 to-neutral-900',
  'from-emerald-600 to-teal-800',
  'from-purple-600 to-indigo-800',
  'from-rose-600 to-red-800',
  'from-amber-500 to-orange-600',
]

const BLANK = {
  title: '', subtitle: '', cta: '', ctaLink: '/',
  gradient: GRADIENTS[0], emoji: '', isActive: true, imageUrl: '',
}

export default function AdminBanners() {
  const [banners, setBanners] = useState([])
  const [loading, setL]       = useState(true)
  const [form, setForm]       = useState(BLANK)
  const [editId, setEditId]   = useState(null)
  const [open, setOpen]       = useState(false)
  const [saving, setSaving]   = useState(false)

  const load = async () => {
    setL(true)
    try { const { data } = await api.get('/banners'); setBanners(data) }
    catch { setBanners([]) }
    finally { setL(false) }
  }

  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    if (!form.title) return toast.error('Judul wajib diisi')
    setSaving(true)
    try {
      if (editId) { await api.put(`/banners/${editId}`, form); toast.success('Banner diperbarui') }
      else        { await api.post('/banners', form); toast.success('Banner dibuat') }
      setOpen(false); setEditId(null); setForm(BLANK); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Gagal menyimpan') }
    finally  { setSaving(false) }
  }

  const edit = (b) => {
    setForm({ title: b.title, subtitle: b.subtitle || '', cta: b.cta || '', ctaLink: b.ctaLink || '/',
              gradient: b.gradient || GRADIENTS[0], emoji: b.emoji || '', isActive: b.isActive !== false,
              imageUrl: b.imageUrl || '' })
    setEditId(b._id); setOpen(true)
  }

  const del = async (id) => {
    if (!window.confirm('Hapus banner ini?')) return
    try { await api.delete(`/banners/${id}`); setBanners((p) => p.filter((b) => b._id !== id)); toast.success('Dihapus') }
    catch { toast.error('Gagal menghapus') }
  }

  const toggle = async (b) => {
    try {
      await api.put(`/banners/${b._id}`, { ...b, isActive: !b.isActive })
      setBanners((p) => p.map((x) => x._id === b._id ? { ...x, isActive: !x.isActive } : x))
    } catch { toast.error('Gagal mengubah status') }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Banner Promo</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Kelola banner halaman utama</p>
        </div>
        <button onClick={() => { setEditId(null); setForm(BLANK); setOpen(true) }} className="btn-accent gap-1.5">
          <MdAdd size={16} /> Tambah Banner
        </button>
      </div>

      {/* Form */}
      {open && (
        <div className="card p-5 border-2 border-accent-200 dark:border-accent-800 animate-fade-down">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-4">
            {editId ? 'Edit Banner' : 'Banner Baru'}
          </h2>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Judul *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="Judul banner" />
              </div>
              <div>
                <label className="input-label">URL Gambar (opsional)</label>
                <input type="url" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="input" placeholder="https://..." />
              </div>
            </div>
            <div>
              <label className="input-label">Subtitle</label>
              <input type="text" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="input" placeholder="Teks kecil di bawah judul" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Teks CTA</label>
                <input type="text" value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} className="input" placeholder="Jelajahi Sekarang" />
              </div>
              <div>
                <label className="input-label">Link CTA</label>
                <input type="text" value={form.ctaLink} onChange={(e) => setForm({ ...form, ctaLink: e.target.value })} className="input" placeholder="/" />
              </div>
            </div>

            {/* Gradients */}
            <div>
              <label className="input-label">Background Gradient</label>
              <div className="flex gap-2 flex-wrap">
                {GRADIENTS.map((g) => (
                  <button
                    key={g} type="button"
                    onClick={() => setForm({ ...form, gradient: g })}
                    className={`w-9 h-9 rounded-xl bg-gradient-to-br ${g} transition-transform
                      ${form.gradient === g ? 'scale-110 ring-2 ring-offset-2 ring-accent-500' : 'hover:scale-105'}`}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <label className="input-label">Preview</label>
              <div className={`relative h-20 rounded-xl overflow-hidden bg-gradient-to-br ${form.gradient}`}>
                {form.imageUrl && <img src={form.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent flex items-center px-5">
                  <div>
                    <p className="text-white font-bold text-sm">{form.title || 'Judul Banner'}</p>
                    {form.subtitle && <p className="text-white/70 text-xs">{form.subtitle}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setOpen(false); setEditId(null) }} className="btn-secondary flex-1">Batal</button>
              <button type="submit" disabled={saving} className="btn-accent flex-1">
                {saving ? 'Menyimpan…' : editId ? 'Simpan' : 'Buat Banner'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-16 skeleton" />)}
        </div>
      ) : banners.length === 0 ? (
        <div className="card flex flex-col items-center py-14 text-center">
          <p className="text-sm text-neutral-400">Belum ada banner. Buat yang pertama!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {banners.map((b) => (
            <div key={b._id} className={`card p-3.5 flex items-center gap-3.5 ${!b.isActive ? 'opacity-50' : ''}`}>
              <div className={`w-14 h-9 rounded-lg bg-gradient-to-br ${b.gradient || GRADIENTS[0]} shrink-0 overflow-hidden`}>
                {b.imageUrl && <img src={b.imageUrl} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{b.title}</p>
                {b.subtitle && <p className="text-xs text-neutral-400 truncate">{b.subtitle}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => toggle(b)} className="btn-icon w-7 h-7 rounded-lg">
                  {b.isActive
                    ? <MdToggleOn size={20} className="text-emerald-500" />
                    : <MdToggleOff size={20} className="text-neutral-400" />
                  }
                </button>
                <button onClick={() => edit(b)} className="btn-icon w-7 h-7 rounded-lg">
                  <MdEdit size={15} />
                </button>
                <button onClick={() => del(b._id)} className="btn-icon w-7 h-7 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">
                  <MdDelete size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
