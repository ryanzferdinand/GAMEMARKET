import React, { useEffect, useRef, useState } from 'react'
import api from '../../lib/api'
import { getAvatar } from '../../lib/avatar'
import RoleName from './RoleName'

function getMentionAtCursor(text, cursor) {
  const before = text.slice(0, cursor)
  const match = before.match(/@([a-zA-Z0-9_]*)$/)
  if (!match) return null
  return { query: match[1], start: before.length - match[0].length }
}

export default function MentionInput({
  value,
  onChange,
  placeholder,
  className = '',
  multiline = false,
  maxLength,
  autoFocus = false,
  onKeyDown: onKeyDownProp,
}) {
  const inputRef = useRef(null)
  const [suggestions, setSuggestions] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [mention, setMention] = useState(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  const showList = mention && suggestions.length > 0

  useEffect(() => {
    if (!mention) {
      setSuggestions([])
      return
    }

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/search/mention-users', {
          params: { q: mention.query },
        })
        setSuggestions(data)
        setActiveIdx(0)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(debounceRef.current)
  }, [mention?.query, mention?.start])

  const updateMentionState = (text, cursor) => {
    const next = getMentionAtCursor(text, cursor)
    setMention(next)
    if (!next) setSuggestions([])
  }

  const handleChange = (e) => {
    const text = e.target.value
    onChange(text)
    updateMentionState(text, e.target.selectionStart)
  }

  const handleSelect = (username) => {
    const el = inputRef.current
    if (!el || !mention) return

    const cursor = el.selectionStart
    const before = value.slice(0, mention.start)
    const after = value.slice(cursor)
    const next = `${before}@${username} ${after}`

    onChange(next)
    setMention(null)
    setSuggestions([])

    const newCursor = before.length + username.length + 2
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(newCursor, newCursor)
    })
  }

  const handleKeyDown = (e) => {
    if (showList) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => (i + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleSelect(suggestions[activeIdx].username)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMention(null)
        setSuggestions([])
        return
      }
    }

    onKeyDownProp?.(e)
  }

  const sharedProps = {
    ref: inputRef,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onClick: (e) => updateMentionState(value, e.target.selectionStart),
    onKeyUp: (e) => updateMentionState(value, e.target.selectionStart),
    placeholder,
    maxLength,
    autoFocus,
    className,
  }

  return (
    <div className="relative">
      {multiline ? (
        <textarea {...sharedProps} />
      ) : (
        <input type="text" {...sharedProps} />
      )}

      {mention && (showList || loading) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 card shadow-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden max-h-52 overflow-y-auto">
          {loading && suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-neutral-400">Mencari user…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-neutral-400">User tidak ditemukan</p>
          ) : (
            suggestions.map((user, idx) => (
              <button
                key={user._id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(user.username)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  idx === activeIdx
                    ? 'bg-accent-50 dark:bg-accent-950/30'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <img
                  src={getAvatar(user.avatar, user.username)}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0">
                  <RoleName username={user.username} role={user.role} size="sm" />
                  <p className="text-2xs text-neutral-400">@{user.username}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
