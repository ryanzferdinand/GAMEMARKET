import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdNotifications, MdDoneAll, MdThumbUp, MdCheckCircle, MdCancel, MdChatBubbleOutline, MdComment, MdStar, MdFlag, MdArticle, MdAlternateEmail } from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import api from '../../lib/api'
import { getSocket } from '../../lib/socket'
import useAuthStore from '../../store/authStore'
import { getAvatar } from '../../lib/avatar'

const TYPE_ICON = {
  post_approved:   { icon: MdCheckCircle,       color: 'text-emerald-500' },
  post_rejected:   { icon: MdCancel,            color: 'text-red-500'     },
  post_like:       { icon: MdThumbUp,           color: 'text-accent-500'  },
  post_dislike:    { icon: MdThumbUp,           color: 'text-neutral-400' },
  new_message:     { icon: MdChatBubbleOutline, color: 'text-accent-500'  },
  new_comment:     { icon: MdComment,           color: 'text-violet-500'  },
  comment_vote:    { icon: MdThumbUp,           color: 'text-accent-400'  },
  new_review:      { icon: MdStar,              color: 'text-amber-500'   },
  new_report:      { icon: MdFlag,              color: 'text-red-500'     },
  report_resolved: { icon: MdCheckCircle,       color: 'text-emerald-500' },
  post_updated:    { icon: MdArticle,           color: 'text-accent-500'  },
  forum_mention:   { icon: MdAlternateEmail,    color: 'text-violet-500'  },
}

export default function NotificationDropdown({ dark = false }) {
  const { user } = useAuthStore()
  const [open, setOpen]       = useState(false)
  const [notifs, setNotifs]   = useState([])
  const [loading, setLoading] = useState(false)
  const [unread, setUnread]   = useState(0)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Load initial unread count
  useEffect(() => {
    if (!user) return
    api.get('/notifications/unread-count')
      .then(({ data }) => setUnread(data.count))
      .catch(() => {})
  }, [user?._id])

  // Listen for real-time notifications
  useEffect(() => {
    if (!user) return
    const socket = getSocket()
    const onNotif = (notif) => {
      setNotifs((prev) => [notif, ...prev])
      setUnread((n) => n + 1)
    }
    socket.on('notification:new', onNotif)
    return () => socket.off('notification:new', onNotif)
  }, [user?._id])

  // Load full list when dropdown opens
  const load = async () => {
    if (notifs.length > 0) return // already loaded
    setLoading(true)
    try {
      const { data } = await api.get('/notifications')
      setNotifs(data)
    } catch { }
    finally { setLoading(false) }
  }

  const handleOpen = () => {
    setOpen((v) => !v)
    if (!open) load()
  }

  const markAllRead = async () => {
    await api.post('/notifications/read-all')
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`).catch(() => {})
    setNotifs((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n))
    setUnread((c) => Math.max(0, c - 1))
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        aria-label="Notifikasi"
        style={{
          width: 32, height: 32, borderRadius: 9999,
          backgroundColor: 'transparent',
          color: dark ? '#f5f5f7' : '#1d1d1f',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', position: 'relative',
          transition: 'background-color 0.15s ease',
          flexShrink: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <MdNotifications size={19} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 3, right: 3,
            minWidth: 14, height: 14, padding: '0 3px',
            borderRadius: 9999, backgroundColor: '#ff3b30', color: '#fff',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, boxShadow: `0 0 0 1.5px ${dark ? '#000' : '#fff'}`,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="dropdown right-0 top-full mt-2 w-80 animate-scale-in z-50 flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Notifikasi</h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700 font-medium"
              >
                <MdDoneAll size={14} />
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="space-y-1 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-2 animate-pulse">
                    <div className="w-8 h-8 rounded-full skeleton shrink-0" />
                    <div className="flex-1 space-y-1.5 py-0.5">
                      <div className="skeleton h-3 w-3/4 rounded" />
                      <div className="skeleton h-2.5 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifs.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center px-4">
                <MdNotifications size={28} className="text-neutral-300 mb-2" />
                <p className="text-sm text-neutral-400">Belum ada notifikasi</p>
              </div>
            ) : notifs.map((n) => {
              const cfg = TYPE_ICON[n.type] || { icon: MdNotifications, color: 'text-neutral-400' }
              const Icon = cfg.icon

              return (
                <Link
                  key={n._id}
                  to={n.link || '/'}
                  onClick={() => { markRead(n._id); setOpen(false) }}
                  className={`flex gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800
                              transition-colors border-b border-neutral-50 dark:border-neutral-800/50
                              ${!n.read ? 'bg-accent-50/50 dark:bg-accent-950/20' : ''}`}
                >
                  {/* Actor avatar or icon */}
                  <div className="relative shrink-0">
                    {n.actor ? (
                      <img
                        src={getAvatar(n.actor.avatar, n.actor.username)}
                        className="w-8 h-8 rounded-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        <Icon size={16} className={cfg.color} />
                      </div>
                    )}
                    {/* Type icon badge */}
                    {n.actor && (
                      <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full
                                       bg-white dark:bg-neutral-900 flex items-center justify-center`}>
                        <Icon size={10} className={cfg.color} />
                      </span>
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug ${!n.read ? 'font-semibold text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-2xs text-neutral-400 mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-2xs text-neutral-400 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: localeId })}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <div style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 9999, backgroundColor: '#0066cc', marginTop: 4 }} />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
