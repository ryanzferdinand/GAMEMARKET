import React from 'react'
import useOnlineStore from '../../store/onlineStore'

/**
 * A small status indicator dot.
 * @param {string} userId
 * @param {number} size - dot diameter in px (default 7)
 * @param {string} className
 * @param {object} style - extra inline styles (e.g. position: absolute)
 */
export default function OnlineDot({ userId, size = 7, className = '', style = {} }) {
  const isOnline = useOnlineStore((s) => s.onlineIds.has(userId?.toString()))

  if (!userId) return null

  return (
    <span
      title={isOnline ? 'Online' : 'Offline'}
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: isOnline ? 'var(--color-green)' : 'var(--text-disabled)',
        boxShadow: `0 0 0 1.5px var(--bg-elevated)`,
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
