'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Search,
  Menu,
  Heart,
  Bell,
  ShoppingBag,
  ChevronDown,
  User,
  Package,
  Store,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  Briefcase,
  FileText,
  X,
  History,
  Tag,
  TrendingUp,
  CornerDownLeft,
  Recycle,
} from 'lucide-react'
import { useAppStore, api } from '@/lib/store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { emojiFor, productImages, type ProductCardData } from './ProductCard'
import { toast } from 'sonner'

type Cat = { id: string; name: string; slug: string; children?: Cat[] }

const RECENTS_KEY = 'sk-recent-searches'
const MAX_RECENTS = 5

function loadRecents(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string').slice(0, MAX_RECENTS) : []
  } catch {
    return []
  }
}

function saveRecent(q: string) {
  const text = q.trim()
  if (!text) return
  const next = [text, ...loadRecents().filter((s) => s.toLowerCase() !== text.toLowerCase())].slice(0, MAX_RECENTS)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* storage full/blocked — ignore */
  }
}

function clearRecents() {
  try {
    localStorage.removeItem(RECENTS_KEY)
  } catch {
    /* ignore */
  }
}

function IconBadge({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex">
      {children}
      {count > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </span>
  )
}

/* ============================ search box ============================ */

type SuggestState = {
  open: boolean
  loading: boolean
  products: ProductCardData[]
  recents: string[]
  activeIdx: number // -1 = none; indexes into products
}

function SearchBox({ id, autoFocus, onNavigate }: { id: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const navigate = useAppStore((s) => s.navigate)
  const [text, setText] = useState('')
  const [state, setState] = useState<SuggestState>({
    open: false,
    loading: false,
    products: [],
    recents: [],
    activeIdx: -1,
  })
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false, activeIdx: -1 }))
  }, [])

  const openWith = useCallback((patch: Partial<SuggestState>) => {
    setState((s) => ({ ...s, open: true, activeIdx: -1, ...patch }))
  }, [])

  /* recent searches on focus */
  const handleFocus = useCallback(() => {
    openWith({ recents: loadRecents(), products: [], loading: false })
  }, [openWith])

  /* debounced suggestions */
  useEffect(() => {
    const q = text.trim()
    if (q.length < 2) {
      abortRef.current?.abort()
      setState((s) => ({ ...s, loading: false, products: [] }))
      return
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setState((s) => ({ ...s, loading: true }))
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=6`, {
          credentials: 'include',
          signal: ctrl.signal,
        })
        const json = await res.json()
        if (!json?.ok) throw new Error(json?.error ?? 'failed')
        setState((s) => ({
          ...s,
          open: true,
          loading: false,
          products: (json.data?.items ?? []) as ProductCardData[],
          activeIdx: -1,
        }))
      } catch {
        /* aborted or network error */
        setState((s) => ({ ...s, loading: false }))
      }
    }, 250)
    return () => clearTimeout(t)
  }, [text])

  /* click outside closes */
  useEffect(() => {
    if (!state.open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [state.open, close])

  function submitSearch(q: string) {
    const query = q.trim()
    if (!query) return
    saveRecent(query)
    close()
    setText(query)
    onNavigate?.()
    navigate('listing', { search: query })
  }

  function goToProduct(p: ProductCardData) {
    close()
    setText('')
    onNavigate?.()
    navigate('product', { slug: p.slug })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      close()
      inputRef.current?.blur()
      return
    }
    const n = state.products.length
    if (e.key === 'ArrowDown' && n > 0) {
      e.preventDefault()
      setState((s) => ({ ...s, open: true, activeIdx: (s.activeIdx + 1) % n }))
    } else if (e.key === 'ArrowUp' && n > 0) {
      e.preventDefault()
      setState((s) => ({ ...s, open: true, activeIdx: (s.activeIdx - 1 + n) % n }))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (state.activeIdx >= 0 && state.products[state.activeIdx]) {
        goToProduct(state.products[state.activeIdx])
      } else {
        submitSearch(text)
      }
    }
  }

  const q = text.trim()
  const matchingCats: { name: string; slug: string }[] = []
  if (q.length >= 2) {
    // lightweight category hints from the homepage category tree (max 3)
    const walk = (cats: Cat[]) => {
      for (const c of cats) {
        if (matchingCats.length >= 3) return
        if (c.name.toLowerCase().includes(q.toLowerCase())) matchingCats.push({ name: c.name, slug: c.slug })
        if (c.children) walk(c.children)
      }
    }
    walk(categoriesSnapshot)
  }

  const showPanel =
    state.open &&
    (state.loading || state.products.length > 0 || matchingCats.length > 0 || (q.length < 2 && state.recents.length > 0))

  return (
    <div ref={boxRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submitSearch(text)
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          id={id}
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={onKeyDown}
          autoComplete="off"
          placeholder="Search products, brands… ( / )"
          className="h-10 rounded-lg border-stone-200 bg-stone-50 pl-9 pr-10 text-sm focus-visible:ring-orange-500"
          aria-label="Search products"
        />
        {text ? (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            onClick={() => {
              setText('')
              inputRef.current?.focus()
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </form>

      {/* suggestions dropdown */}
      {showPanel ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-white shadow-xl">
          {/* recent searches */}
          {q.length < 2 && state.recents.length > 0 ? (
            <div className="py-1">
              <div className="flex items-center justify-between px-3 pb-1 pt-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Recent searches</span>
                <button
                  type="button"
                  className="text-[11px] font-medium text-stone-400 hover:text-orange-600"
                  onClick={() => {
                    clearRecents()
                    setState((s) => ({ ...s, recents: [] }))
                  }}
                >
                  Clear
                </button>
              </div>
              {state.recents.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-stone-700 hover:bg-orange-50"
                  onClick={() => submitSearch(r)}
                >
                  <History className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                  <span className="truncate">{r}</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* category hints */}
          {matchingCats.length > 0 ? (
            <div className="border-t border-stone-100 py-1">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                Categories
              </p>
              {matchingCats.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-stone-700 hover:bg-orange-50"
                  onClick={() => {
                    close()
                    setText('')
                    onNavigate?.()
                    navigate('listing', { category: c.slug })
                  }}
                >
                  <Tag className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* loading */}
          {state.loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-stone-400">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-200 border-t-orange-500" />
              Searching…
            </div>
          ) : null}

          {/* products */}
          {!state.loading && state.products.length > 0 ? (
            <div className="py-1">
              {state.products.map((p, i) => {
                const urls = productImages(p)
                const active = i === state.activeIdx
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left ${active ? 'bg-orange-50' : 'hover:bg-orange-50'}`}
                    onMouseEnter={() => setState((s) => ({ ...s, activeIdx: i }))}
                    onClick={() => goToProduct(p)}
                  >
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-stone-100 via-orange-50 to-amber-50">
                      {urls[0] ? (
                        <img
                          src={urls[0]}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).style.opacity = '0'
                          }}
                        />
                      ) : null}
                      <span className={`text-lg select-none ${urls[0] ? 'opacity-0' : ''}`} aria-hidden="true">
                        {emojiFor(p.category?.slug)}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-stone-800">{p.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs">
                        <span className="font-semibold text-stone-900">{formatINR(p.price)}</span>
                        {p.condition === 'REFURBISHED' ? (
                          <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-700">
                            ♻ Refurbished
                          </span>
                        ) : null}
                        {p.stock <= 0 ? <span className="text-stone-400">Out of stock</span> : null}
                      </span>
                    </span>
                    {active ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-orange-500" /> : null}
                  </button>
                )
              })}
            </div>
          ) : null}

          {/* see all + trending fallback */}
          {!state.loading && q.length >= 2 ? (
            <div className="border-t border-stone-100">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-orange-600 hover:bg-orange-50"
                onClick={() => submitSearch(text)}
              >
                <Search className="h-3.5 w-3.5" />
                See all results for “{q}”
              </button>
            </div>
          ) : null}

          {/* trending hints when nothing typed and no recents */}
          {!state.loading && q.length < 2 && state.recents.length === 0 ? (
            <div className="py-2">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                Trending searches
              </p>
              {['Headphones', 'Refurbished phone', 'Laptop', 'Smartwatch'].map((t) => (
                <button
                  key={t}
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-stone-700 hover:bg-orange-50"
                  onClick={() => submitSearch(t)}
                >
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                  {t}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* module-level categories snapshot, refreshed by Header so SearchBox can hint categories */
let categoriesSnapshot: Cat[] = []

/* ============================== Header ============================== */

export default function Header() {
  const navigate = useAppStore((s) => s.navigate)
  const user = useAppStore((s) => s.user)
  const cartCount = useAppStore((s) => s.cartCount)
  const refreshCartCount = useAppStore((s) => s.refreshCartCount)
  const wishlistIds = useAppStore((s) => s.wishlistIds)
  const unreadCount = useAppStore((s) => s.unreadCount)
  const setUnreadCount = useAppStore((s) => s.setUnreadCount)
  const setSettings = useAppStore((s) => s.setSettings)
  const settings = useAppStore((s) => s.settings)
  const logout = useAppStore((s) => s.logout)

  const [siteName, setSiteName] = useState(settings?.siteName ?? 'Lastrivon Kart India')
  const [announcement, setAnnouncement] = useState(settings?.announcement ?? '')
  const [categories, setCategories] = useState<Cat[]>([])
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  /* fetch home settings + categories once */
  useEffect(() => {
    let alive = true
    api<{
      siteName: string
      announcement: string | null
      freeShipThreshold: number
      baseShipFee: number
      codFee: number
      categories: Cat[]
    }>('/api/home').then((r) => {
      if (!alive || !r.ok || !r.data) return
      setSiteName(r.data.siteName)
      setAnnouncement(r.data.announcement ?? '')
      setSettings({
        siteName: r.data.siteName,
        announcement: r.data.announcement ?? null,
        freeShipThreshold: r.data.freeShipThreshold,
        baseShipFee: r.data.baseShipFee,
        codFee: r.data.codFee,
      })
      setCategories(r.data.categories ?? [])
      categoriesSnapshot = r.data.categories ?? []
    })
    return () => {
      alive = false
    }
  }, [setSettings])

  /* session-dependent counts */
  useEffect(() => {
    refreshCartCount()
    if (user) {
      api<{ unread: number }>('/api/notifications').then((r) => {
        if (r.ok && r.data) setUnreadCount(r.data.unread ?? 0)
        else setUnreadCount(0)
      })
    }
  }, [user, refreshCartCount, setUnreadCount])

  /* "/" keyboard shortcut focuses search */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && !target?.isContentEditable) {
        e.preventDefault()
        if (window.innerWidth < 768) {
          setMobileSearchOpen(true)
          requestAnimationFrame(() => document.getElementById('mobile-search')?.focus())
        } else {
          const el = document.getElementById('header-search') as HTMLInputElement | null
          el?.focus()
          el?.select()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function go(view: Parameters<typeof navigate>[0], params?: Record<string, string | undefined>) {
    setMenuOpen(false)
    navigate(view, params)
  }

  async function handleLogout() {
    await logout()
    toast.success('Logged out')
    navigate('home')
  }

  const isVendorRole = user?.role === 'VENDOR_ADMIN' || user?.role === 'VENDOR_STAFF'
  const isAdminRole = user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_STAFF'

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      {/* announcement marquee bar */}
      {announcement ? (
        <div className="overflow-hidden bg-orange-600 py-1.5 text-white">
          <style>{`@keyframes sk-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
          <div className="flex w-max sk-marquee" style={{ animation: 'sk-marquee 25s linear infinite' }}>
            {[0, 1].map((i) => (
              <span key={i} className="whitespace-nowrap px-8 text-xs font-medium tracking-wide">
                🎉 {announcement} &nbsp; • &nbsp; Free shipping on orders over {settings ? `₹${settings.freeShipThreshold}` : '₹499'}!
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* main row */}
      <div className="container mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        {/* mobile menu */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-left text-lg font-extrabold text-orange-600">
                🛍️ {siteName}
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4 pb-6">
              <div className="pb-2">
                <SearchBox id="mobile-menu-search" onNavigate={() => setMenuOpen(false)} />
              </div>
              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Categories</p>
              <button
                className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-teal-700 hover:bg-teal-50"
                onClick={() => go('listing', { condition: 'REFURBISHED' })}
              >
                ♻ Renewed & Refurbished
              </button>
              {categories.map((c) => (
                <div key={c.id}>
                  <button
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-orange-50 hover:text-orange-700"
                    onClick={() => go('listing', { category: c.slug })}
                  >
                    {c.name}
                  </button>
                  {c.children?.length ? (
                    <div className="ml-3 border-l border-stone-200 pl-2">
                      {c.children.map((ch) => (
                        <button
                          key={ch.id}
                          className="block w-full rounded-md px-2 py-1 text-left text-xs text-stone-500 hover:text-orange-700"
                          onClick={() => go('listing', { category: ch.slug })}
                        >
                          {ch.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              <Separator className="my-3" />
              <button className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-stone-100" onClick={() => go('orders')}>
                <Package className="h-4 w-4 text-stone-500" /> Track Orders
              </button>
              <button className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-stone-100" onClick={() => go('wishlist')}>
                <Heart className="h-4 w-4 text-stone-500" /> My Wishlist
              </button>
              <button className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-stone-100" onClick={() => go('cart')}>
                <ShoppingBag className="h-4 w-4 text-stone-500" /> Cart
              </button>
              <button className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-stone-100" onClick={() => go(user ? 'account' : 'auth')}>
                <User className="h-4 w-4 text-stone-500" /> {user ? 'My Account' : 'Sign in / Register'}
              </button>
              <button className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50" onClick={() => go('auth', { tab: 'vendor' })}>
                <Store className="h-4 w-4" /> Become a Seller
              </button>
              <button className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50" onClick={() => go('b2b')}>
                <Briefcase className="h-4 w-4" /> For Business (B2B)
              </button>
              <button className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-stone-100" onClick={() => go('quote')}>
                <FileText className="h-4 w-4 text-stone-500" /> Request a Quote
              </button>
              <button className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50" onClick={() => go('ewaste')}>
                <Recycle className="h-4 w-4" /> E-Waste Pickup
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* logo */}
        <button
          className="flex min-w-0 items-center gap-1.5 text-lg font-extrabold tracking-tight text-orange-600 sm:shrink-0 sm:text-2xl"
          onClick={() => navigate('home')}
          aria-label={`${siteName} home`}
        >
          <span className="shrink-0">🛍️</span> <span className="hidden min-w-0 truncate min-[340px]:block sm:hidden">{siteName.replace(/\s+India$/i, '')}</span><span className="hidden min-w-0 truncate sm:block">{siteName}</span>
        </button>

        {/* desktop search */}
        <div className="hidden min-w-0 flex-1 md:flex md:max-w-xl md:mx-4">
          <SearchBox id="header-search" />
        </div>

        <div className="flex-1 md:hidden" aria-hidden="true" />

        {/* actions */}
        <nav className="flex shrink-0 items-center gap-0 sm:gap-2" aria-label="Primary">
          {/* mobile search toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Search"
            onClick={() => setMobileSearchOpen((v) => !v)}
          >
            {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Wishlist"
            className="relative hidden sm:inline-flex"
            onClick={() => navigate('wishlist')}
          >
            <IconBadge count={user ? wishlistIds.length : 0}>
              <Heart className="h-5 w-5" />
            </IconBadge>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="relative"
            onClick={() => (user ? navigate('notifications') : navigate('auth'))}
          >
            <IconBadge count={user ? unreadCount : 0}>
              <Bell className="h-5 w-5" />
            </IconBadge>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Cart"
            className="relative"
            onClick={() => navigate('cart')}
          >
            <IconBadge count={cartCount}>
              <ShoppingBag className="h-5 w-5" />
            </IconBadge>
          </Button>

          {/* account dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Account">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {!user ? (
                <>
                  <DropdownMenuItem onClick={() => navigate('auth')}>
                    <User className="h-4 w-4" /> Sign in
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('auth', { tab: 'register' })}>
                    <User className="h-4 w-4" /> Register
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('auth', { tab: 'vendor' })}>
                    <Store className="h-4 w-4" /> Become a Seller
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuLabel>
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p className="text-xs font-normal text-stone-500">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('orders')}>
                    <Package className="h-4 w-4" /> My Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('wishlist')}>
                    <Heart className="h-4 w-4" /> My Wishlist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('account')}>
                    <User className="h-4 w-4" /> Account
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('notifications')}>
                    <Bell className="h-4 w-4" /> Notifications
                  </DropdownMenuItem>
                  {isVendorRole ? (
                    <DropdownMenuItem onClick={() => navigate('vendor-panel')}>
                      <LayoutDashboard className="h-4 w-4" /> Vendor Panel
                    </DropdownMenuItem>
                  ) : null}
                  {isAdminRole ? (
                    <DropdownMenuItem onClick={() => navigate('admin-panel')}>
                      <ShieldCheck className="h-4 w-4" /> Admin Panel
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4" /> Logout
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>

      {/* mobile expandable search */}
      {mobileSearchOpen ? (
        <div className="border-t px-4 py-2 md:hidden">
          <SearchBox id="mobile-search" autoFocus />
        </div>
      ) : null}

      {/* category nav row (desktop) */}
      <div className="hidden border-t lg:block">
        <div className="container mx-auto flex h-10 max-w-7xl items-center gap-4 px-4 text-sm">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 font-medium text-stone-700 outline-none hover:text-orange-700">
              <Menu className="h-4 w-4" /> All Categories <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {categories.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => navigate('listing', { category: c.slug })}>
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="h-4 w-px bg-stone-200" />

          <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.slice(0, 7).map((c, i) => (
              <button
                key={c.id}
                className={cn('whitespace-nowrap text-stone-600 hover:text-orange-700', i >= 3 && 'hidden xl:inline')}
                onClick={() => navigate('listing', { category: c.slug })}
              >
                {c.name}
              </button>
            ))}
            <button
              className="whitespace-nowrap font-medium text-teal-700 hover:text-teal-800"
              onClick={() => navigate('listing', { condition: 'REFURBISHED' })}
            >
              ♻ Renewed
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex shrink-0 items-center gap-1 whitespace-nowrap font-medium text-orange-700 outline-none hover:text-orange-800">
                For Business <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem onClick={() => navigate('b2b')}>
                  <Briefcase className="h-4 w-4" /> Bulk Buying (B2B)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('quote')}>
                  <FileText className="h-4 w-4" /> Request a Quote
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('ewaste')}>
                  <Recycle className="h-4 w-4" /> E-Waste Pickup
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              className="whitespace-nowrap font-medium text-emerald-700 hover:text-emerald-800"
              onClick={() => navigate('ewaste')}
            >
              ♻ E-Waste
            </button>
          </div>

          <button
            className="whitespace-nowrap font-medium text-orange-700 hover:text-orange-800"
            onClick={() => navigate('auth', { tab: 'vendor' })}
          >
            Become a Seller
          </button>
          <span className="h-4 w-px bg-stone-200" />
          <button
            className="whitespace-nowrap text-stone-600 hover:text-orange-700"
            onClick={() => navigate('orders')}
          >
            Track Orders
          </button>
        </div>
      </div>
    </header>
  )
}
