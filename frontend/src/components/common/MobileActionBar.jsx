/**
 * MobileActionBar.jsx
 *
 * TRUE floating bottom bar rendered via React Portal directly into document.body.
 * This guarantees the element is completely outside any layout container,
 * stacking context, or overflow:hidden parent — it is always fixed to the viewport.
 *
 * Mobile only — hidden on screens >= 1024px via a CSS media query injected once.
 *
 * Scroll behavior (GPU-only, 60fps):
 *  - Scroll DOWN  → slide down + fade out (hide)
 *  - Scroll UP    → slide up  + fade in  (show)
 *  - Scroll stops for ~180ms → fade in  (show)
 *  - Only transform + opacity are mutated — no layout reflow
 */

import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// Inject desktop-hide styles once at module level (no React overhead)
if (typeof document !== 'undefined') {
  const id = '__mab_style__'
  if (!document.getElementById(id)) {
    const s = document.createElement('style')
    s.id = id
    s.textContent = `
      #mobile-action-bar {
        /* hidden on desktop */
        display: flex !important;
      }
      @media (min-width: 1024px) {
        #mobile-action-bar {
          display: none !important;
        }
      }
    `
    document.head.appendChild(s)
  }
}

export default function MobileActionBar({ children, visible = true }) {
  const barRef    = useRef(null)
  const lastY     = useRef(typeof window !== 'undefined' ? window.scrollY : 0)
  const idleTimer = useRef(null)
  const shownRef  = useRef(true)

  // Direct DOM mutation — never causes React re-render, stays on compositor thread
  const show = useCallback(() => {
    if (shownRef.current) return
    shownRef.current = true
    const el = barRef.current
    if (!el) return
    el.style.transform   = 'translateY(0px)'
    el.style.opacity     = '1'
    el.style.pointerEvents = 'auto'
  }, [])

  const hide = useCallback(() => {
    if (!shownRef.current) return
    shownRef.current = false
    const el = barRef.current
    if (!el) return
    // Slide fully below viewport (bar height ~90px + safe area)
    el.style.transform   = 'translateY(120px)'
    el.style.opacity     = '0'
    el.style.pointerEvents = 'none'
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY

      if (idleTimer.current) clearTimeout(idleTimer.current)

      const delta = y - lastY.current
      if (delta > 6) {
        hide()
      } else if (delta < -6) {
        show()
      }
      lastY.current = y

      // Reappear after 180ms idle
      idleTimer.current = setTimeout(show, 180)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [show, hide])

  // Reset visibility when visible prop changes
  useEffect(() => {
    shownRef.current = true
    const el = barRef.current
    if (!el) return
    el.style.transform   = 'translateY(0px)'
    el.style.opacity     = visible ? '1' : '0'
    el.style.pointerEvents = visible ? 'auto' : 'none'
  }, [visible])

  if (!visible || typeof document === 'undefined') return null

  return createPortal(
    <div
      id="mobile-action-bar"
      ref={barRef}
      style={{
        // ── TRUE fixed position — attached to viewport, not to any parent ──
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,

        // Spacing so the pill floats above the screen edge
        padding: '0 16px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 10,

        // GPU-accelerated animation properties
        transform: 'translateY(0px)',
        opacity: 1,
        transition:
          'transform 300ms cubic-bezier(0.34, 1.20, 0.64, 1), ' +
          'opacity   260ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        willChange: 'transform, opacity',

        // Transparent background — visual is on the inner pill
        background: 'transparent',
        pointerEvents: 'auto',
      }}
    >
      {/* ── Glassmorphism pill ── */}
      <div
        style={{
          width: '100%',
          height: 58,
          borderRadius: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 10px',

          // Dark glass
          backgroundColor: 'rgba(18, 18, 20, 0.84)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',

          // Subtle border + layered shadow for depth
          border: '1px solid rgba(255, 255, 255, 0.11)',
          boxShadow: [
            '0 12px 40px rgba(0, 0, 0, 0.38)',
            '0 4px 12px rgba(0, 0, 0, 0.24)',
            '0 1px 0px rgba(255, 255, 255, 0.06) inset',
          ].join(', '),
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

// ── Button presets ─────────────────────────────────────────────────────────────

/** Outlined ghost button — Chat Seller (left) */
export function ActionBarOutline({ onClick, icon, label, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flexShrink: 0,
        height: 40,
        paddingInline: 16,
        borderRadius: 9999,
        border: '1.5px solid rgba(255, 255, 255, 0.20)',
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        color: '#f5f5f7',
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: '-0.2px',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.38 : 1,
        transition: 'background-color 0.14s ease',
        whiteSpace: 'nowrap',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
      onTouchStart={e => { if (!disabled) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.14)' }}
      onTouchEnd={e   => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)' }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)' }}
    >
      {icon}
      {label}
    </button>
  )
}

/** Filled gradient button — Buy Now (right, flex:1) */
export function ActionBarPrimary({ onClick, icon, label, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        minWidth: 0,
        height: 40,
        paddingInline: 18,
        borderRadius: 9999,
        border: 'none',
        background: disabled
          ? 'rgba(0, 102, 204, 0.40)'
          : 'linear-gradient(135deg, #0071e3 0%, #005cc5 100%)',
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: '-0.224px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        boxShadow: disabled ? 'none' : '0 2px 10px rgba(0, 102, 204, 0.44)',
        transition: 'opacity 0.14s ease, box-shadow 0.14s ease',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
      onTouchStart={e => { if (!disabled) e.currentTarget.style.opacity = '0.78' }}
      onTouchEnd={e   => { if (!disabled) e.currentTarget.style.opacity = '1' }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '0.88' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = '1' }}
    >
      {icon}
      {label}
    </button>
  )
}
