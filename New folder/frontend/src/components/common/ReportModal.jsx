import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MdClose, MdFlag } from 'react-icons/md'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'

export default function ReportModal({ open, onClose, targetType, targetId, targetLabel }) {
  const { user }    = useAuthStore()
  const [reasons, setReasons]         = useState([])
  const [reason, setReason]           = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    if (open) {
      api.get('/reports/reasons').then(({ data }) => setReasons(data)).catch(() => {})
      setReason('')
      setDescription('')
    }
  }, [open])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (!user) return toast.error('Login untuk melaporkan')
    if (!reason) return toast.error('Pilih alasan laporan')
    setSubmitting(true)
    try {
      await api.post('/reports', { targetType, targetId, reason, description })
      toast.success('Laporan berhasil dikirim.')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim laporan')
    } finally { setSubmitting(false) }
  }

  // Render at document.body via portal — completely outside any scroll container
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,            /* above everything */
        display: 'flex',
        alignItems: 'center',     /* always vertically centered */
        justifyContent: 'center',
        padding: '20px 16px',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="animate-scale-in"
        style={{
          backgroundColor: 'rgba(22, 22, 24, 0.94)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(255, 255, 255, 0.10)',
          borderRadius: 18,
          width: '100%',
          maxWidth: 420,
          maxHeight: 'calc(100dvh - 40px)', /* dvh = dynamic viewport height, avoids keyboard */
          overflowY: 'auto',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06) inset',
          color: '#f5f5f7',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdFlag style={{ color: 'var(--color-red)' }} size={17} />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.224px', margin: 0 }}>Laporkan</h2>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9999, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'background-color 0.15s ease' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            <MdClose size={17} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {targetLabel && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Melaporkan: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{targetLabel}</span>
            </p>
          )}

          <div>
            <label className="input-label">Alasan</label>
            <div style={{ position: 'relative' }}>
              <select value={reason} onChange={(e) => setReason(e.target.value)} required
                style={{ width: '100%', padding: '11px 36px 11px 14px', borderRadius: 11, border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: reason ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 15, fontFamily: 'inherit', letterSpacing: '-0.224px', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', transition: 'border-color 0.15s ease' }}
                onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}>
                <option value="">Pilih alasan…</option>
                {reasons.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} width="12" height="8" viewBox="0 0 12 8" fill="none">
                <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          <div>
            <label className="input-label">Detail <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(opsional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Jelaskan masalahnya…" maxLength={500}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 11, resize: 'none', border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 15, fontFamily: 'inherit', letterSpacing: '-0.224px', lineHeight: 1.5, minHeight: 88, outline: 'none', transition: 'border-color 0.15s ease' }}
              onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: 3 }}>{description.length}/500</p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 15 }}>Batal</button>
            <button type="submit" disabled={submitting}
              style={{ flex: 1, padding: '11px 16px', borderRadius: 9999, backgroundColor: submitting ? 'rgba(255,59,48,0.6)' : '#ff3b30', color: '#ffffff', fontSize: 15, fontWeight: 400, fontFamily: 'inherit', letterSpacing: '-0.224px', border: 'none', cursor: submitting ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background-color 0.15s ease' }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#e02e22' }}
              onMouseLeave={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#ff3b30' }}>
              {submitting && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: 9999, display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
              {submitting ? 'Mengirim…' : 'Kirim Laporan'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export function ReportButton({ targetType, targetId, targetLabel, ownerId = null, className = '', iconOnly = false }) {
  const [open, setOpen] = useState(false)
  const { user } = useAuthStore()

  if (!user) return null
  if (ownerId && user._id?.toString() === ownerId?.toString()) return null

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}
        title="Laporkan"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: iconOnly ? 0 : 5,
          fontSize: 13, color: 'var(--text-muted)',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: iconOnly ? '6px' : '6px 10px', borderRadius: 9999,
          transition: 'color 0.15s ease, background-color 0.15s ease',
          letterSpacing: '-0.12px',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-red)'; e.currentTarget.style.backgroundColor = 'rgba(255,59,48,0.07)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}>
        <MdFlag size={iconOnly ? 15 : 14} />
        {!iconOnly && 'Laporkan'}
      </button>
      <ReportModal open={open} onClose={() => setOpen(false)} targetType={targetType} targetId={targetId} targetLabel={targetLabel} />
    </>
  )
}
