import React, { useEffect } from 'react'
import { MdFavorite, MdFavoriteBorder } from 'react-icons/md'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import useWishlistStore from '../../store/wishlistStore'

export default function WishlistButton({ postId, className = '' }) {
  const { user } = useAuthStore()
  const { isSaved, toggle, fetchIds, loaded } = useWishlistStore()
  const saved = isSaved(postId)

  useEffect(() => {
    if (user && !loaded) fetchIds()
  }, [user, loaded, fetchIds])

  if (!user) return null

  const handleClick = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const nowSaved = await toggle(postId)
      toast.success(nowSaved ? 'Disimpan ke wishlist' : 'Dihapus dari wishlist')
    } catch {
      toast.error('Gagal memperbarui wishlist')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`p-1.5 rounded-lg transition-all duration-150
        ${saved
          ? 'text-red-500 bg-red-50 dark:bg-red-950/30'
          : 'text-neutral-400 hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
        } ${className}`}
      aria-label={saved ? 'Hapus dari wishlist' : 'Simpan ke wishlist'}
    >
      {saved ? <MdFavorite size={18} /> : <MdFavoriteBorder size={18} />}
    </button>
  )
}
