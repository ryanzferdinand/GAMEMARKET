import React from 'react'
import { Outlet, Link } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-layout-bg" aria-hidden="true" />

      <div className="auth-layout-inner animate-fade-up">
        {/* Logo */}
        <Link to="/" className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="5" width="3" height="4" rx="1" fill="white" opacity=".8"/>
              <rect x="5.5" y="2" width="3" height="10" rx="1" fill="white"/>
              <rect x="10" y="4" width="3" height="6" rx="1" fill="white" opacity=".6"/>
            </svg>
          </div>
          <span className="auth-logo-text">GameMarket</span>
        </Link>

        {/* Card */}
        <div className="auth-card">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
