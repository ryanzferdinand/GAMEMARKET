/**
 * VerifyEmailPage.jsx
 *
 * OTP-only verification page.
 * Shows 6 individual digit boxes, auto-submit on fill,
 * paste support, 60-second resend cooldown, shake on error.
 * Fully responsive — works on mobile and desktop.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { MdCheckCircle, MdLockOutline, MdRefresh, MdArrowBack } from 'react-icons/md'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/authStore'

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(initial = 0) {
  const [count, setCount] = useState(initial)
  const timerRef = useRef(null)

  const start = useCallback((seconds) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCount(seconds)
    timerRef.current = setInterval(() => {
      setCount((n) => {
        if (n <= 1) { clearInterval(timerRef.current); return 0 }
        return n - 1
      })
    }, 1000)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  return { count, start }
}

// ── CircularProgress for countdown ───────────────────────────────────────────
function CircularTimer({ seconds, total = 60 }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const pct = seconds / total
  const dash = circ * pct

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
      {/* Track */}
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      {/* Progress */}
      <circle
        cx="22" cy="22" r={r}
        fill="none"
        stroke="#0066cc"
        strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s linear' }}
      />
      {/* Text — rotate back so it reads correctly */}
      <text
        x="22" y="22"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: '22px 22px', fontSize: 11, fontWeight: 700, fill: '#0066cc', fontFamily: 'system-ui' }}
      >
        {seconds}
      </text>
    </svg>
  )
}

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const { setAuth }    = useAuthStore()

  const userId     = searchParams.get('userId')
  const emailParam = searchParams.get('email') || ''

  const [digits, setDigits]     = useState(['', '', '', '', '', ''])
  const [phase, setPhase]       = useState('input')   // input | loading | success | error
  const [errMsg, setErrMsg]     = useState('')
  const [shake, setShake]       = useState(false)
  const [resending, setResending] = useState(false)

  const inputRefs = useRef([])
  const { count: cooldown, start: startCooldown } = useCountdown(60)

  // Start cooldown immediately — user just came from register
  useEffect(() => { startCooldown(60) }, [])

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 120)
  }, [])

  // ── OTP helpers ────────────────────────────────────────────────────────────
  const handleChange = (i, raw) => {
    const val = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = val
    setDigits(next)
    if (val && i < 5) inputRefs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits]; next[i] = ''; setDigits(next)
      } else if (i > 0) {
        inputRefs.current[i - 1]?.focus()
      }
    }
    if (e.key === 'ArrowLeft'  && i > 0) inputRefs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) inputRefs.current[i + 1]?.focus()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted.length) return
    const next = ['', '', '', '', '', '']
    pasted.split('').forEach((ch, i) => { next[i] = ch })
    setDigits(next)
    const lastFilled = Math.min(pasted.length, 5)
    inputRefs.current[lastFilled]?.focus()
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submit = useCallback(async (codeOverride) => {
    const code = codeOverride || digits.join('')
    if (code.length !== 6) return
    setPhase('loading')
    try {
      const { data } = await api.post('/auth/verify-otp', { userId, otp: code })
      setPhase('success')
      if (data.token && data.user) {
        setAuth(data.token, data.user)
        toast.success('Email berhasil diverifikasi!')
        setTimeout(() => navigate('/'), 1800)
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Kode salah atau sudah kedaluwarsa'
      setErrMsg(msg)
      setPhase('error')
      setShake(true)
      setTimeout(() => {
        setShake(false)
        setPhase('input')
        setDigits(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }, 820)
    }
  }, [digits, userId, navigate, setAuth])

  // Auto-submit when all 6 filled
  useEffect(() => {
    if (digits.every(Boolean) && phase === 'input') {
      submit(digits.join(''))
    }
  }, [digits])

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    try {
      await api.post('/auth/resend-verification', { userId, email: emailParam })
      toast.success('Kode baru dikirim ke email kamu')
      setDigits(['', '', '', '', '', ''])
      setErrMsg('')
      setPhase('input')
      startCooldown(60)
      setTimeout(() => inputRefs.current[0]?.focus(), 80)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim ulang. Coba lagi.')
    } finally {
      setResending(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const isLoading = phase === 'loading'
  const isError   = phase === 'error'
  const isDone    = phase === 'success'

  // Mask email: ab***@domain.com
  const maskedEmail = (() => {
    if (!emailParam) return ''
    const [local, domain] = emailParam.split('@')
    if (!domain) return emailParam
    const visible = local.slice(0, Math.min(2, local.length))
    return `${visible}***@${domain}`
  })()

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>

      {/* ── Back link ── */}
      <Link
        to="/login"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none',
          marginBottom: 28,
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <MdArrowBack size={16} /> Kembali ke Login
      </Link>

      {/* ── Icon + Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: isDone
            ? 'linear-gradient(135deg,#34c759,#30d158)'
            : 'linear-gradient(135deg,#0055bb,#0077ed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
          boxShadow: isDone
            ? '0 8px 24px rgba(48,209,88,0.28)'
            : '0 8px 24px rgba(0,102,204,0.28)',
          transition: 'background 0.4s ease, box-shadow 0.4s ease',
        }}>
          {isDone
            ? <MdCheckCircle size={34} style={{ color: '#fff' }} />
            : <MdLockOutline size={32} style={{ color: '#fff' }} />}
        </div>

        <h1 style={{
          fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px',
          color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.2,
        }}>
          {isDone ? 'Email Terverifikasi!' : 'Masukkan Kode OTP'}
        </h1>

        {!isDone && (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>
            Kami mengirim kode 6 digit ke{' '}
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {maskedEmail || 'email kamu'}
            </strong>
            . Cek inbox dan folder spam.
          </p>
        )}

        {isDone && (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            Mengalihkan ke beranda…
          </p>
        )}
      </div>

      {/* ── OTP Boxes ── */}
      {!isDone && (
        <>
          <style>{`
            @keyframes shake {
              0%,100%{transform:translateX(0)}
              15%{transform:translateX(-8px)}
              30%{transform:translateX(8px)}
              45%{transform:translateX(-6px)}
              60%{transform:translateX(6px)}
              75%{transform:translateX(-3px)}
              90%{transform:translateX(3px)}
            }
            .otp-shake { animation: shake 0.75s cubic-bezier(.36,.07,.19,.97) both; }
            .otp-input:focus { border-color: #0066cc !important; box-shadow: 0 0 0 3px rgba(0,102,204,0.12) !important; }
          `}</style>

          <div
            onPaste={handlePaste}
            className={shake ? 'otp-shake' : ''}
            style={{
              display: 'flex',
              gap: 'clamp(7px, 2vw, 12px)',
              justifyContent: 'center',
              marginBottom: isError ? 12 : 24,
            }}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => (inputRefs.current[i] = el)}
                className="otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={d}
                disabled={isLoading}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onFocus={e => e.target.select()}
                style={{
                  width: 'clamp(42px, 12vw, 54px)',
                  height: 'clamp(50px, 14vw, 62px)',
                  textAlign: 'center',
                  fontSize: 'clamp(20px, 5vw, 26px)',
                  fontWeight: 800,
                  fontFamily: '"SF Mono", Menlo, "Courier New", monospace',
                  borderRadius: 14,
                  border: isError
                    ? '2px solid #ff3b30'
                    : d
                    ? '2px solid #0066cc'
                    : '1.5px solid var(--border)',
                  backgroundColor: isError
                    ? 'rgba(255,59,48,0.04)'
                    : d
                    ? 'rgba(0,102,204,0.04)'
                    : 'var(--bg-elevated)',
                  color: isError ? '#ff3b30' : 'var(--text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
                  cursor: isLoading ? 'not-allowed' : 'text',
                  caretColor: '#0066cc',
                  opacity: isLoading ? 0.6 : 1,
                }}
              />
            ))}
          </div>

          {/* Error message */}
          {errMsg && (
            <p style={{
              textAlign: 'center', color: '#ff3b30', fontSize: 13,
              marginBottom: 16, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <span>⚠</span> {errMsg}
            </p>
          )}

          {/* Submit button */}
          <button
            type="button"
            onClick={() => submit()}
            disabled={isLoading || digits.some(d => !d)}
            className="btn-primary"
            style={{
              width: '100%', justifyContent: 'center',
              height: 48, fontSize: 15, fontWeight: 600,
              marginBottom: 24,
              opacity: (isLoading || digits.some(d => !d)) ? 0.5 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spinner /> Memverifikasi…
              </span>
            ) : 'Verifikasi Sekarang'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-soft)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tidak menerima kode?</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-soft)' }} />
          </div>

          {/* Resend row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {cooldown > 0 ? (
              <>
                <CircularTimer seconds={cooldown} total={60} />
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, margin: 0 }}>
                    Kirim ulang dalam {cooldown} detik
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Cek folder spam jika belum ada
                  </p>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 20px',
                  fontSize: 14, fontWeight: 600,
                  color: resending ? 'var(--text-muted)' : '#0066cc',
                  cursor: resending ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { if (!resending) e.currentTarget.style.backgroundColor = 'var(--bg-elevated)' }}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
              >
                <MdRefresh size={16} style={{ animation: resending ? 'spin 0.8s linear infinite' : 'none' }} />
                {resending ? 'Mengirim…' : 'Kirim Ulang Kode'}
              </button>
            )}
          </div>

          {/* Hint */}
          <p style={{
            textAlign: 'center', fontSize: 12, color: 'var(--text-muted)',
            marginTop: 28, lineHeight: 1.5,
          }}>
            Kode berlaku selama <strong>10 menit</strong>.
            Jangan bagikan kode kepada siapapun.
          </p>
        </>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      width: 17, height: 17, flexShrink: 0,
      border: '2.5px solid rgba(255,255,255,0.35)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      display: 'inline-block',
      animation: 'spin 0.65s linear infinite',
    }} />
  )
}
