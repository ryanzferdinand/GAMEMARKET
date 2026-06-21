import React, { useEffect, useState, useCallback } from 'react'
import { MdChatBubbleOutline, MdSearch } from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import api from '../lib/api'
import useUIStore from '../store/uiStore'
import useAuthStore from '../store/authStore'
import { getAvatar } from '../lib/avatar'
import { getSocket } from '../lib/socket'
import toast from 'react-hot-toast'

export default function InboxPage() {
  const { user } = useAuthStore()
  const { openChat } = useUIStore()
  const [convs, setConvs] = useState([])
  const [loading, setL] = useState(true)
  const [search, setSearch] = useState('')
  const socket = getSocket()

  const load = useCallback(async () => {
    setL(true)
    try {
      const { data } = await api.get('/chat/conversations')
      setConvs(data)
    } catch { toast.error('Gagal memuat percakapan') }
    finally { setL(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Real-time inbox sync — merge updates instead of full reload
  useEffect(() => {
    const mergeUpdate = (update) => {
      if (!update?.partner?._id) return
      const partnerId = update.partner._id.toString()

      setConvs((prev) => {
        const existing = prev.find((c) => c.partner._id.toString() === partnerId)
        const filtered = prev.filter((c) => c.partner._id.toString() !== partnerId)
        return [{ ...update, partner: update.partner }, ...filtered].sort((a, b) => {
          const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : 0
          const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : 0
          return tb - ta
        })
      })
    }

    const onConvUpdate = (update) => mergeUpdate(update)

    const onMsg = (msg) => {
      const senderId = msg.sender?._id || msg.sender
      const receiverId = msg.receiver?._id || msg.receiver
      const partnerId = senderId?.toString() === user._id ? receiverId : senderId

      setConvs((prev) => {
        const idx = prev.findIndex((c) => c.partner._id.toString() === partnerId?.toString())
        if (idx === -1) {
          load()
          return prev
        }
        const updated = [...prev]
        const conv = { ...updated[idx], lastMessage: msg }
        if (senderId?.toString() !== user._id) {
          conv.unreadCount = (conv.unreadCount || 0) + 1
        }
        updated.splice(idx, 1)
        return [conv, ...updated]
      })
    }

    const onReadReceipt = () => load()

    socket.on('chat:conversation-update', onConvUpdate)
    socket.on('chat:message', onMsg)
    socket.on('chat:read-receipt', onReadReceipt)
    return () => {
      socket.off('chat:conversation-update', onConvUpdate)
      socket.off('chat:message', onMsg)
      socket.off('chat:read-receipt', onReadReceipt)
    }
  }, [user?._id, load, socket])

  const filtered = convs.filter((c) =>
    c.partner?.username?.toLowerCase().includes(search.toLowerCase())
  )

  const openConversation = (partner) => {
    openChat(partner)
    setConvs((prev) =>
      prev.map((c) =>
        c.partner._id.toString() === partner._id.toString()
          ? { ...c, unreadCount: 0 }
          : c
      )
    )
    socket.emit('chat:read', { partnerId: partner._id })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-up">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Pesan</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Semua percakapan Anda</p>
      </div>

      <div className="relative">
        <MdSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari percakapan…"
          className="input pl-9 w-full"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 flex gap-3 animate-pulse">
              <div className="w-11 h-11 rounded-full skeleton shrink-0" />
              <div className="flex-1 space-y-2 py-0.5">
                <div className="skeleton h-3.5 w-32 rounded" />
                <div className="skeleton h-3 w-48 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
            <MdChatBubbleOutline size={24} className="text-neutral-400" />
          </div>
          <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
            {search ? 'Tidak ada hasil' : 'Belum ada percakapan'}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {search ? 'Coba kata kunci berbeda' : 'Hubungi penjual dari halaman postingan'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((conv) => {
            const partner = conv.partner
            const last = conv.lastMessage
            const unread = conv.unreadCount || 0
            const isMe = last?.sender?._id === user._id || last?.sender === user._id

            return (
              <button
                key={partner._id}
                onClick={() => openConversation(partner)}
                className="w-full card p-3.5 flex items-center gap-3 hover:shadow-card-hover transition-all duration-150 text-left"
              >
                <div className="relative shrink-0">
                  <img
                    src={getAvatar(partner.avatar, partner.username)}
                    alt={partner.username}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                  {partner.isOnline && (
                    <span className="status-online absolute -bottom-px -right-px" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${unread > 0 ? 'font-bold text-neutral-900 dark:text-white' : 'font-medium text-neutral-800 dark:text-neutral-200'}`}>
                      {partner.username}
                    </p>
                    {last?.createdAt && (
                      <span className="text-2xs text-neutral-400 shrink-0">
                        {formatDistanceToNow(new Date(last.createdAt), { addSuffix: false, locale: localeId })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`text-xs truncate ${unread > 0 ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400'}`}>
                      {isMe ? 'Anda: ' : ''}{last?.content || 'Belum ada pesan'}
                    </p>
                    {unread > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-500 text-white text-2xs font-bold flex items-center justify-center">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
