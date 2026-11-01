'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ViewName =
  | 'home'
  | 'listing'
  | 'product'
  | 'vendor'
  | 'cart'
  | 'checkout'
  | 'order-success'
  | 'orders'
  | 'order-detail'
  | 'wishlist'
  | 'account'
  | 'auth'
  | 'vendor-panel'
  | 'admin-panel'
  | 'notifications'
  | 'static'
  | 'quote'
  | 'b2b'
  | 'ewaste'

export type ViewParams = Record<string, string | undefined>

const VIEW_NAMES: ViewName[] = [
  'home',
  'listing',
  'product',
  'vendor',
  'cart',
  'checkout',
  'order-success',
  'orders',
  'order-detail',
  'wishlist',
  'account',
  'auth',
  'vendor-panel',
  'admin-panel',
  'notifications',
  'static',
  'quote',
  'b2b',
  'ewaste',
]

/** Serialize view + params into a shareable URL hash, e.g. `#/product?slug=pulse-x5`. */
export function buildHash(view: ViewName, params: ViewParams = {}): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&')
  return `#/${view}${qs ? `?${qs}` : ''}`
}

/** Parse a `#/view?key=value` hash back into view + params (null if invalid). */
export function parseHash(hash: string): { view: ViewName; params: ViewParams } | null {
  if (!hash || !hash.startsWith('#/')) return null
  try {
    const [rawPath, rawQuery] = hash.slice(2).split('?')
    const view = decodeURIComponent(rawPath || '') as ViewName
    if (!VIEW_NAMES.includes(view)) return null
    const params: ViewParams = {}
    if (rawQuery) {
      for (const pair of rawQuery.split('&')) {
        if (!pair) continue
        const eq = pair.indexOf('=')
        const k = eq >= 0 ? pair.slice(0, eq) : pair
        const v = eq >= 0 ? pair.slice(eq + 1) : ''
        params[decodeURIComponent(k)] = decodeURIComponent(v)
      }
    }
    return { view, params }
  } catch {
    // malformed % sequences (URIError) — treat as an invalid deep link
    return null
  }
}

export type SessionUser = {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  status: string
  staffRole?: string | null
  vendor?: { id: string; name: string; status: string; slug: string } | null
}

export type GuestCartItem = {
  productId: string
  variantId?: string | null
  qty: number
  title: string
  slug: string
  image: string | null
  price: number
  mrp: number
  stock: number
  variantName?: string | null
  vendorName: string // "Lastrivon Retail" for platform
  vendorSlug?: string | null
  shippingFee: number
  freeShipping: boolean
}

export type AppSettings = {
  siteName: string
  announcement: string | null
  freeShipThreshold: number
  baseShipFee: number
  codFee: number
  codEnabled?: boolean
}

type AppState = {
  /* navigation */
  view: ViewName
  params: ViewParams
  navigate: (view: ViewName, params?: ViewParams) => void
  syncFromHash: () => boolean

  /* session */
  user: SessionUser | null
  authLoading: boolean
  setUser: (u: SessionUser | null) => void
  refreshMe: () => Promise<void>
  logout: () => Promise<void>

  /* cart */
  cartCount: number
  setCartCount: (n: number) => void
  refreshCartCount: () => Promise<void>
  guestCart: GuestCartItem[]
  guestCouponCode: string | null
  setGuestCouponCode: (code: string | null) => void
  addToGuestCart: (item: GuestCartItem) => void
  updateGuestQty: (productId: string, variantId: string | null, qty: number) => void
  removeGuestItem: (productId: string, variantId: string | null) => void
  clearGuestCart: () => void
  mergeGuestCartOnLogin: () => Promise<void>

  /* cart drawer / search */
  cartOpen: boolean
  setCartOpen: (open: boolean) => void

  /* wishlist ids for instant heart state */
  wishlistIds: string[]
  setWishlistIds: (ids: string[]) => void

  /* global settings from CMS */
  settings: AppSettings | null
  setSettings: (s: AppSettings) => void

  /* unread notifications */
  unreadCount: number
  setUnreadCount: (n: number) => void
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, { credentials: 'include', ...init })
  const json = await res.json().catch(() => ({}))
  return json
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: 'home',
      params: {},
      navigate: (view, params = {}) => {
        set({ view, params })
        if (typeof window !== 'undefined') {
          try {
            history.pushState(null, '', buildHash(view, params))
          } catch {
            /* history unavailable — ignore */
          }
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
        }
      },
      /** Apply the current URL hash to the store WITHOUT pushing history (used on back/forward + first load). */
      syncFromHash: () => {
        if (typeof window === 'undefined') return false
        const parsed = parseHash(window.location.hash)
        if (!parsed) return false
        const { view, params } = parsed
        if (view === get().view && JSON.stringify(params) === JSON.stringify(get().params)) return false
        set({ view, params })
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
        return true
      },

      user: null,
      authLoading: true,
      setUser: (u) => set({ user: u }),
      refreshMe: async () => {
        const json = await apiFetch('/api/auth')
        if (json.ok) {
          set({ user: json.data.user, authLoading: false })
          // refresh cart count + wishlist ids
          get().refreshCartCount()
          // guests get { user: null } here; the wishlist endpoint would only 401
          if (json.data.user) {
            const w = await apiFetch('/api/wishlist/ids')
            if (w.ok) set({ wishlistIds: w.data.ids as string[] })
          }
        } else {
          set({ user: null, authLoading: false })
        }
      },
      logout: async () => {
        await apiFetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'logout' }),
        })
        set({ user: null, cartCount: 0, wishlistIds: [], unreadCount: 0 })
      },

      cartCount: 0,
      setCartCount: (n) => set({ cartCount: n }),
      refreshCartCount: async () => {
        const u = get().user
        if (!u) {
          set({ cartCount: get().guestCart.reduce((s, i) => s + i.qty, 0) })
          return
        }
        const json = await apiFetch('/api/cart')
        if (json.ok) {
          set({ cartCount: (json.data.items as { qty: number }[]).reduce((s, i) => s + i.qty, 0) })
        }
      },

      guestCart: [],
      guestCouponCode: null,
      setGuestCouponCode: (code) => set({ guestCouponCode: code }),
      addToGuestCart: (item) => {
        const cart = get().guestCart
        const idx = cart.findIndex(
          (i) => i.productId === item.productId && (i.variantId ?? null) === (item.variantId ?? null)
        )
        if (idx >= 0) {
          const next = [...cart]
          next[idx] = { ...next[idx], qty: Math.min(next[idx].qty + item.qty, Math.max(item.stock, 1)) }
          set({ guestCart: next })
        } else {
          set({ guestCart: [...cart, item] })
        }
        set({ cartCount: get().guestCart.reduce((s, i) => s + i.qty, 0) })
      },
      updateGuestQty: (productId, variantId, qty) => {
        set({
          guestCart: get().guestCart.map((i) =>
            i.productId === productId && (i.variantId ?? null) === (variantId ?? null) ? { ...i, qty } : i
          ),
        })
        set({ cartCount: get().guestCart.reduce((s, i) => s + i.qty, 0) })
      },
      removeGuestItem: (productId, variantId) => {
        set({
          guestCart: get().guestCart.filter(
            (i) => !(i.productId === productId && (i.variantId ?? null) === (variantId ?? null))
          ),
        })
        set({ cartCount: get().guestCart.reduce((s, i) => s + i.qty, 0) })
      },
      clearGuestCart: () => set({ guestCart: [], guestCouponCode: null, cartCount: 0 }),
      mergeGuestCartOnLogin: async () => {
        const guest = get().guestCart
        const couponCode = get().guestCouponCode
        if (guest.length === 0 && !couponCode) return
        for (const item of guest) {
          await apiFetch('/api/cart/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: item.productId, variantId: item.variantId ?? null, qty: item.qty }),
          })
        }
        if (couponCode) {
          await apiFetch('/api/cart/coupon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: couponCode }),
          })
        }
        set({ guestCart: [], guestCouponCode: null })
        get().refreshCartCount()
      },

      cartOpen: false,
      setCartOpen: (open) => set({ cartOpen: open }),

      wishlistIds: [],
      setWishlistIds: (ids) => set({ wishlistIds: ids }),

      settings: null,
      setSettings: (s) => set({ settings: s }),

      unreadCount: 0,
      setUnreadCount: (n) => set({ unreadCount: n }),
    }),
    {
      name: 'shopkart-guest-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) =>
        ({ guestCart: state.guestCart, guestCouponCode: state.guestCouponCode }) as unknown as AppState,
    }
  )
)

/** Shared fetch helper for all components */
export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const { json, ...rest } = init ?? {}
    const res = await fetch(path, {
      credentials: 'include',
      ...rest,
      headers: json !== undefined ? { 'Content-Type': 'application/json', ...(rest.headers ?? {}) } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })
    return await res.json()
  } catch (e) {
    return { ok: false, error: 'Network error. Please try again.' }
  }
}
