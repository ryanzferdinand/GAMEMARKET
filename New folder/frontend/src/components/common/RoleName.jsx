import React from 'react'
import { Link } from 'react-router-dom'

/**
 * Renders a username with color based on role.
 *
 * Role color system (inspired by Discord role colors):
 *   admin          — amber/gold
 *   moderator      — emerald green
 *   trusted_seller — accent blue
 *   trusted_buyer  — violet/purple
 *   seller         — cyan/teal
 *   buyer          — neutral (default)
 */
const ROLE_COLOR = {
  admin:          'text-amber-500 dark:text-amber-400',
  moderator:      'text-emerald-500 dark:text-emerald-400',
  trusted_seller: 'text-accent-600 dark:text-accent-400',
  trusted_buyer:  'text-violet-600 dark:text-violet-400',
  seller:         'text-cyan-600 dark:text-cyan-400',
  buyer:          'text-neutral-700 dark:text-neutral-300',
}

export default function RoleName({
  username,
  role,
  linkTo,          // if provided, wraps in <Link>
  className = '',
  size = 'sm',     // 'xs' | 'sm' | 'base'
}) {
  const color = ROLE_COLOR[role] || ROLE_COLOR.buyer
  const sizeClass = { xs: 'text-xs', sm: 'text-sm', base: 'text-base' }[size] ?? 'text-sm'

  const inner = (
    <span className={`font-semibold ${color} ${sizeClass} ${className} hover:opacity-80 transition-opacity`}>
      {username}
    </span>
  )

  if (linkTo) {
    return <Link to={linkTo}>{inner}</Link>
  }
  return inner
}
