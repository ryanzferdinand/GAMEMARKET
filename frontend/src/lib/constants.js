export const ROLES = {
  ADMIN:          'admin',
  MODERATOR:      'moderator',
  SUPERVISOR:     'supervisor',
  TRUSTED_SELLER: 'trusted_seller',
  TRUSTED_BUYER:  'trusted_buyer',
  SELLER:         'seller',
  BUYER:          'buyer',
}

export const ROLE_CONFIG = {
  admin: {
    label: 'Admin',
    canPostWithoutApproval: true,
    canApprove: true,
    canManageBanners: true,
    canManageUsers: true,
  },
  moderator: {
    label: 'Moderator',
    canPostWithoutApproval: true,
    canApprove: true,
    canManageBanners: false,
    canManageUsers: false,
  },
  supervisor: {
    label: 'Supervisor',
    canPostWithoutApproval: true,
    canApprove: true,
    canManageBanners: false,
    canManageUsers: false,
  },
  trusted_seller: {
    label: 'Trusted Seller',
    canPostWithoutApproval: true,
    canApprove: false,
    canManageBanners: false,
    canManageUsers: false,
  },
  trusted_buyer: {
    label: 'Trusted Buyer',
    canPostWithoutApproval: false,
    canApprove: false,
    canManageBanners: false,
    canManageUsers: false,
  },
  seller: {
    label: 'Seller',
    canPostWithoutApproval: false,
    canApprove: false,
    canManageBanners: false,
    canManageUsers: false,
  },
  buyer: {
    label: 'Buyer',
    canPostWithoutApproval: false,
    canApprove: false,
    canManageBanners: false,
    canManageUsers: false,
  },
}

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

export const POST_STATUS = {
  PENDING:  'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SOLD:     'sold',
}

export const SORT_OPTIONS = [
  { value: 'newest',     label: 'Terbaru' },
  { value: 'oldest',     label: 'Terlama' },
  { value: 'price_asc',  label: 'Harga: Rendah ke Tinggi' },
  { value: 'price_desc', label: 'Harga: Tinggi ke Rendah' },
  { value: 'popular',    label: 'Terpopuler' },
]

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
