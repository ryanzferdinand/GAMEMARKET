import React, { useState } from 'react'
import { MdTune, MdClose, MdExpandMore } from 'react-icons/md'
import { SORT_OPTIONS } from '../../lib/constants'

export default function FilterBar({ filters, onChange, showPriceFilter = true }) {
  const [open, setOpen] = useState(false)

  const set = (key, val) => onChange({ ...filters, [key]: val })
  const reset = () => onChange({ sort: 'newest', minPrice: '', maxPrice: '', rank: '' })

  const hasActive = !!(filters.minPrice || filters.maxPrice || filters.rank
    || (filters.sort && filters.sort !== 'newest'))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {/* Sort selector — Apple configurator-option-chip style */}
      <div style={{ position: 'relative' }}>
        <select
          value={filters.sort || 'newest'}
          onChange={(e) => set('sort', e.target.value)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            paddingLeft: 14, paddingRight: 32, paddingTop: 8, paddingBottom: 8,
            fontSize: 14, letterSpacing: '-0.224px',
            borderRadius: 9999,
            border: '1px solid #e0e0e0',
            backgroundColor: '#ffffff',
            color: '#1d1d1f',
            cursor: 'pointer',
            outline: 'none',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={e => e.target.style.borderColor = '#0071e3'}
          onBlur={e => e.target.style.borderColor = '#e0e0e0'}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <MdExpandMore
          size={14}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            color: '#7a7a7a', pointerEvents: 'none',
          }}
        />
      </div>

      {/* Filter toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '8px 14px',
          borderRadius: 9999,
          fontSize: 14, letterSpacing: '-0.224px',
          border: open ? 'none' : '1px solid #e0e0e0',
          backgroundColor: open ? '#1d1d1f' : '#ffffff',
          color: open ? '#ffffff' : '#1d1d1f',
          cursor: 'pointer',
          transition: 'background-color 0.15s ease, color 0.15s ease, border 0.15s ease',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.backgroundColor = '#f5f5f7' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.backgroundColor = '#ffffff' }}
      >
        <MdTune size={14} />
        <span>Filter</span>
        {hasActive && (
          <span
            style={{
              width: 6, height: 6, borderRadius: 9999,
              backgroundColor: open ? '#ffffff' : '#0066cc',
            }}
          />
        )}
      </button>

      {/* Reset */}
      {hasActive && (
        <button
          onClick={reset}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '8px 10px',
            borderRadius: 9999,
            fontSize: 13, color: '#7a7a7a',
            background: 'none', border: 'none', cursor: 'pointer',
            transition: 'color 0.15s ease',
            letterSpacing: '-0.12px',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#1d1d1f'}
          onMouseLeave={e => e.currentTarget.style.color = '#7a7a7a'}
        >
          <MdClose size={13} />
          Reset
        </button>
      )}

      {/* Expanded filter panel */}
      {open && (
        <div
          className="animate-fade-down"
          style={{
            width: '100%',
            marginTop: 4,
            padding: '20px 20px',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: 18,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 14,
            }}
          >
            {showPriceFilter && (
              <>
                <div>
                  <label className="input-label">Harga Minimum (Rp)</label>
                  <input
                    type="number"
                    value={filters.minPrice || ''}
                    onChange={(e) => set('minPrice', e.target.value)}
                    placeholder="0"
                    className="input-rect"
                  />
                </div>
                <div>
                  <label className="input-label">Harga Maksimum (Rp)</label>
                  <input
                    type="number"
                    value={filters.maxPrice || ''}
                    onChange={(e) => set('maxPrice', e.target.value)}
                    placeholder="10.000.000"
                    className="input-rect"
                  />
                </div>
              </>
            )}
            <div>
              <label className="input-label">Tipe Penjual</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={filters.rank || ''}
                  onChange={(e) => set('rank', e.target.value)}
                  className="input-rect"
                  style={{ appearance: 'none', WebkitAppearance: 'none', paddingRight: 32, cursor: 'pointer', width: '100%' }}
                >
                  <option value="">Semua Penjual</option>
                  <option value="trusted_seller">Trusted Seller</option>
                  <option value="seller">Seller</option>
                </select>
                <MdExpandMore
                  size={14}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#7a7a7a', pointerEvents: 'none' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
