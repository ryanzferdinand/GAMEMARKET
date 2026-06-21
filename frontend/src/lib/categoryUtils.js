/** Known abbreviations keyed by category id (fallback when DB still has emoji icons). */
export const CATEGORY_ABBR = {
  'mobile-legends':    'ML',
  'valorant':          'VAL',
  'genshin-impact':    'GI',
  'pubg-mobile':       'PUBG',
  'free-fire':         'FF',
  'league-of-legends': 'LOL',
  'dota-2':            'DOTA',
  'honkai-star-rail':  'HSR',
  'minecraft':         'MC',
  'roblox':            'RBX',
  'steam':             'STM',
  'other':             'GAM',
}

/** Returns true if the stored icon value is an abbreviation, not an emoji. */
export function isAbbrIcon(icon) {
  return icon && /^[A-Za-z0-9]{2,5}$/.test(icon.trim())
}

/** Resolve the display abbreviation for a category or post field set. */
export function getCategoryAbbr({ id, icon, name } = {}) {
  if (isAbbrIcon(icon)) return icon.trim().toUpperCase()
  if (id && CATEGORY_ABBR[id]) return CATEGORY_ABBR[id]
  if (name) return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'GM'
  return 'GM'
}
