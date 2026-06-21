import React from 'react'
import { getCategoryAbbr } from '../../lib/categoryUtils'

const SIZES = {
  xs: 'w-[18px] h-[18px] text-[7px] rounded',
  sm: 'w-[22px] h-[22px] text-[8px] rounded-md',
  md: 'w-8 h-8 text-[10px] rounded-lg',
  lg: 'w-12 h-12 text-xs rounded-2xl',
  xl: 'w-14 h-14 text-sm rounded-2xl',
}

/**
 * Gradient badge showing a category abbreviation.
 * Accepts a full category object or individual post fields.
 */
export default function CategoryBadge({
  cat,
  id,
  icon,
  name,
  color = 'from-slate-400 to-slate-600',
  size = 'sm',
  className = '',
}) {
  const catId = cat?.id ?? id
  const catColor = cat?.color ?? color
  const abbr = getCategoryAbbr({
    id: catId,
    icon: cat?.icon ?? icon,
    name: cat?.name ?? name,
  })

  return (
    <span
      className={`inline-flex items-center justify-center font-bold text-white shrink-0 bg-gradient-to-br ${catColor} ${SIZES[size] ?? SIZES.sm} ${className}`}
      title={cat?.name ?? name}
      aria-hidden={size === 'xs' || size === 'sm' ? undefined : true}
    >
      {abbr}
    </span>
  )
}
