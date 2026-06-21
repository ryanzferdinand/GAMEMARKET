import React from 'react'
import { MdSchedule, MdDone, MdDoneAll } from 'react-icons/md'

/**
 * Message delivery status for outgoing messages.
 * pending → clock | sent → single check | read → double check
 */
export default function MessageStatus({ msg, isMe, className = '' }) {
  if (!isMe) return null

  if (msg.pending) {
    return (
      <MdSchedule
        size={11}
        className={`shrink-0 opacity-70 ${className}`}
        title="Mengirim…"
        aria-label="Mengirim"
      />
    )
  }

  if (msg.read) {
    return (
      <MdDoneAll
        size={13}
        className={`shrink-0 text-sky-300 ${className}`}
        title="Dibaca"
        aria-label="Dibaca"
      />
    )
  }

  return (
    <MdDone
      size={11}
      className={`shrink-0 opacity-70 ${className}`}
      title="Terkirim"
      aria-label="Terkirim"
    />
  )
}
