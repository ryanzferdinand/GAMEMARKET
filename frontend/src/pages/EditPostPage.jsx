import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MdUpload, MdClose, MdAdd, MdInfoOutline } from 'react-icons/md'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { ROLE_CONFIG } from '../lib/constants'
import { useCategories } from '../lib/useCategories'
import useAuthStore from '../store/authStore'
import CategoryBadge from '../components/common/CategoryBadge'
import { getImageUrl } from '../lib/avatar'

export default function EditPostPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuthStore()
  const { categories } = useCategories()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [postStatus, setPostStatus] = useState('approved')
  const [images, setImages] = useState([])
  const [form, setForm] = useState({
    title: '', description: '', price: '', gameCategoryId: '', details: {},
  })
  const [dKey, setDKey] = useState('')
  const [dVal, setDVal] = useState('')

  const needsApproval = !ROLE_CONFIG[user?.role]?.canPostWithoutApproval

  useEffect(() => {
    api.get(`/posts/${id}`)
      .then(({ data }) => {
        const post = data.post
        if (post.seller?._id !== user?._id && post.seller !== user?._id) {
          toast.error('Tidak memiliki izin')
          nav('/my-posts')
          return
        }
        if (post.status === 'sold') {
          toast.error('Postingan terjual tidak bisa diedit')
          nav('/my-posts')
          return
        }
        // pending posts CAN be edited — changes replace what's under review
        setPostStatus(post.status)
        setForm({
          title: post.title,
          description: post.description || '',
          price: String(post.price),
          gameCategoryId: post.gameCategoryId,
          details: post.details
            ? (typeof post.details.entries === 'function'
              ? Object.fromEntries(post.details)
              : post.details)
            : {},
        })
        setImages((post.images || []).map((url) => ({
          preview: getImageUrl(url),
          existing: url,
        })))
      })
      .catch(() => { toast.error('Postingan tidak ditemukan'); nav('/my-posts') })
      .finally(() => setFetching(false))
  }, [id, user?._id, nav])

  const addImages = (e) => {
    const files = Array.from(e.target.files)
    if (images.length + files.length > 5) return toast.error('Maksimal 5 gambar')
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) =>
        setImages((prev) => [...prev, { file, preview: ev.target.result }])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const removeImage = (i) => setImages((prev) => prev.filter((_, idx) => idx !== i))

  const addDetail = () => {
    if (!dKey.trim() || !dVal.trim()) return
    setForm((f) => ({ ...f, details: { ...f.details, [dKey.trim()]: dVal.trim() } }))
    setDKey(''); setDVal('')
  }

  const removeDetail = (key) => {
    setForm((f) => {
      const d = { ...f.details }
      delete d[key]
      return { ...f, details: d }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Judul wajib diisi')
    if (!form.gameCategoryId) return toast.error('Pilih kategori game')
    if (!form.price || +form.price <= 0) return toast.error('Harga tidak valid')
    if (images.length === 0) return toast.error('Minimal 1 gambar')

    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('description', form.description)
      fd.append('price', form.price)
      fd.append('gameCategoryId', form.gameCategoryId)
      fd.append('details', JSON.stringify(form.details))
      fd.append('existingImages', JSON.stringify(
        images.filter((img) => img.existing).map((img) => img.existing)
      ))
      images.filter((img) => img.file).forEach(({ file }) => fd.append('images', file))

      const { data } = await api.put(`/posts/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success(data.message || 'Postingan diperbarui')
      nav(`/post/${id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui postingan')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 w-40 skeleton rounded" />
        <div className="card p-4 h-32 skeleton" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-up">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Edit Postingan</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Perbarui detail akun yang Anda jual</p>
      </div>

      {needsApproval && (
        <div className="flex gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50">
          <MdInfoOutline className="text-amber-500 shrink-0 mt-0.5" size={17} />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {postStatus === 'pending'
              ? 'Postingan ini sedang menunggu tinjauan admin. Perubahan yang disimpan akan menggantikan versi yang sedang ditinjau.'
              : 'Jika postingan sudah aktif, perubahan akan memerlukan persetujuan ulang admin.'}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Section title="Foto Akun" required hint="Maksimal 5 gambar, min. 1">
          <div className="flex gap-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative w-20 h-16 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 group">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white"
                >
                  <MdClose size={16} />
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <label className="w-20 h-16 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700
                                flex flex-col items-center justify-center gap-1 cursor-pointer
                                hover:border-accent-400 hover:bg-accent-50 dark:hover:bg-accent-950/20 transition-all">
                <MdUpload size={18} className="text-neutral-400" />
                <span className="text-2xs text-neutral-400">Upload</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={addImages} />
              </label>
            )}
          </div>
        </Section>

        <Section title="Kategori Game" required>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setForm((f) => ({ ...f, gameCategoryId: cat.id }))}
                className={`flex flex-col items-center gap-1.5 p-2.5 sm:p-3 rounded-xl border-2 text-xs transition-all
                  ${form.gameCategoryId === cat.id
                    ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/30 text-accent-700 dark:text-accent-400 font-medium'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
                  }`}
              >
                <CategoryBadge cat={cat} size="md" />
                <span className="text-center leading-tight line-clamp-2 w-full">{cat.name}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Judul" required>
          <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="input" maxLength={100} />
        </Section>

        <Section title="Harga" required>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-medium">Rp</span>
            <input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="input pl-10" min="1000" />
          </div>
        </Section>

        <Section title="Deskripsi">
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="input resize-none min-h-[96px]" maxLength={2000} />
        </Section>

        <Section title="Detail Akun" hint="Opsional">
          <div className="flex gap-2">
            <input type="text" value={dKey} onChange={(e) => setDKey(e.target.value)} placeholder="Label" className="input flex-1" />
            <input type="text" value={dVal} onChange={(e) => setDVal(e.target.value)} placeholder="Nilai" className="input flex-1" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDetail())} />
            <button type="button" onClick={addDetail} className="btn-secondary px-3 shrink-0"><MdAdd size={17} /></button>
          </div>
          {Object.keys(form.details).length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {Object.entries(form.details).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-2xs text-neutral-400 capitalize">{k}</p>
                    <p className="text-sm font-medium">{v}</p>
                  </div>
                  <button type="button" onClick={() => removeDetail(k)} className="text-neutral-400 hover:text-red-500"><MdClose size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => nav(-1)} className="btn-secondary flex-1 py-2.5">Batal</button>
          <button type="submit" disabled={loading} className="btn-accent flex-1 py-2.5">
            {loading ? 'Menyimpan…' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({ title, required, hint, children }) {
  return (
    <div className="card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          {title}{required && <span className="text-red-400 ml-0.5">*</span>}
        </p>
        {hint && <p className="text-2xs text-neutral-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  )
}
