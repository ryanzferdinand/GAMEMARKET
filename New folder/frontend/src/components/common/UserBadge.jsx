import React from 'react'
import { ROLE_CONFIG } from '../../lib/constants'

// Role → visual config
const BADGE_STYLE = {
  admin:          { cls: 'badge-admin',          label: 'Admin' },
  moderator:      { cls: 'badge-moderator',      label: 'Mod' },
  trusted_seller: { cls: 'badge-trusted-seller', label: 'Trusted Seller' },
  trusted_buyer:  { cls: 'badge-trusted-buyer',  label: 'Trusted Buyer' },
  seller:         { cls: 'badge-seller',         label: 'Seller' },
  buyer:          { cls: 'badge-buyer',          label: 'Buyer' },
}

export default function UserBadge({ role, mini = false }) {
  const config = BADGE_STYLE[role]
  if (!config) return null

  // mini = just the abbreviated label chip
  if (mini) {
    const shortLabel = {
      admin: 'Admin', moderator: 'Mod',
      trusted_seller: 'T.Seller', trusted_buyer: 'T.Buyer',
      seller: 'Seller', buyer: 'Buyer',
    }[role] ?? config.label

    return (
      <span className={`${config.cls} text-[10px] py-px px-1.5`}>
        {shortLabel}
      </span>
    )
  }

  return (
    <span className={config.cls}>
      {config.label}
    </span>
  )
}
