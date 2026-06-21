import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MdArrowForward, MdChevronLeft, MdChevronRight } from 'react-icons/md'
import api from '../../lib/api'

const FALLBACK = [
  {
    _id: 'f1',
    title: 'Jual Beli Akun Game Terpercaya',
    subtitle: 'Ribuan akun premium tersedia dengan transaksi aman dan cepat.',
    cta: 'Jelajahi Sekarang',
    ctaLink: '/',
    dark: true,
  },
  {
    _id: 'f2',
    title: 'Mobile Legends & Valorant',
    subtitle: 'Temukan akun dengan rank tinggi di harga terbaik.',
    cta: 'Lihat Penawaran',
    ctaLink: '/category/mobile-legends',
    dark: true,
  },
  {
    _id: 'f3',
    title: 'Jadi Trusted Seller',
    subtitle: 'Tingkatkan kredibilitas dan jangkau lebih banyak pembeli.',
    cta: 'Pelajari Lebih',
    ctaLink: '/forum',
    dark: false,
  },
]

export default function PromoBanner() {
  const [banners, setBanners] = useState([])
  const [idx, setIdx]         = useState(0)
  const [loading, setLoading] = useState(true)
  const [paused, setPaused]   = useState(false)

  useEffect(() => {
    api.get('/banners/active')
      .then(({ data }) => setBanners(data.length ? data : FALLBACK))
      .catch(() => setBanners(FALLBACK))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (paused || banners.length <= 1) return
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 5000)
    return () => clearInterval(t)
  }, [banners.length, paused])

  const prev = useCallback(() => setIdx((i) => (i - 1 + banners.length) % banners.length), [banners.length])
  const next = useCallback(() => setIdx((i) => (i + 1) % banners.length), [banners.length])

  if (loading) {
    return (
      <div
        className="skeleton"
        style={{ width: '100%', height: 220, borderRadius: 18 }}
      />
    )
  }

  const b = banners[idx]
  const isDark = b.dark !== false

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 18,
        userSelect: 'none',
        /* Apple: product shadow only on imagery */
        boxShadow: '0 3px 30px 5px rgba(0,0,0,0.14)',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      <div style={{ position: 'relative', height: 220 }}>
        {banners.map((banner, i) => (
          <div
            key={banner._id}
            style={{
              position: 'absolute', inset: 0,
              opacity: i === idx ? 1 : 0,
              zIndex: i === idx ? 10 : 0,
              pointerEvents: i === idx ? 'auto' : 'none',
              transition: 'opacity 0.5s ease-out',
            }}
          >
            {/* BG */}
            {banner.imageUrl ? (
              <img
                src={banner.imageUrl}
                alt={banner.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100%', height: '100%',
                  background: isDark
                    ? 'linear-gradient(135deg, #272729 0%, #1a1a1c 100%)'
                    : 'linear-gradient(135deg, #f5f5f7 0%, #e8e8ed 100%)',
                }}
              />
            )}

            {/* Overlay */}
            <div
              style={{
                position: 'absolute', inset: 0,
                background: isDark
                  ? 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 70%, transparent 100%)'
                  : 'linear-gradient(to right, rgba(0,0,0,0.08) 0%, transparent 70%)',
              }}
            />

            {/* Content */}
            <div
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center',
                padding: '0 40px',
              }}
            >
              <div
                className="animate-fade-up"
                style={{ maxWidth: 440, animationDelay: '50ms' }}
              >
                <h2
                  style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                    fontSize: 28, fontWeight: 600,
                    letterSpacing: '-0.374px', lineHeight: 1.14,
                    color: isDark ? '#ffffff' : '#1d1d1f',
                    marginBottom: 8,
                  }}
                >
                  {banner.title}
                </h2>
                {banner.subtitle && (
                  <p
                    style={{
                      fontSize: 15, fontWeight: 400,
                      letterSpacing: '-0.224px', lineHeight: 1.47,
                      color: isDark ? 'rgba(255,255,255,0.75)' : '#515154',
                      marginBottom: 20, maxWidth: 360,
                    }}
                  >
                    {banner.subtitle}
                  </p>
                )}
                {banner.cta && (
                  <Link
                    to={banner.ctaLink || '/'}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '11px 22px',
                      borderRadius: 9999,
                      backgroundColor: isDark ? '#0066cc' : '#1d1d1f',
                      color: '#ffffff',
                      fontSize: 15, fontWeight: 400,
                      letterSpacing: '-0.224px',
                      textDecoration: 'none',
                      transition: 'background-color 0.15s ease, transform 0.1s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = isDark ? '#0071e3' : '#333333'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = isDark ? '#0066cc' : '#1d1d1f'
                    }}
                  >
                    {banner.cta}
                    <MdArrowForward size={14} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Arrow controls — Apple btn-icon-circular */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous"
            style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              zIndex: 20,
              width: 36, height: 36, borderRadius: 9999,
              backgroundColor: 'rgba(210,210,215,0.64)',
              backdropFilter: 'blur(8px)',
              color: '#1d1d1f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(210,210,215,0.9)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(210,210,215,0.64)'}
          >
            <MdChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            aria-label="Next"
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              zIndex: 20,
              width: 36, height: 36, borderRadius: 9999,
              backgroundColor: 'rgba(210,210,215,0.64)',
              backdropFilter: 'blur(8px)',
              color: '#1d1d1f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(210,210,215,0.9)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(210,210,215,0.64)'}
          >
            <MdChevronRight size={20} />
          </button>
        </>
      )}

      {/* Dots */}
      {banners.length > 1 && (
        <div
          style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              style={{
                borderRadius: 9999,
                width: i === idx ? 18 : 6,
                height: 6,
                backgroundColor: i === idx ? '#ffffff' : 'rgba(255,255,255,0.4)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'width 0.3s ease, background-color 0.3s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
