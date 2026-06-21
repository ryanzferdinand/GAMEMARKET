export const GAME_CATEGORIES = [
  { id: 'mobile-legends',    name: 'Mobile Legends',     icon: 'ML',   color: 'from-blue-500 to-indigo-600' },
  { id: 'valorant',          name: 'Valorant',            icon: 'VAL',  color: 'from-red-500 to-rose-600' },
  { id: 'genshin-impact',    name: 'Genshin Impact',      icon: 'GI',   color: 'from-amber-400 to-yellow-500' },
  { id: 'pubg-mobile',       name: 'PUBG Mobile',         icon: 'PUBG', color: 'from-orange-500 to-amber-500' },
  { id: 'free-fire',         name: 'Free Fire',           icon: 'FF',   color: 'from-orange-600 to-red-600' },
  { id: 'league-of-legends', name: 'League of Legends',  icon: 'LOL',  color: 'from-yellow-400 to-orange-400' },
  { id: 'dota-2',            name: 'Dota 2',              icon: 'DOTA', color: 'from-red-700 to-rose-800' },
  { id: 'honkai-star-rail',  name: 'Honkai: Star Rail',   icon: 'HSR',  color: 'from-purple-500 to-indigo-600' },
  { id: 'minecraft',         name: 'Minecraft',           icon: 'MC',   color: 'from-green-500 to-emerald-600' },
  { id: 'roblox',            name: 'Roblox',              icon: 'RBX',  color: 'from-red-400 to-pink-500' },
  { id: 'steam',             name: 'Steam (Lainnya)',      icon: 'STM',  color: 'from-slate-500 to-blue-700' },
  { id: 'other',             name: 'Game Lainnya',        icon: 'GAM',  color: 'from-slate-400 to-slate-600' },
]

export const ROLE_CONFIG = {
  admin:          { canPostWithoutApproval: true,  canApprove: true  },
  moderator:      { canPostWithoutApproval: true,  canApprove: true  },
  supervisor:     { canPostWithoutApproval: true,  canApprove: true  },
  trusted_seller: { canPostWithoutApproval: true,  canApprove: false },
  trusted_buyer:  { canPostWithoutApproval: false, canApprove: false },
  seller:         { canPostWithoutApproval: false, canApprove: false },
  buyer:          { canPostWithoutApproval: false, canApprove: false },
}
