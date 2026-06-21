import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MdPersonOutline, MdMailOutline, MdLockOutline,
  MdVisibility, MdVisibilityOff,
} from 'react-icons/md'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { GOOGLE_CLIENT_ID } from '../lib/constants'
import { ensureGoogleSignIn, renderGoogleButton } from '../lib/googleAuth'

export default function RegisterPage() {
  const { register, loginWithGoogle, isLoading } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '', role: 'buyer',
  })
  const [showPwd, setShow] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const btnRef = useRef(null)

  const handleGoogleSuccess = useCallback(async (credential) => {
    setGoogleLoading(true)
    try {
      const r = await loginWithGoogle(credential)
      if (r.success) {
        toast.success(r.isNew ? 'Akun dibuat' : 'Masuk berhasil')
        navigate('/', { replace: true })
      } else {
        toast.error(r.error || 'Login Google gagal')
      }
    } finally {
      setGoogleLoading(false)
    }
  }, [loginWithGoogle, navigate])

  const handleGoogleError = useCallback((msg) => {
    if (msg && msg !== 'Login Google dibatalkan') toast.error(msg)
  }, [])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    ensureGoogleSignIn(handleGoogleSuccess, handleGoogleError)
      .then(() => {
        const width = btnRef.current?.offsetWidth || 360
        renderGoogleButton('g-btn-reg', { width, text: 'signup_with' })
      })
      .catch(console.error)
  }, [handleGoogleSuccess, handleGoogleError])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.email || !form.password) return toast.error('Isi semua field')
    if (form.username.length < 3)               return toast.error('Username minimal 3 karakter')
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return toast.error('Username hanya huruf, angka, underscore')
    if (form.password.length < 8)               return toast.error('Password minimal 8 karakter')
    if (form.password !== form.confirmPassword)  return toast.error('Password tidak cocok')
    const r = await register({ username: form.username, email: form.email, password: form.password, role: form.role })
    if (r.success) {
      if (r.requiresVerification) {
        toast.success('Akun dibuat! Cek email untuk kode verifikasi.')
        navigate(`/verify-email?userId=${r.userId}&email=${encodeURIComponent(r.email)}`)
      } else {
        toast.success('Akun berhasil dibuat')
        navigate('/')
      }
    } else {
      toast.error(r.error)
    }
  }

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  return (
    <div className="animate-fade-in">
      <h1 style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontSize: 28, fontWeight: 600, letterSpacing: '-0.374px', color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.14 }}>
        Buat Akun
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 24, letterSpacing: '-0.224px' }}>
        Sudah punya akun?{' '}
        <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}
          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
        >
          Masuk
        </Link>
      </p>

      {GOOGLE_CLIENT_ID && (
        <div ref={btnRef} id="g-btn-reg" style={{ width: '100%', marginBottom: 12, minHeight: 44, position: 'relative' }}>
          {googleLoading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', borderRadius: 11, zIndex: 1, fontSize: 14, color: 'var(--text-secondary)', gap: 8 }}>
              Memproses Google…
            </div>
          )}
        </div>
      )}
      <AppleDivider />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Username */}
        <div>
          <label className="input-label">Username <Req /></label>
          <div style={{ position: 'relative' }}>
            <MdPersonOutline
              size={16}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7a7a7a', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={form.username}
              onChange={(e) => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
              placeholder="username_kamu"
              maxLength={20}
              className="input-rect"
              style={{ paddingLeft: 38 }}
            />
          </div>
          <p style={{ fontSize: 11, color: '#7a7a7a', marginTop: 4, letterSpacing: '-0.08px' }}>
            3–20 karakter, huruf/angka/underscore
          </p>
        </div>

        {/* Email */}
        <div>
          <label className="input-label">Email <Req /></label>
          <div style={{ position: 'relative' }}>
            <MdMailOutline
              size={16}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7a7a7a', pointerEvents: 'none' }}
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="nama@email.com"
              className="input-rect"
              style={{ paddingLeft: 38 }}
              autoComplete="email"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="input-label">Password <Req /></label>
          <div style={{ position: 'relative' }}>
            <MdLockOutline
              size={16}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7a7a7a', pointerEvents: 'none' }}
            />
            <input
              type={showPwd ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="Min. 6 karakter"
              className="input-rect"
              style={{ paddingLeft: 38, paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#7a7a7a', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {showPwd ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="input-label">Konfirmasi Password <Req /></label>
          <div style={{ position: 'relative' }}>
            <MdLockOutline
              size={16}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7a7a7a', pointerEvents: 'none' }}
            />
            <input
              type={showPwd ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              placeholder="Ulangi password"
              className="input-rect"
              style={{ paddingLeft: 38 }}
            />
          </div>
        </div>

        {/* Role selector */}
        <div>
          <label className="input-label">Saya ingin</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { value: 'buyer',  label: 'Membeli Akun',  desc: 'Cari & beli akun game' },
              { value: 'seller', label: 'Menjual Akun',  desc: 'Jual akun game Anda' },
            ].map((opt) => {
              const active = form.role === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('role', opt.value)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 11,
                    border: active ? '2px solid #0066cc' : '1px solid #e0e0e0',
                    textAlign: 'left',
                    backgroundColor: active ? 'rgba(0,102,204,0.05)' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                  }}
                >
                  <p
                    style={{
                      fontSize: 14, fontWeight: 600, letterSpacing: '-0.224px',
                      color: active ? '#0066cc' : '#1d1d1f',
                      marginBottom: 3, lineHeight: 1,
                    }}
                  >
                    {opt.label}
                  </p>
                  <p style={{ fontSize: 12, color: active ? '#0066cc' : '#7a7a7a', letterSpacing: '-0.12px' }}>
                    {opt.desc}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
        >
          {isLoading
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Spinner /> Mendaftar…</span>
            : 'Buat Akun'
          }
        </button>

        <p style={{ fontSize: 11, textAlign: 'center', color: '#7a7a7a', letterSpacing: '-0.08px' }}>
          Dengan mendaftar, Anda menyetujui{' '}
          <span style={{ color: '#0066cc', cursor: 'pointer' }}>Syarat & Ketentuan</span>
          {' '}dan{' '}
          <span style={{ color: '#0066cc', cursor: 'pointer' }}>Kebijakan Privasi</span>
        </p>
      </form>
    </div>
  )
}

const Req = () => <span style={{ color: '#ff3b30', marginLeft: 2 }}>*</span>
const Spinner = () => (
  <span
    style={{
      width: 16, height: 16,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#ffffff',
      borderRadius: 9999,
      display: 'inline-block',
      animation: 'spin 0.7s linear infinite',
    }}
  />
)

function AppleDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{ flex: 1, height: 1, backgroundColor: '#e0e0e0' }} />
      <span style={{ fontSize: 13, color: '#7a7a7a', letterSpacing: '-0.12px' }}>atau dengan email</span>
      <div style={{ flex: 1, height: 1, backgroundColor: '#e0e0e0' }} />
    </div>
  )
}
