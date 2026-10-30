'use client'

/**
 * Recently-viewed products, persisted in localStorage.
 * Shared by ProductDetail (writes) and HomePage (reads).
 */

export type RecentlyViewedItem = {
  id: string
  slug: string
  title: string
  image: string | null
  price: number
  mrp: number
  rating: number
  reviewCount: number
  condition?: string | null
  categorySlug?: string | null
  viewedAt: number
}

const KEY = 'shopkart-recently-viewed'
const MAX_ITEMS = 12

export function getRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (i): i is RecentlyViewedItem =>
        i && typeof i === 'object' && typeof i.id === 'string' && typeof i.slug === 'string'
    )
  } catch {
    return []
  }
}

/** Add/prepend a product to the recently-viewed list (deduped, capped). */
export function recordRecentlyViewed(item: Omit<RecentlyViewedItem, 'viewedAt'>): void {
  if (typeof window === 'undefined') return
  try {
    const prev = getRecentlyViewed().filter((i) => i.id !== item.id)
    const next = [{ ...item, viewedAt: Date.now() }, ...prev].slice(0, MAX_ITEMS)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full/unavailable — ignore */
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
