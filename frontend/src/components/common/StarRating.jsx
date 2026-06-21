import React from 'react'
import { MdStar, MdStarBorder, MdStarHalf } from 'react-icons/md'

export default function StarRating({ value = 0, onChange, size = 18, readonly = false }) {
  const stars = [1, 2, 3, 4, 5]

  return (
    <div className="flex items-center gap-0.5">
      {stars.map((star) => {
        const filled = value >= star
        const half = !filled && value >= star - 0.5
        const Icon = filled ? MdStar : half ? MdStarHalf : MdStarBorder

        if (readonly) {
          return (
            <Icon
              key={star}
              size={size}
              className={filled || half ? 'text-amber-400' : 'text-neutral-300 dark:text-neutral-600'}
            />
          )
        }

        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            className="transition-transform hover:scale-110 active:scale-95"
            aria-label={`${star} bintang`}
          >
            <Icon
              size={size}
              className={value >= star ? 'text-amber-400' : 'text-neutral-300 dark:text-neutral-600 hover:text-amber-300'}
            />
          </button>
        )
      })}
    </div>
  )
}

export function RatingBreakdown({ breakdown = {}, total = 0 }) {
  if (!total) return null

  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = breakdown[star] || 0
        const pct = total ? Math.round((count / total) * 100) : 0
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-neutral-500 tabular-nums">{star}</span>
            <MdStar size={12} className="text-amber-400 shrink-0" />
            <div className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 text-neutral-400 tabular-nums text-right">{count}</span>
          </div>
        )
      })}
    </div>
  )
}
