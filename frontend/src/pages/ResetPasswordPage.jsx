import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MdLockOutline, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token) return toast.error('Token reset tidak valid')
    if (password.length < 8) return toast.error('Password minimal 8 karakter')
    if (password !== confirm) return toast.error('Konfirmasi password tidak cocok')

    setLoading(true)
    try {
      const { data } = await api.post('/auth/reset-password', { token, password })
      toast.success(data.message)
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal reset password')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Link reset tidak valid atau sudah kadaluarsa.</p>
        <Link to="/forgot-password" style={{ color: 'var(--accent)' }}>Minta link baru</Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24 }}>
        Password Baru
      </h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="input-label">Password Baru</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7a7a7a' }}>
              <MdLockOutline size={16} />
            </span>
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-rect"
              style={{ paddingLeft: 38, paddingRight: 40 }}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7a7a7a' }}
            >
              {showPwd ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="input-label">Konfirmasi Password</label>
          <input
            type={showPwd ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input-rect"
            autoComplete="new-password"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
          {loading ? 'Menyimpan…' : 'Simpan Password'}
        </button>
      </form>
    </div>
  )
}
