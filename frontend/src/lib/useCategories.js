/**
 * Hook that fetches active categories from the API and caches them
 * in module scope so we only hit the network once per page load.
 */
import { useState, useEffect } from 'react'
import api from './api'
import { GAME_CATEGORIES as FALLBACK } from './constants'

let cache = null // module-level cache

export function useCategories() {
  const [categories, setCategories] = useState(cache || [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) { setCategories(cache); setLoading(false); return }
    api.get('/categories')
      .then(({ data }) => {
        cache = data
        setCategories(data)
      })
      .catch(() => {
        // Fall back to the hardcoded list if the API is unreachable
        cache = FALLBACK
        setCategories(FALLBACK)
      })
      .finally(() => setLoading(false))
  }, [])

  return { categories, loading }
}

/** Call this to bust the cache (e.g. after admin adds/deletes a category) */
export function invalidateCategoryCache() {
  cache = null
}
