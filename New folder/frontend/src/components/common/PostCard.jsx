import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MdThumbUp, MdThumbDown, MdChatBubbleOutline,
  MdVisibility, MdVerified,
} from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import UserBadge from './UserBadge'
import RoleName from './RoleName'
import OnlineDot from './OnlineDot'
import CategoryBadge from './CategoryBadge'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import { getAvatar, getImageUrl } from '../../lib/avatar'
import toast from 'react-hot-toast'
import WishlistButton from './WishlistButton'

const formatPrice = (n) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)

function PostImage({ src, alt }) {
  const [errored, setErrored] = useState(false)
  const url = src ? getImageUrl(src) : null

  if (!url || errored) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--bg-secondary)]">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-[var(--text-disabled)]">
          <rect x="2" y="7" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="12" cy="3" r="2" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className="w-full h-full object-cover"
    />
  )
}

export default function PostCard({ post, onUpdate }) {
  const { user }   = useAuthStore()
  const [voting, setVoting]   = useState(false)
  const [hovered, setHovered] = useState(false)

  const liked     = user && post.likes?.includes(user._id)
  const disliked  = user && post.dislikes?.includes(user._id)
  const isPending = post.status === 'pending'
  const isSold    = post.status === 'sold'

  const vote = async (type) => {
    if (!user) return toast.error('Login untuk memberi vote')
    if (voting) return
    setVoting(true)
    try {
      const { data } = await api.post(`/posts/${post._id}/vote`, { type })
      onUpdate?.({
        ...post,
        likes: data.post.likes,
        dislikes: data.post.dislikes,
        seller: data.post.seller?.username ? data.post.seller : post.seller,
      })
    } catch { toast.error('Gagal vote') }
    finally  { setVoting(false) }
  }

  return (
    <article
      className={`post-card card-interactive flex flex-col ${isPending ? 'opacity-60' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <Link to={`/post/${post._id}`} className="relative block shrink-0">
        <div className="aspect-[16/9] overflow-hidden bg-[var(--bg-secondary)]">
          <div
            className="w-full h-full transition-transform duration-500 ease-out"
            style={{ transform: hovered ? 'scale(1.03)' : 'scale(1)' }}
          >
            <PostImage src={post.images?.[0]} alt={post.title} />
          </div>
        </div>

        {/* Status chips */}
        <div className="post-card-chips absolute top-2.5 left-2.5 sm:top-[10px] sm:left-[10px] flex flex-wrap gap-1.5 sm:gap-1.5 max-w-[calc(100%-80px)]">
          {isPending && (
            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-[#ff9f0a] text-white">
              Pending
            </span>
          )}
          {isSold && (
            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-[rgba(255,59,48,0.9)] text-white">
              Terjual
            </span>
          )}
          {post.gameCategoryId && (
            <span className="post-card-category-chip flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full bg-black/50 backdrop-blur-sm text-white">
              <CategoryBadge
                id={post.gameCategoryId}
                icon={post.gameIcon}
                name={post.gameCategory}
                color={post.gameCategoryColor}
                size="xs"
              />
              <span className="post-card-category-name text-[10px] sm:text-[11px] font-semibold truncate max-w-[100px] sm:max-w-[140px]">
                {post.gameCategory}
              </span>
            </span>
          )}
        </div>

        {/* Price + wishlist */}
        <div className="absolute bottom-2.5 right-2.5 sm:bottom-[10px] sm:right-[10px] flex items-center gap-1.5 sm:gap-1.5">
          <WishlistButton postId={post._id} />
          <span className="px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-bold bg-black/60 backdrop-blur-sm text-white tracking-tight">
            {formatPrice(post.price)}
          </span>
        </div>
      </Link>

      {/* Body */}
      <div className="post-card-body flex flex-col flex-1 gap-2 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3.5">
        <Link to={`/post/${post._id}`} className="no-underline">
          <h3 className="post-card-title m-0 text-sm sm:text-[15px] font-semibold text-[var(--text-primary)] leading-snug tracking-tight line-clamp-2 transition-colors duration-150 hover:text-[var(--accent)]">
            {post.title}
          </h3>
        </Link>

        {/* Seller row */}
        <div className="flex items-center gap-1.5 sm:gap-1.5 min-w-0 flex-wrap">
          <Link
            to={`/profile/${post.seller?.username}`}
            className="flex items-center gap-1.5 min-w-0 no-underline"
          >
            <img
              src={getAvatar(post.seller?.avatar, post.seller?.username)}
              alt={post.seller?.username}
              className="w-[18px] h-[18px] rounded-full object-cover shrink-0"
            />
            <RoleName username={post.seller?.username} role={post.seller?.role} size="xs" />
          </Link>
          {post.seller?.role && <UserBadge role={post.seller.role} mini />}
          {post.seller?.verified && <MdVerified className="text-[var(--accent)] shrink-0" size={12} />}
          <OnlineDot userId={post.seller?._id} />
          <span className="text-[11px] text-[var(--text-muted)] ml-auto shrink-0">
            {post.createdAt && formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: localeId })}
          </span>
        </div>

        {/* Footer stats */}
        <div className="flex items-center gap-3 sm:gap-3 pt-2.5 mt-auto border-t border-[var(--border-soft)]">
          <button
            onClick={() => vote('like')}
            disabled={voting || isSold}
            className={`flex items-center gap-0.5 text-xs font-medium bg-transparent border-0 cursor-pointer p-0 transition-colors duration-150 disabled:cursor-not-allowed ${liked ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--accent)]'}`}
          >
            <MdThumbUp size={13} />{post.likes?.length || 0}
          </button>
          <button
            onClick={() => vote('dislike')}
            disabled={voting || isSold}
            className={`flex items-center gap-0.5 text-xs font-medium bg-transparent border-0 cursor-pointer p-0 transition-colors duration-150 disabled:cursor-not-allowed ${disliked ? 'text-[var(--color-red)]' : 'text-[var(--text-muted)] hover:text-[var(--color-red)]'}`}
          >
            <MdThumbDown size={13} />{post.dislikes?.length || 0}
          </button>
          <Link
            to={`/post/${post._id}`}
            className="flex items-center gap-0.5 text-xs text-[var(--text-muted)] no-underline transition-colors duration-150 hover:text-[var(--text-primary)]"
          >
            <MdChatBubbleOutline size={13} />{post.commentCount || 0}
          </Link>
          <div className="flex items-center gap-0.5 text-xs text-[var(--text-muted)] ml-auto">
            <MdVisibility size={13} />{post.views || 0}
          </div>
        </div>
      </div>
    </article>
  )
}
