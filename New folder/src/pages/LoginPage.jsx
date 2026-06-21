import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MdMailOutline, MdLockOutline, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { GOOGLE_CLIENT_ID } from '../lib/constants'

export default function LoginPage() {
  const { login, loginWithGoogle, isLoading } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [showPwd, setShow]  = useState(false)

  useEffect(() => {
    const notice = sessionStorage.getItem('ban-notice')
    if (notice) {
      toast.error(`Akun diblokir: ${notice}`)
      sessionStorage.removeItem('ban-notice')
    }
  }, [])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogle,
      })
      window.google?.accounts.id.renderButton(
        document.getElementById('g-btn'),
        { theme: 'outline', size: 'large', width: '100%', text: 'signin_with' }
      )
    }
    document.body.appendChild(script)
    return () => document.body.removeChild(script)
  }, [])

  const handleGoogle = async (res) => {
    const r = await loginWithGoogle(res.credential)
    if (r.success) { toast.success('Berhasil masuk'); navigate('/') }
    else toast.error(r.error)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) return toast.error('Isi semua field')
    const r = await login(form)
    if (r.success) { toast.success('Selamat datang kembali'); navigate('/') }
    else toast.error(r.error)
  }

  return (
    <div className="animate-fade-in">
      <h1 style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontSize: 28, fontWeight: 600, letterSpacing: '-0.374px', color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.14 }}>
        Masuk
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 24, letterSpacing: '-0.224px' }}>
        Belum punya akun?{' '}
        <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}
          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
        >
          Daftar gratis
        </Link>
      </p>

      {/* Google */}
      {GOOGLE_CLIENT_ID ? (
        <>
          <div id="g-btn" style={{ width: '100%', marginBottom: 16 }} />
          <AppleDivider label="atau lanjutkan dengan email" />
        </>
      ) : (
        <>
          <GoogleFallback />
          <AppleDivider label="atau lanjutkan dengan email" />
        </>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AppleField label="Email" icon={<MdMailOutline size={16} />}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="nama@email.com"
            className="input-rect"
            style={{ paddingLeft: 38 }}
            autoComplete="email"
          />
        </AppleField>

        <AppleField
          label="Password"
          icon={<MdLockOutline size={16} />}
          right={
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                color: '#7a7a7a', background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              {showPwd ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
            </button>
          }
        >
          <input
            type={showPwd ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Password"
            className="input-rect"
            style={{ paddingLeft: 38, paddingRight: 40 }}
            autoComplete="current-password"
          />
        </AppleField>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary"
          style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}
        >
          {isLoading
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Spinner /> Memproses…</span>
            : 'Masuk'
          }
        </button>
      </form>
    </div>
  )
}

/* ── Helpers ── */
function AppleDivider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap', letterSpacing: '-0.12px' }}>{label}</span>
      <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
    </div>
  )
}

function AppleField({ label, icon, right, children }) {
  return (
    <div>
      <label className="input-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: '#7a7a7a', pointerEvents: 'none',
          }}
        >
          {icon}
        </span>
        {children}
        {right}
      </div>
    </div>
  )
}

function Spinner() {
  return (
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
}

function GoogleFallback() {
  return (
    <button
      type="button"
      onClick={() => toast.error('Atur Google Client ID di .env terlebih dahulu')}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: '11px 16px', marginBottom: 16,
        border: '1px solid var(--border)', borderRadius: 11,
        fontSize: 15, fontWeight: 400, letterSpacing: '-0.224px',
        color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)', cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'}
    >
      <GoogleIcon />
      Masuk dengan Google
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
