import { useEffect, useRef, useState } from 'react'
import { MdClose, MdSend, MdRemove, MdOpenInFull, MdCloseFullscreen, MdImage, MdMoreVert, MdEdit, MdDelete, MdCheck } from 'react-icons/md'
import { createPortal } from 'react-dom'
import useUIStore from '../../store/uiStore'
import useAuthStore from '../../store/authStore'
import { getSocket } from '../../lib/socket'
import api from '../../lib/api'
import { getAvatar, getImageUrl } from '../../lib/avatar'
import OnlineDot from '../common/OnlineDot'
import MessageStatus from './MessageStatus'
import useOnlineStore from '../../store/onlineStore'
import toast from 'react-hot-toast'

export default function ChatPanel() {
  const { chatRecipient, closeChat } = useUIStore()
  const { user }       = useAuthStore()
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [minimized, setMinimized]   = useState(false)
  const [maximized, setMaximized]   = useState(false)
  const [imgPreview, setImgPreview] = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [editingId, setEditingId]   = useState(null) // message._id being edited
  const [editText, setEditText]     = useState('')
  const [menuId, setMenuId]         = useState(null)  // message._id with open menu
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const editRef   = useRef(null)
  const fileRef   = useRef(null)

  const socket   = getSocket()
  const isOnline = useOnlineStore((s) => s.onlineIds.has(chatRecipient?._id?.toString()))

  useEffect(() => {
    if (chatRecipient && window.innerWidth < 640) setMaximized(true)
  }, [chatRecipient])

  useEffect(() => {
    if (!chatRecipient) return
    setLoading(true)
    setMessages([])
    api.get(`/chat/history/${chatRecipient._id}`)
      .then(({ data }) => { setMessages(data.messages || data); socket.emit('chat:read', { partnerId: chatRecipient._id }) })
      .catch(() => toast.error('Gagal memuat pesan'))
      .finally(() => setLoading(false))

    const onMsg = (msg) => {
      const sid = msg.sender?._id || msg.sender
      const rid = msg.receiver?._id || msg.receiver
      const mine =
        (sid?.toString() === chatRecipient._id?.toString() && rid?.toString() === user._id?.toString()) ||
        (sid?.toString() === user._id?.toString() && rid?.toString() === chatRecipient._id?.toString())
      if (!mine) return

      setMessages((prev) => {
        // Replace optimistic message by tmpId (prevents double)
        if (msg.tmpId) {
          const idx = prev.findIndex((m) => m._id === msg.tmpId)
          if (idx !== -1) return prev.map((m, i) => i === idx ? { ...msg, pending: false } : m)
        }
        if (prev.some((m) => m._id === msg._id)) return prev
        return [...prev, msg]
      })

      if (sid?.toString() === chatRecipient._id?.toString())
        socket.emit('chat:read', { partnerId: chatRecipient._id })
    }

    const onReceipt = ({ readerId }) => {
      if (readerId?.toString() !== chatRecipient._id?.toString()) return
      setMessages((prev) => prev.map((m) => {
        const s = m.sender?._id || m.sender
        return s?.toString() === user._id?.toString() && !m.pending ? { ...m, read: true } : m
      }))
    }

    const onEdited = (msg) => {
      setMessages((prev) => prev.map((m) => m._id === msg._id ? { ...m, content: msg.content, edited: true } : m))
    }

    const onDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId))
    }

    socket.on('chat:message', onMsg)
    socket.on('chat:read-receipt', onReceipt)
    socket.on('chat:edited', onEdited)
    socket.on('chat:deleted', onDeleted)
    return () => {
      socket.off('chat:message', onMsg)
      socket.off('chat:read-receipt', onReceipt)
      socket.off('chat:edited', onEdited)
      socket.off('chat:deleted', onDeleted)
    }
  }, [chatRecipient?._id, user?._id, socket])

  useEffect(() => {
    if (!minimized) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [messages, minimized])

  useEffect(() => {
    document.body.style.overflow = maximized ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [maximized])

  useEffect(() => {
    if (editingId) setTimeout(() => editRef.current?.focus(), 30)
  }, [editingId])

  // Close message menu on outside click
  useEffect(() => {
    const h = () => setMenuId(null)
    document.addEventListener('mousedown', h)
    document.addEventListener('touchstart', h)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h) }
  }, [])

  const pickImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Maksimal 5MB'); return }
    setImgPreview({ file, localUrl: URL.createObjectURL(file) })
    e.target.value = ''
  }

  const cancelImage = () => {
    if (imgPreview) URL.revokeObjectURL(imgPreview.localUrl)
    setImgPreview(null)
  }

  const send = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text && !imgPreview) return

    let imageUrl = null
    if (imgPreview) {
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('image', imgPreview.file)
        const { data } = await api.post('/chat/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        imageUrl = data.url
      } catch { toast.error('Gagal upload gambar'); setUploading(false); return }
      setUploading(false)
      cancelImage()
    }

    const tmpId = `tmp-${Date.now()}`
    // Add optimistic message with tmpId as _id
    setMessages((prev) => [...prev, {
      _id: tmpId, tmpId, sender: user, receiver: chatRecipient._id,
      content: text, imageUrl, createdAt: new Date().toISOString(), pending: true, read: false,
    }])
    socket.emit('chat:send', { receiverId: chatRecipient._id, content: text, imageUrl, tmpId })
    setInput('')
    inputRef.current?.focus()
  }

  const startEdit = (msg) => {
    setEditingId(msg._id)
    setEditText(msg.content)
    setMenuId(null)
  }

  const saveEdit = (e) => {
    e.preventDefault()
    if (!editText.trim()) return
    socket.emit('chat:edit', { messageId: editingId, content: editText.trim() })
    setMessages((prev) => prev.map((m) => m._id === editingId ? { ...m, content: editText.trim(), edited: true } : m))
    setEditingId(null)
  }

  const deleteMsg = (msgId) => {
    if (!confirm('Hapus pesan ini?')) return
    socket.emit('chat:delete', { messageId: msgId })
    setMessages((prev) => prev.filter((m) => m._id !== msgId))
    setMenuId(null)
  }

  if (!chatRecipient) return null


  const Header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, minHeight: 52, cursor: minimized && !maximized ? 'pointer' : 'default', backgroundColor: 'rgba(28, 28, 30, 0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      onClick={() => { if (!maximized) setMinimized(v => !v) }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img src={getAvatar(chatRecipient.avatar, chatRecipient.username)} alt={chatRecipient.username} style={{ width: 34, height: 34, borderRadius: 9999, objectFit: 'cover' }} />
        <OnlineDot userId={chatRecipient._id} size={7} style={{ position: 'absolute', bottom: 0, right: 0 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatRecipient.username}</p>
        <p style={{ fontSize: 11, color: isOnline ? 'var(--color-green)' : 'var(--text-muted)', margin: 0 }}>{isOnline ? 'Online' : 'Offline'}</p>
      </div>
      <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
        {!maximized && <HBtn onClick={() => setMinimized(v => !v)} label="Minimize"><MdRemove size={14} /></HBtn>}
        <HBtn onClick={() => { setMaximized(v => !v); setMinimized(false) }} label={maximized ? 'Restore' : 'Expand'}>
          {maximized ? <MdCloseFullscreen size={14} /> : <MdOpenInFull size={14} />}
        </HBtn>
        <HBtn onClick={closeChat} label="Close"><MdClose size={14} /></HBtn>
      </div>
    </div>
  )

  const Body = (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 6, WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <span style={{ width: 18, height: 18, border: '2px solid #0066cc', borderTopColor: 'transparent', borderRadius: 9999, display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : messages.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', margin: 0 }}>Mulai percakapan dengan {chatRecipient.username}</p>
        ) : messages.map((msg, idx) => {
          const sid    = msg.sender?._id || msg.sender
          const isMe   = sid?.toString() === user._id?.toString()
          const prevMsg = messages[idx - 1]
          const prevSid = prevMsg ? (prevMsg.sender?._id || prevMsg.sender) : null
          const showName = !isMe && sid?.toString() !== prevSid?.toString()

          return (
            <div key={msg._id}>
              {/* Sender name label (only for received messages when sender changes) */}
              {showName && (
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 2, marginLeft: 4, marginTop: idx > 0 ? 6 : 0 }}>
                  {msg.sender?.username || chatRecipient.username}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 4 }}>
                {/* Message menu (three-dot, only my messages) */}
                {isMe && !msg.pending && (
                  <div style={{ position: 'relative', alignSelf: 'flex-start', marginTop: 4 }} onClick={e => e.stopPropagation()}>
                    <button onMouseDown={e => { e.preventDefault(); setMenuId(menuId === msg._id ? null : msg._id) }}
                      style={{ width: 22, height: 22, borderRadius: 9999, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', opacity: menuId === msg._id ? 1 : 0, transition: 'opacity 0.15s ease' }}
                      className="msg-menu-btn">
                      <MdMoreVert size={14} />
                    </button>
                    {menuId === msg._id && (
                      <div style={{ position: 'absolute', right: 24, top: 0, backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-dropdown)', overflow: 'hidden', zIndex: 100, minWidth: 110 }}>
                        {msg.content && (
                          <button onMouseDown={() => startEdit(msg)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <MdEdit size={14} />Edit
                          </button>
                        )}
                        <button onMouseDown={() => deleteMsg(msg._id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-red)', textAlign: 'left' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,59,48,0.07)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <MdDelete size={14} />Hapus
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {/* Image */}
                  {msg.imageUrl && (
                    <a href={getImageUrl(msg.imageUrl)} target="_blank" rel="noreferrer"
                      style={{ display: 'block', marginBottom: msg.content ? 4 : 0, borderRadius: 12, overflow: 'hidden', maxWidth: 220, opacity: msg.pending ? 0.6 : 1 }}>
                      <img src={getImageUrl(msg.imageUrl)} alt="foto" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 260, objectFit: 'cover' }} />
                    </a>
                  )}

                  {/* Text — inline edit mode */}
                  {editingId === msg._id ? (
                    <form onSubmit={saveEdit} style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 180 }}>
                      <input ref={editRef} value={editText} onChange={e => setEditText(e.target.value)}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 9999, border: '1px solid var(--border-focus)', backgroundColor: 'var(--bg-secondary)', fontSize: 14, color: 'var(--text-primary)', outline: 'none' }} />
                      <button type="submit" style={{ width: 28, height: 28, borderRadius: 9999, backgroundColor: '#0066cc', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <MdCheck size={14} />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} style={{ width: 28, height: 28, borderRadius: 9999, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <MdClose size={14} />
                      </button>
                    </form>
                  ) : msg.content ? (
                    <div className="chat-message-content" style={{ padding: '8px 13px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: 15, lineHeight: 1.47, letterSpacing: '-0.374px', wordBreak: 'break-word', backgroundColor: isMe ? '#0066cc' : 'var(--bg-secondary)', color: isMe ? '#ffffff' : 'var(--text-primary)', opacity: msg.pending ? 0.6 : 1 }}>
                      {msg.content}
                      {msg.edited && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 6 }}>(diedit)</span>}
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    <MessageStatus msg={msg} isMe={isMe} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Image preview strip */}
      {imgPreview && (
        <div style={{ padding: '8px 12px 4px', borderTop: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-elevated)', flexShrink: 0 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={imgPreview.localUrl} alt="preview" style={{ height: 72, width: 'auto', borderRadius: 8, display: 'block', maxWidth: 120, border: '1px solid var(--border)' }} />
            <button onClick={cancelImage} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 9999, backgroundColor: '#ff3b30', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MdClose size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={send} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderTop: '1px solid var(--border-soft)', flexShrink: 0, backgroundColor: 'var(--bg-elevated)' }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickImage} />
        <button type="button" onClick={() => fileRef.current?.click()} title="Kirim foto"
          style={{ width: 36, height: 36, borderRadius: 9999, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: imgPreview ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0, transition: 'color 0.15s ease, background-color 0.15s ease' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
          <MdImage size={20} />
        </button>
        <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Tulis pesan…" autoComplete="off" enterKeyHint="send"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 9999, border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', fontSize: 16, letterSpacing: '-0.224px', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.15s ease', minWidth: 0 }}
          onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'} />
        <button type="submit" disabled={!input.trim() && !imgPreview}
          style={{ width: 40, height: 40, borderRadius: 9999, backgroundColor: uploading ? 'var(--bg-secondary)' : '#0066cc', color: uploading ? 'var(--text-muted)' : '#ffffff', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!input.trim() && !imgPreview) ? 0.4 : 1, transition: 'background-color 0.15s ease, opacity 0.15s ease' }}
          onMouseEnter={e => { if (input.trim() || imgPreview) e.currentTarget.style.backgroundColor = uploading ? 'var(--bg-secondary)' : '#0071e3' }}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = uploading ? 'var(--bg-secondary)' : '#0066cc'}>
          {uploading ? <span style={{ width: 16, height: 16, border: '2px solid var(--text-muted)', borderTopColor: 'var(--accent)', borderRadius: 9999, display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> : <MdSend size={17} />}
        </button>
      </form>

      {/* Hover reveal for message menu buttons */}
      <style>{`.msg-bubble-row:hover .msg-menu-btn { opacity: 1 !important; }`}</style>
    </>
  )

  if (maximized) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, backgroundColor: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {Header}{Body}
      </div>,
      document.body
    )
  }

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 50, width: 300, backgroundColor: 'rgba(18, 18, 20, 0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.10)', borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06) inset', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: minimized ? 52 : 420, transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
      {Header}
      {!minimized && Body}
    </div>
  )
}

function HBtn({ children, onClick, label }) {
  return (
    <button onClick={onClick} aria-label={label}
      style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'background-color 0.15s ease', flexShrink: 0 }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
      {children}
    </button>
  )
}
