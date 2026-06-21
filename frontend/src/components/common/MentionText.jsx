import React from 'react'
import { Link } from 'react-router-dom'

const MENTION_SPLIT = /(@[a-zA-Z0-9_]{3,20}\b)/g

export default function MentionText({ text, className = '' }) {
  if (!text) return null

  const parts = text.split(MENTION_SPLIT)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const match = part.match(/^@([a-zA-Z0-9_]{3,20})$/)
        if (match) {
          const username = match[1]
          return (
            <Link
              key={i}
              to={`/profile/${username}`}
              className="text-accent-600 dark:text-accent-400 font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              @{username}
            </Link>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}
