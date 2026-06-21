import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { MdMailOutline } from 'react-icons/md'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return toast.error('Masukkan email')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() })
      setSent(true)
      toast.success(data.message)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengirim email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        Lupa Password
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 24 }}>
        {sent
          ? 'Cek inbox email kamu untuk link reset password.'
          : 'Masukkan email akun kamu. Kami akan kirim link reset password.'}
      </p>

      {!sent && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="input-label">Email</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7a7a7a' }}>
                <MdMailOutline size={16} />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="input-rect"
                style={{ paddingLeft: 38 }}
                autoComplete="email"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
            {loading ? 'Mengirim…' : 'Kirim Link Reset'}
          </button>
        </form>
      )}

      <p style={{ marginTop: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
        <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>← Kembali ke masuk</Link>
      </p>
    </div>
  )
}
