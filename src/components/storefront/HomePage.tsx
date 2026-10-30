'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Truck,
  ShieldCheck,
  RotateCcw,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Flame,
  Recycle,
  History,
  Store as StoreIcon,
  MapPin,
  Star,
  ArrowRight,
  Timer,
} from 'lucide-react'
import { useAppStore, api } from '@/lib/store'
import ProductCard, { emojiFor, type ProductCardData } from './ProductCard'
import { getRecentlyViewed, type RecentlyViewedItem } from '@/lib/recent'
import { formatINR, discountPercent } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

/* ------------------------------ types ------------------------------ */

type Banner = {
  id: string
  title: string
  imageUrl: string | null
  link: string | null
  position: string
}
type Category = {
  id: string
  name: string
  slug: string
  icon: string | null
  image: string | null
  children?: Category[]
}
type VendorCard = {
  id: string
  name: string
  slug: string
  logoText: string
  city: string | null
  state: string | null
  rating: number
  description: string | null
}
type HomeData = {
  siteName: string
  banners: Banner[]
  categories: Category[]
  featured: ProductCardData[]
  bestSellers: ProductCardData[]
  newArrivals: ProductCardData[]
  deals: ProductCardData[]
  refurbished: ProductCardData[]
  vendors: VendorCard[]
}

const HERO_GRADIENTS = [
  'from-orange-600 via-amber-500 to-rose-500',
  'from-stone-800 via-stone-700 to-orange-800',
  'from-emerald-600 via-teal-500 to-lime-500',
  'from-rose-600 via-pink-500 to-orange-400',
]

/** banner.link → navigate target ('listing:deals' | 'listing:<category>' | …) */
function useBannerClick() {
  const navigate = useAppStore((s) => s.navigate)
  return useCallback(
    (link: string | null | undefined) => {
      if (link && link.startsWith('listing:')) {
        const rest = link.slice('listing:'.length)
        if (rest === 'deals') return navigate('listing', { badge: 'DEAL' })
        if (rest === 'renewed') return navigate('listing', { condition: 'REFURBISHED' })
        if (rest === 'sponsored') return navigate('listing', { sponsored: 'true' })
        if (rest) return navigate('listing', { category: rest })
      }
      navigate('home')
    },
    [navigate]
  )
}

function BannerSlide({ banner, tall }: { banner: Banner; tall?: boolean }) {
  const onBannerClick = useBannerClick()
  const idx = Math.abs(hashStr(banner.id)) % HERO_GRADIENTS.length
  return (
    <div
      className={`relative ${tall ? 'h-full' : 'h-full'} w-full cursor-pointer overflow-hidden`}
      onClick={() => onBannerClick(banner.link)}
      role="link"
      aria-label={banner.title}
    >
      {banner.imageUrl && banner.imageUrl.trim() !== '' ? (
        <>
          <img
            src={banner.imageUrl}
            alt={banner.title}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.opacity = '0'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6">
            <p className="max-w-md text-lg font-extrabold text-white drop-shadow sm:text-2xl">
              {banner.title}
            </p>
          </div>
        </>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-r ${HERO_GRADIENTS[idx]}`}>
          <div className="flex h-full flex-col items-start justify-center gap-2 px-5 sm:px-10">
            <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur">
              Limited Time
            </span>
            <p className="max-w-lg text-xl font-extrabold leading-tight text-white drop-shadow sm:text-3xl lg:text-4xl">
              {banner.title}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-lg bg-white px-4 py-2 text-xs font-bold text-orange-700 shadow sm:text-sm">
              Shop Now <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

function SectionHeader({
  title,
  icon,
  action,
}: {
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900 sm:text-xl">
          {icon}
          {title}
        </h2>
        <div className="mt-1.5 h-1 w-10 rounded-full bg-orange-600" />
      </div>
      {action}
    </div>
  )
}

/**
 * Compact "Ends in HH:MM:SS" chip counting down to the next local midnight.
 * Renders a static `--:--:--` chip on the server / before mount (SSR-safe),
 * then ticks every second once mounted.
 */
function DealCountdown() {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  let label = '--:--:--'
  if (now !== null) {
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0) /* next local midnight */
    let secs = Math.max(0, Math.floor((midnight.getTime() - now) / 1000))
    const hh = Math.min(23, Math.floor(secs / 3600))
    secs %= 3600
    const mm = Math.floor(secs / 60)
    const ss = secs % 60
    label = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 sm:inline-flex"
      role="timer"
      aria-label={`Deals end in ${label}`}
    >
      <Timer className="h-3.5 w-3.5" />
      Ends in {label}
    </span>
  )
}

/** Fade/slide entrance for home sections when they scroll into view. */
function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-xl border p-3">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
      ))}
    </div>
  )
}

/* ============================== HomePage ============================== */

export default function HomePage() {
  const navigate = useAppStore((s) => s.navigate)
  const [data, setData] = useState<HomeData | null>(null)
  const [heroIdx, setHeroIdx] = useState(0)
  const [heroPaused, setHeroPaused] = useState(false)
  const [recent, setRecent] = useState<RecentlyViewedItem[]>([])

  useEffect(() => {
    let alive = true
    api<HomeData>('/api/home').then((r) => {
      if (!alive) return
      if (r.ok && r.data) {
        setData(r.data)
      }
    })
    /* recently viewed is localStorage-backed — read after mount to stay SSR-safe */
    const readRecent = () => setRecent(getRecentlyViewed())
    readRecent()
    window.addEventListener('focus', readRecent)
    return () => {
      alive = false
      window.removeEventListener('focus', readRecent)
    }
  }, [])

  const onBannerClick = useBannerClick()

  const heroBanners = useMemo(
    () => (data?.banners ?? []).filter((b) => b.position === 'HERO'),
    [data]
  )
  const promoBanners = useMemo(
    () => (data?.banners ?? []).filter((b) => b.position === 'PROMO'),
    [data]
  )

  /* auto-advance hero every 5s (paused while hovered — clearing the interval pauses + resets) */
  useEffect(() => {
    if (heroBanners.length <= 1) return
    if (heroPaused) return
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % heroBanners.length), 5000)
    return () => clearInterval(t)
  }, [heroBanners.length, heroPaused])

  const trust = [
    { icon: <Truck className="h-5 w-5" />, label: 'Free shipping over ₹499' },
    { icon: <ShieldCheck className="h-5 w-5" />, label: 'Secure payments' },
    { icon: <RotateCcw className="h-5 w-5" />, label: '7-day easy returns' },
    { icon: <BadgeCheck className="h-5 w-5" />, label: 'GST invoices' },
  ]

  return (
    <div className="container mx-auto max-w-7xl space-y-10 px-4 py-5 sm:py-8">
      {/* 1. hero carousel */}
      <section aria-label="Featured offers">
        {heroBanners.length === 0 ? (
          <Skeleton className="h-40 w-full rounded-2xl sm:h-64 lg:h-80" />
        ) : (
          <div
            className="relative h-40 overflow-hidden rounded-2xl sm:h-64 lg:h-80"
            onMouseEnter={() => setHeroPaused(true)}
            onMouseLeave={() => setHeroPaused(false)}
          >
            {heroBanners.map((b, i) => (
              <div
                key={b.id}
                className="absolute inset-0 transition-opacity duration-700"
                style={{ opacity: i === heroIdx ? 1 : 0, pointerEvents: i === heroIdx ? 'auto' : 'none' }}
                aria-hidden={i !== heroIdx}
              >
                <BannerSlide banner={b} tall />
              </div>
            ))}

            {heroBanners.length > 1 ? (
              <>
                <button
                  aria-label="Previous banner"
                  className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow transition hover:bg-white"
                  onClick={() => setHeroIdx((heroIdx - 1 + heroBanners.length) % heroBanners.length)}
                >
                  <ChevronLeft className="h-5 w-5 text-stone-700" />
                </button>
                <button
                  aria-label="Next banner"
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow transition hover:bg-white"
                  onClick={() => setHeroIdx((heroIdx + 1) % heroBanners.length)}
                >
                  <ChevronRight className="h-5 w-5 text-stone-700" />
                </button>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {heroBanners.map((_, i) => (
                    <button
                      key={i}
                      aria-label={`Go to banner ${i + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        i === heroIdx ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'
                      }`}
                      onClick={() => setHeroIdx(i)}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}
      </section>

      {/* 1.5 recently viewed (localStorage — hidden until user has history) */}
      {recent.length > 0 ? (
        <section aria-label="Recently viewed">
          <SectionHeader
            title="Recently Viewed"
            icon={<History className="h-5 w-5 text-stone-500" />}
          />
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:gap-4">
            {recent.map((item) => {
              const off = discountPercent(item.mrp, item.price)
              return (
                <button
                  key={item.id}
                  className="group w-[42%] min-w-[150px] shrink-0 snap-start overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:w-48"
                  onClick={() => navigate('product', { slug: item.slug })}
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-stone-100 via-orange-50 to-amber-50">
                    {item.image && item.image.trim() !== '' ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.opacity = '0'
                        }}
                      />
                    ) : null}
                    <span className="absolute inset-0 flex items-center justify-center text-4xl opacity-60 select-none" aria-hidden="true">
                      {emojiFor(item.categorySlug)}
                    </span>
                    {item.condition === 'REFURBISHED' ? (
                      <span className="absolute left-2 top-2 rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        ♻ Refurbished
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-1 text-xs font-medium text-stone-700 group-hover:text-orange-700">
                      {item.title}
                    </p>
                    <p className="flex items-baseline gap-1.5">
                      <span className="text-sm font-bold text-stone-900">{formatINR(item.price)}</span>
                      {item.mrp > item.price ? (
                        <span className="text-[11px] text-stone-400 line-through">{formatINR(item.mrp)}</span>
                      ) : null}
                      {off > 0 ? <span className="text-[11px] font-bold text-orange-600">{off}% off</span> : null}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* 2. trust strip */}
      <section aria-label="Why shop with us" className="pt-2">
        <Reveal>
          <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-4">
            {trust.map((t) => (
              <div key={t.label} className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                  {t.icon}
                </span>
                <span className="text-xs font-medium text-stone-700 sm:text-sm">{t.label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* 3. categories */}
      <section aria-label="Shop by category">
        <Reveal>
          <SectionHeader title="Shop by Category" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {data
              ? data.categories.map((c) => (
                  <button
                    key={c.id}
                    className="group flex flex-col items-center gap-2"
                    onClick={() => navigate('listing', { category: c.slug })}
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border bg-gradient-to-br from-orange-50 to-amber-50 shadow-sm transition group-hover:shadow-md">
                      {c.image && c.image.trim() !== '' ? (
                        <img
                          src={c.image}
                          alt={c.name}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).style.opacity = '0'
                          }}
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl select-none">
                          {emojiFor(c.slug)}
                        </span>
                      )}
                    </div>
                    <span className="line-clamp-1 text-xs font-medium text-stone-700 group-hover:text-orange-700">
                      {c.name}
                    </span>
                  </button>
                ))
              : Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <Skeleton className="aspect-square w-full rounded-2xl" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
          </div>
        </Reveal>
      </section>

      {/* 4. deals of the day */}
      <section aria-label="Deals of the day">
        <Reveal>
          <SectionHeader
            title="Deals of the Day"
            icon={<Flame className="h-5 w-5 text-orange-600" />}
            action={
              <div className="flex items-center gap-2">
                <DealCountdown />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-orange-700 hover:text-orange-800"
                  onClick={() => navigate('listing', { badge: 'DEAL' })}
                >
                  View all <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            }
          />
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:gap-4">
            {data
              ? data.deals.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    className="w-[45%] min-w-[150px] shrink-0 snap-start sm:w-56"
                  />
                ))
              : Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-[45%] min-w-[150px] shrink-0 space-y-2 sm:w-56">
                    <Skeleton className="aspect-square w-full rounded-xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
            {data && data.deals.length === 0 ? (
              <p className="py-8 text-sm text-stone-500">No live deals right now — check back soon!</p>
            ) : null}
          </div>
        </Reveal>
      </section>

      {/* 5. promo banners */}
      <section aria-label="Promotions" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {promoScreens(promoBanners, onBannerClick)}
      </section>

      {/* 6. best sellers */}
      <section aria-label="Best sellers">
        <Reveal>
          <SectionHeader
            title="Best Sellers"
            action={
              <Button
                variant="ghost"
                size="sm"
                className="text-orange-700 hover:text-orange-800"
                onClick={() => navigate('listing', { badge: 'BESTSELLER' })}
              >
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
          {data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {data.bestSellers.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <ProductGridSkeleton />
          )}
        </Reveal>
      </section>

      {/* 7. new arrivals */}
      <section aria-label="New arrivals">
        <Reveal>
          <SectionHeader
            title="New Arrivals"
            action={
              <Button
                variant="ghost"
                size="sm"
                className="text-orange-700 hover:text-orange-800"
                onClick={() => navigate('listing', { badge: 'NEW_ARRIVAL' })}
              >
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
          {data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {data.newArrivals.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <ProductGridSkeleton />
          )}
        </Reveal>
      </section>

      {/* 7.5 renewed & refurbished */}
      <section aria-label="Renewed and refurbished">
        <Reveal>
          <SectionHeader
            title="Renewed & Refurbished"
            icon={<Recycle className="h-5 w-5 text-teal-600" />}
            action={
              <Button
                variant="ghost"
                size="sm"
                className="text-teal-700 hover:text-teal-800"
                onClick={() => navigate('listing', { condition: 'REFURBISHED' })}
              >
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
          <p className="-mt-2 mb-3 text-sm text-stone-500">
            Quality-checked renewed devices at up to 50% off — same performance, kinder price. ♻
          </p>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:gap-4">
            {data
              ? data.refurbished.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    className="w-[45%] min-w-[150px] shrink-0 snap-start sm:w-56"
                  />
                ))
              : Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-[45%] min-w-[150px] shrink-0 space-y-2 sm:w-56">
                    <Skeleton className="aspect-square w-full rounded-xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
            {data && data.refurbished.length === 0 ? (
              <p className="py-8 text-sm text-stone-500">No refurbished products yet — check back soon!</p>
            ) : null}
          </div>
        </Reveal>
      </section>

      {/* 8. featured for you */}
      <section aria-label="Featured for you">
        <Reveal>
          <SectionHeader
            title="Featured for You"
            action={
              <Button
                variant="ghost"
                size="sm"
                className="text-orange-700 hover:text-orange-800"
                onClick={() => navigate('listing', {})}
              >
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
          {data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {data.featured.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <ProductGridSkeleton />
          )}
        </Reveal>
      </section>

      {/* 9. featured vendor stores */}
      <section aria-label="Featured vendor stores">
        <Reveal>
          <SectionHeader title="Featured Stores" icon={<StoreIcon className="h-5 w-5 text-orange-600" />} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data
              ? data.vendors.map((v) => (
                  <button
                    key={v.id}
                    className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition hover:shadow-md"
                    onClick={() => navigate('vendor', { slug: v.slug })}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
                      {initials(v.logoText, v.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-stone-900">{v.name}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-stone-500">
                        {v.rating > 0 ? (
                          <span className="inline-flex items-center gap-0.5 font-medium text-emerald-700">
                            <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" />
                            {v.rating.toFixed(1)}
                          </span>
                        ) : null}
                        {v.city ? (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" /> {v.city}
                          </span>
                        ) : null}
                      </span>
                      {v.description ? (
                        <span className="mt-1 line-clamp-1 block text-xs text-stone-500">
                          {v.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))
              : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        </Reveal>
      </section>
    </div>
  )
}

function promoScreens(banners: Banner[], onBannerClick: (link: string | null | undefined) => void) {
  if (banners.length === 0) {
    return (
      <>
        <Skeleton className="h-28 rounded-xl sm:h-36" />
        <Skeleton className="h-28 rounded-xl sm:h-36" />
      </>
    )
  }
  return banners.slice(0, 2).map((b) => (
    <div
      key={b.id}
      className="h-28 overflow-hidden rounded-xl border shadow-sm sm:h-36"
      role="link"
      aria-label={b.title}
    >
      <BannerSlide banner={b} />
    </div>
  ))
}

function initials(logoText?: string | null, name?: string): string {
  if (logoText && logoText.trim()) return logoText.trim().slice(0, 2).toUpperCase()
  return (name ?? 'SK')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
