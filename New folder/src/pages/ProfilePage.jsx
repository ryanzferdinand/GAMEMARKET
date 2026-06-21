import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  MdVerified, MdChatBubbleOutline, MdEdit, MdClose,
  MdCameraAlt, MdSave, MdCalendarToday, MdStar,
  MdSell, MdOpenInNew,
} from 'react-icons/md'
import PostCard from '../components/common/PostCard'
import UserBadge from '../components/common/UserBadge'
import RoleName from '../components/common/RoleName'
import OnlineDot from '../components/common/OnlineDot'
import ReviewSection from '../components/common/ReviewSection'
import { ReportButton } from '../components/common/ReportModal'
import StarRating from '../components/common/StarRating'
import api from '../lib/api'
import useAuthStore from '../store/authStore'
import useRatingStore from '../store/ratingStore'
import useUIStore from '../store/uiStore'
import { getAvatar, getImageUrl } from '../lib/avatar'
import { getSocket } from '../lib/socket'
import toast from 'react-hot-toast'

const BANNER_PRESETS = [
  'from-neutral-800 to-neutral-900',
  'from-accent-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-purple-600 to-pink-600',
  'from-rose-600 to-red-700',
  'from-amber-500 to-orange-600',
  'from-slate-600 to-slate-800',
  'from-cyan-600 to-blue-700',
]

/* ── Edit Profile Modal ──────────────────────────────────── */
function EditModal({ profile, onClose, onSave }) {
  const [form, setForm] = useState({
    username: profile.username,
    bio: profile.bio || '',
    bannerColor: profile.bannerColor || BANNER_PRESETS[0],
  })
  const [saving, setSaving] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(null)
  const [bannerFile, setBannerFile] = useState(null)
  const avatarRef = useRef(null)
  const bannerRef = useRef(null)

  const pickImage = (file, setPreview, setFile) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Maksimal 5MB'); return }
    setFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Upload avatar if changed
      if (avatarFile) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        const { data } = await api.post('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        onSave(data)
      }
      // Upload banner if changed
      if (bannerFile) {
        const fd = new FormData()
        fd.append('banner', bannerFile)
        const { data } = await api.post('/users/me/banner', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        onSave(data)
      }
      // Update text fields
      const { data } = await api.patch('/users/me', form)
      onSave(data)
      toast.success('Profil diperbarui')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="card animate-scale-in" style={{ width: '100%', maxWidth: 480, overflow: 'hidden' }}>
        {/* Banner preview */}
        <div className={`relative h-24 bg-gradient-to-r ${bannerPreview ? '' : form.bannerColor}`}>
          {bannerPreview && <img src={bannerPreview} className="w-full h-full object-cover" alt="" />}
          <button
            type="button"
            onClick={() => bannerRef.current.click()}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.5)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.3)'}
          >
            <MdCameraAlt size={16} /> Ganti Banner
          </button>
          <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => pickImage(e.target.files[0], setBannerPreview, setBannerFile)} />
        </div>

        {/* Avatar */}
        <div className="px-6 pb-2 flex items-end gap-3" style={{ marginTop: -28 }}>
          <div className="relative" style={{ flexShrink: 0 }}>
            <img
              src={avatarPreview || getAvatar(profile.avatar, profile.username)}
              style={{ width: 56, height: 56, borderRadius: 14, border: '3px solid var(--bg-elevated)', objectFit: 'cover', display: 'block' }}
              alt=""
            />
            <button
              type="button"
              onClick={() => avatarRef.current.click()}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff', border: 'none', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.45)'}
            >
              <MdCameraAlt size={16} />
            </button>
            <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => pickImage(e.target.files[0], setAvatarPreview, setAvatarFile)} />
          </div>
          <div style={{ flex: 1, paddingTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Klik gambar untuk mengganti</p>
            <button type="button" onClick={onClose} className="btn-icon" style={{ width: 30, height: 30 }}>
              <MdClose size={15} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="px-6 pb-6 space-y-4">
          {/* Username */}
          <div>
            <label className="input-label">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
              className="input"
              maxLength={20}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="input-label">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Ceritakan sedikit tentang dirimu…"
              className="input resize-none min-h-[72px]"
              maxLength={200}
            />
            <p className="text-2xs text-neutral-400 text-right mt-1">{form.bio.length}/200</p>
          </div>

          {/* Banner color preset */}
          <div>
            <label className="input-label">Warna Banner</label>
            <div className="flex gap-2 flex-wrap">
              {BANNER_PRESETS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setForm({ ...form, bannerColor: g })}
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${g} transition-transform
                    ${form.bannerColor === g ? 'scale-110 ring-2 ring-offset-2 ring-accent-500' : 'hover:scale-105'}`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button type="submit" disabled={saving} className="btn-accent flex-1 gap-2">
              {saving
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <MdSave size={15} />
              }
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Main Profile Page ────────────────────────────────────── */
export default function ProfilePage() {
  const { username }  = useParams()
  const { user, updateUser } = useAuthStore()
  const { openChat } = useUIStore()
  const [profile, setProfile] = useState(null)
  const [posts, setPosts]     = useState([])
  const [postTotal, setPostTotal] = useState(0)
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setL]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [editOpen, setEdit]   = useState(false)
  const [tab, setTab]         = useState('posts')
  const cachedRating = useRatingStore((s) =>
    profile ? s.cache[profile._id?.toString()] : null
  )

  const load = async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true)
    else setL(true)
    try {
      if (!append) {
        const pRes = await api.get(`/users/${username}`)
        setProfile(pRes.data)
      }
      const postsRes = await api.get('/posts', { params: { seller: username, page: pageNum, limit: 12 } })
      setPosts((prev) => append ? [...prev, ...(postsRes.data.posts || [])] : (postsRes.data.posts || []))
      setPostTotal(postsRes.data.total ?? postsRes.data.posts?.length ?? 0)
      setHasMore(postsRes.data.hasMore ?? false)
      setPage(pageNum)
    } catch { toast.error('Profil tidak ditemukan') }
    finally {
      setL(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    setPage(1)
    load(1)
  }, [username])

  // Real-time: update totalSales when a post is marked sold
  useEffect(() => {
    if (!profile?._id) return
    const socket = getSocket()
    const onStatsUpdated = ({ sellerId, totalSales }) => {
      if (sellerId !== profile._id?.toString()) return
      setProfile((p) => p ? { ...p, totalSales } : p)
      if (user && user._id === profile._id) {
        updateUser({ totalSales })
      }
    }
    socket.on('seller:stats-updated', onStatsUpdated)
    return () => socket.off('seller:stats-updated', onStatsUpdated)
  }, [profile?._id, user?._id])

  const handleSave = (updated) => {
    setProfile(updated)
    if (user && profile && user._id === profile._id) updateUser(updated)
  }

  const handleRatingUpdate = useCallback((stats) => {
    setProfile((p) => p ? { ...p, rating: stats.rating, ratingCount: stats.ratingCount } : p)
    if (user && profile && user._id === profile._id) {
      updateUser({ rating: stats.rating, ratingCount: stats.ratingCount })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?._id, user?._id])

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="card h-52 skeleton" />
      <div className="card h-24 skeleton" />
    </div>
  )
  if (!profile) return null

  // Compare by _id so isOwn stays correct after a username change
  const isOwn = !!user && user._id === profile._id

  const liveRating = cachedRating?.rating ?? profile.rating
  const liveRatingCount = cachedRating?.ratingCount ?? profile.ratingCount

  const joined = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })
    : '—'

  const bannerBg = profile.bannerColor || 'from-neutral-800 to-neutral-900'

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Profile card */}
      <div className="card overflow-hidden">
        {/* Banner */}
        <div className={`relative h-32 bg-gradient-to-r ${profile.banner ? '' : bannerBg}`}>
          {profile.banner && (
            <img src={getImageUrl(profile.banner)} alt="" className="w-full h-full object-cover" />
          )}
        </div>

        <div className="px-5 pb-5">
          {/* Avatar row — avatar lifts out of banner, buttons sit below the banner edge */}
          <div className="flex items-start justify-between" style={{ marginTop: -36 }}>
            {/* Avatar */}
            <div className="relative" style={{ flexShrink: 0 }}>
              <img
                src={getAvatar(profile.avatar, profile.username)}
                alt={profile.username}
                style={{
                  width: 72, height: 72, borderRadius: 18,
                  border: '3px solid var(--bg-elevated)',
                  objectFit: 'cover',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                  display: 'block',
                }}
              />
              <OnlineDot
                userId={profile._id}
                size={9}
                style={{ position: 'absolute', bottom: 2, right: 2 }}
              />
            </div>

            {/* Action buttons — pushed down to clear the banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 44 }}>
              {!isOwn && user && (
                <>
                  <button
                    onClick={() => openChat(profile)}
                    className="btn-primary"
                    style={{ padding: '8px 14px', fontSize: 13, gap: 6 }}
                  >
                    <MdChatBubbleOutline size={14} />
                    Pesan
                  </button>
                  {/* Icon-only flag — unobtrusive, clearly separate from the main action */}
                  <ReportButton
                    targetType="user"
                    targetId={profile._id}
                    targetLabel={profile.username}
                    ownerId={profile._id}
                    iconOnly
                  />
                </>
              )}
              {isOwn && (
                <button
                  onClick={() => setEdit(true)}
                  className="btn-secondary"
                  style={{ padding: '8px 14px', fontSize: 13, gap: 6 }}
                >
                  <MdEdit size={14} />
                  Edit Profil
                </button>
              )}
            </div>
          </div>

          {/* Name + badge */}
          <div className="flex items-center gap-2 flex-wrap mb-1" style={{ marginTop: 10 }}>
            <RoleName
              username={profile.username}
              role={profile.role}
              size="base"
              className="font-bold tracking-tight"
            />
            {profile.verified && <MdVerified style={{ color: 'var(--accent)' }} size={16} />}
            <UserBadge role={profile.role} />
          </div>

          {profile.bio && (
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, maxWidth: 460, lineHeight: 1.5 }}>
              {profile.bio}
            </p>
          )}

          {/* Meta info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <MdCalendarToday size={13} />
              Bergabung {joined}
            </span>
            {liveRating > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#ff9f0a', fontWeight: 500 }}>
                <StarRating value={liveRating} readonly size={12} />
                {liveRating.toFixed(1)} ({liveRatingCount || 0})
              </span>
            )}
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'Total Terjual', val: profile.totalSales || 0,         icon: MdSell,     color: '#34c759' },
              { label: 'Rating',        val: liveRating ? liveRating.toFixed(1) : '—', icon: MdStar, color: '#ff9f0a' },
              { label: 'Postingan',     val: postTotal || posts.length,      icon: MdOpenInNew, color: 'var(--accent)' },
            ].map(({ label, val, icon: Icon, color }) => (
              <div key={label} style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                <Icon size={16} style={{ color, margin: '0 auto 4px' }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{val}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[
          { id: 'posts',   label: 'Postingan', count: postTotal || posts.length },
          { id: 'reviews', label: 'Review',    count: liveRatingCount || 0 },
        ].map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: '8px 18px',
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: tab === id ? 600 : 400,
              letterSpacing: '-0.224px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease',
              backgroundColor: tab === id ? 'var(--text-primary)' : 'var(--bg-secondary)',
              color: tab === id ? 'var(--bg)' : 'var(--text-secondary)',
            }}
          >
            {label}
            <span style={{ marginLeft: 5, opacity: 0.55 }}>({count})</span>
          </button>
        ))}
      </div>

      {tab === 'reviews' ? (
        <div className="card" style={{ padding: '20px' }}>
          <ReviewSection
            sellerId={profile._id}
            sellerUsername={profile.username}
            isSellerView={isOwn}
            onRatingUpdate={handleRatingUpdate}
          />
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Belum ada postingan</p>
          {isOwn && (
            <Link to="/create-post" className="btn-primary" style={{ marginTop: 12, fontSize: 13 }}>
              Buat Postingan
            </Link>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {posts.map((p) => <PostCard key={p._id} post={p} />)}
          </div>
          {hasMore && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => load(page + 1, true)}
                disabled={loadingMore}
                className="btn-secondary"
                style={{ minWidth: 180 }}
              >
                {loadingMore ? 'Memuat…' : 'Muat Lebih Banyak'}
              </button>
            </div>
          )}
        </>
      )}
      {editOpen && (
        <EditModal profile={profile} onClose={() => setEdit(false)} onSave={handleSave} />
      )}
    </div>
  )
}
