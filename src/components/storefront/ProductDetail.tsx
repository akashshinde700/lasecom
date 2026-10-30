'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Star,
  Heart,
  Truck,
  ShieldCheck,
  RotateCcw,
  Minus,
  Plus,
  ShoppingBag,
  Zap,
  BadgeCheck,
  MapPin,
  ChevronLeft,
  MessageSquarePlus,
  SearchX,
  Recycle,
  Briefcase,
} from 'lucide-react'
import { useAppStore, api } from '@/lib/store'
import { recordRecentlyViewed } from '@/lib/recent'
import ProductCard, {
  Stars,
  productImages,
  useAddToCart,
  useToggleWishlist,
  refurbGradeLabel,
  type ProductCardData,
} from './ProductCard'
import { formatINR, discountPercent, parseJson, formatDate, etaText } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Variant = { id: string; name: string; sku: string; price: number; stock: number }
type Vendor = {
  id: string
  name: string
  slug: string
  logoText: string | null
  rating: number
  ratingCount: number
  city: string | null
  state: string | null
  description: string | null
} | null

type DetailProduct = ProductCardData & {
  description: string | null
  specs: string | null
  soldCount: number
  categoryId: string
  refurbNote: string | null
  variants: Variant[]
  vendor: Vendor
}
type Review = {
  id: string
  rating: number
  title: string | null
  comment: string
  verified: boolean
  createdAt: string
  user: { name: string }
}
type DetailData = {
  product: DetailProduct
  related: ProductCardData[]
  reviews: { items: Review[]; total: number; page: number }
  ratingBreakdown: Record<string, number>
}

const BADGE_STYLES: Record<string, string> = {
  BESTSELLER: 'bg-amber-100 text-amber-800 border-amber-200',
  NEW_ARRIVAL: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  DEAL: 'bg-red-100 text-red-700 border-red-200',
}
const BADGE_LABELS: Record<string, string> = {
  BESTSELLER: 'Bestseller',
  NEW_ARRIVAL: 'New Arrival',
  DEAL: 'Deal of the Day',
}

function initials(name?: string | null, logoText?: string | null): string {
  if (logoText && logoText.trim()) return logoText.trim().slice(0, 2).toUpperCase()
  return (name ?? 'SK')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/* ============================= ProductDetail =========================== */

export default function ProductDetail() {
  const params = useAppStore((s) => s.params)
  const slug = params.slug ?? ''

  /* remount detail view per slug — resets gallery/variant/qty state cleanly */
  return <DetailInner key={slug} slug={slug} />
}

function DetailInner({ slug }: { slug: string }) {
  const navigate = useAppStore((s) => s.navigate)
  const user = useAppStore((s) => s.user)
  const wishlistIds = useAppStore((s) => s.wishlistIds)
  const settings = useAppStore((s) => s.settings)
  const siteName = settings?.siteName ?? 'Lastrivon Kart India'

  const [data, setData] = useState<DetailData | null>(null)
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [activeImg, setActiveImg] = useState(0)
  const [variantId, setVariantId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [adding, setAdding] = useState(false)

  /* review dialog state */
  const [reviewOpen, setReviewOpen] = useState(false)
  const [revRating, setRevRating] = useState(0)
  const [revTitle, setRevTitle] = useState('')
  const [revComment, setRevComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reviewsRef = useRef<HTMLDivElement>(null)
  const addToCart = useAddToCart()
  const toggleWishlist = useToggleWishlist()

  /* loading is derived: true until the current slug has been fetched */
  const loading = slug !== loadedSlug

  const fetchProduct = useCallback(() => {
    if (!slug) return
    api<DetailData>(`/api/products/${encodeURIComponent(slug)}`).then((r) => {
      if (r.ok && r.data) {
        setData(r.data)
        setNotFound(false)
      } else {
        setNotFound(true)
      }
      setLoadedSlug(slug)
    })
  }, [slug])

  useEffect(() => {
    fetchProduct()
  }, [fetchProduct])

  const product = data?.product
  const images = useMemo(() => (product ? productImages(product) : []), [product])
  const variant = useMemo(
    () => product?.variants.find((v) => v.id === variantId) ?? null,
    [product, variantId]
  )
  const isRefurb = product?.condition === 'REFURBISHED'

  const displayPrice = variant?.price ?? product?.price ?? 0
  const displayMrp = product?.mrp ?? 0
  const off = discountPercent(displayMrp, displayPrice)
  const stock = variant?.stock ?? product?.stock ?? 0
  const maxQty = Math.max(1, Math.min(stock, 5))
  const wishlisted = product ? wishlistIds.includes(product.id) : false

  useEffect(() => {
    if (product) document.title = `${product.title} - ${siteName}`
  }, [product, siteName])

  /* track recently viewed (localStorage) — safe read of images via shared helper */
  useEffect(() => {
    if (!product || !loadedSlug) return
    recordRecentlyViewed({
      id: product.id,
      slug: product.slug,
      title: product.title,
      image: productImages(product)[0] ?? null,
      price: product.price,
      mrp: product.mrp,
      rating: product.rating,
      reviewCount: product.reviewCount,
      condition: product.condition ?? 'NEW',
      categorySlug: product.category?.slug ?? null,
    })
  }, [product, loadedSlug])

  async function handleAddToCart(buyNow = false) {
    if (!product || stock <= 0) return
    setAdding(true)
    try {
      await addToCart(product, qty, variant ? { id: variant.id, name: variant.name, price: variant.price, stock: variant.stock } : null)
      if (buyNow) navigate('checkout')
    } finally {
      setAdding(false)
    }
  }

  async function submitReview() {
    if (!product) return
    if (!user) {
      toast('Login to write a review')
      navigate('auth')
      return
    }
    if (revRating < 1) {
      toast.error('Please select a star rating')
      return
    }
    if (!revComment.trim()) {
      toast.error('Please write your review')
      return
    }
    setSubmitting(true)
    const r = await api(`/api/products/${product.id}/reviews`, {
      method: 'POST',
      json: { rating: revRating, title: revTitle.trim() || undefined, comment: revComment.trim() },
    })
    setSubmitting(false)
    if (r.ok) {
      toast.success('Review submitted — thank you!')
      setReviewOpen(false)
      setRevRating(0)
      setRevTitle('')
      setRevComment('')
      fetchProduct()
    } else {
      toast.error(r.error ?? 'Failed to submit review')
    }
  }

  /* ------------------------------ loading / error ------------------------------ */

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-24 w-full" />
            <div className="flex gap-3">
              <Skeleton className="h-12 flex-1" />
              <Skeleton className="h-12 flex-1" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !product) {
    return (
      <div className="container mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-24 text-center">
        <SearchX className="h-12 w-12 text-stone-300" />
        <p className="text-lg font-semibold text-stone-700">Product not found</p>
        <p className="text-sm text-stone-500">It may have been removed or is no longer available.</p>
        <Button
          className="mt-2 bg-orange-600 text-white hover:bg-orange-700"
          onClick={() => navigate('home')}
        >
          <ChevronLeft className="h-4 w-4" /> Back to shopping
        </Button>
      </div>
    )
  }

  const specs = parseJson<[string, string][] | Record<string, string>>(product.specs, [])
  const specRows: [string, string][] = Array.isArray(specs)
    ? specs
    : Object.entries(specs as Record<string, string>)
  const totalReviews = data?.reviews.total ?? 0
  const breakdown = data?.ratingBreakdown ?? {}
  const breakdownTotal = Object.values(breakdown).reduce((s, n) => s + n, 0)

  return (
    <div className="container mx-auto max-w-7xl px-4 py-5 sm:py-6">
      {/* breadcrumb-ish back */}
      <button
        className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-orange-700"
        onClick={() => navigate('home')}
      >
        <ChevronLeft className="h-4 w-4" /> Back to shopping
      </button>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ============ LEFT: gallery ============ */}
        <div>
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border bg-gradient-to-br from-stone-100 via-orange-50 to-amber-50 shadow-sm">
            {images.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <span className="text-7xl select-none sm:text-8xl" aria-hidden="true">
                  🛍️
                </span>
                <span className="max-w-[70%] truncate px-4 text-sm font-medium text-stone-400">
                  {product.title}
                </span>
              </div>
            ) : null}
            {images[activeImg] ? (
              <img
                src={images[activeImg]}
                alt={product.title}
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.opacity = '0'
                }}
              />
            ) : null}
            {product.badge && BADGE_STYLES[product.badge] ? (
              <span
                className={cn(
                  'absolute left-3 top-3 rounded-full border px-2.5 py-1 text-xs font-bold',
                  BADGE_STYLES[product.badge]
                )}
              >
                {BADGE_LABELS[product.badge] ?? product.badge}
              </span>
            ) : null}
          </div>

          {/* thumbnails */}
          {images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((u, i) => (
                <button
                  key={i}
                  className={cn(
                    'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-stone-100 transition',
                    i === activeImg ? 'border-orange-600' : 'border-transparent hover:border-stone-300'
                  )}
                  aria-label={`View image ${i + 1}`}
                  onClick={() => setActiveImg(i)}
                >
                  <img
                    src={u}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.opacity = '0'
                    }}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* ============ RIGHT: info ============ */}
        <div>
          {/* vendor line */}
          {product.vendor ? (
            <button
              className="text-sm font-medium text-orange-700 hover:underline"
              onClick={() => navigate('vendor', { slug: product.vendor!.slug })}
            >
              Visit {product.vendor.name} store
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-stone-500">
              <BadgeCheck className="h-4 w-4 text-orange-600" /> Platform Product
            </span>
          )}

          <h1 className="mt-1 text-xl font-bold leading-snug text-stone-900 sm:text-2xl">
            {product.title}
          </h1>

          {/* refurbished chip under title */}
          {isRefurb ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-2.5 py-1 text-xs font-bold text-white">
                ♻ Refurbished
              </span>
              {product.refurbGrade ? (
                <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                  {refurbGradeLabel(product.refurbGrade)}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* rating + review link */}
          <button
            className="mt-2 flex items-center gap-2"
            onClick={() => reviewsRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            {product.rating > 0 && product.reviewCount > 0 ? (
              <>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-sm font-bold text-white">
                  {product.rating.toFixed(1)}
                  <Star className="h-3.5 w-3.5 fill-white" />
                </span>
                <span className="text-sm text-stone-500 underline">
                  {product.reviewCount} review{product.reviewCount === 1 ? '' : 's'}
                </span>
              </>
            ) : (
              <span className="text-sm text-stone-500 underline">Be the first to review</span>
            )}
          </button>

          <Separator className="my-4" />

          {/* price row */}
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-extrabold text-stone-900">{formatINR(displayPrice)}</span>
            {displayMrp > displayPrice ? (
              <>
                <span className="text-lg text-stone-400 line-through">{formatINR(displayMrp)}</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-sm font-bold text-emerald-700">
                  {off}% off
                </span>
              </>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-stone-500">Inclusive of all taxes</p>

          {/* stock status */}
          <p className="mt-3 text-sm font-semibold">
            {stock <= 0 ? (
              <span className="text-red-600">Out of stock</span>
            ) : stock <= 5 ? (
              <span className="text-amber-600">Only {stock} left — order soon</span>
            ) : (
              <span className="text-emerald-600">In stock</span>
            )}
          </p>

          {/* delivery estimate */}
          {stock > 0 ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-stone-600">
              <Truck className="h-4 w-4 text-orange-600" /> {etaText(2, 5)}
              {product.freeShipping ? <span className="font-medium text-emerald-700">• Free</span> : null}
            </p>
          ) : null}

          {/* variants */}
          {product.variants.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-stone-700">
                Choose an option: <span className="font-normal text-stone-500">{variant?.name}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const selected = v.id === variantId
                  const delta = (v.price ?? product.price) - product.price
                  return (
                    <button
                      key={v.id}
                      disabled={v.stock <= 0}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm transition',
                        v.stock <= 0
                          ? 'cursor-not-allowed border-stone-200 text-stone-300 line-through'
                          : selected
                            ? 'border-orange-600 bg-orange-50 font-semibold text-orange-700'
                            : 'border-stone-300 text-stone-700 hover:border-orange-400'
                      )}
                      onClick={() => {
                        setVariantId(selected ? null : v.id)
                        setQty(1)
                      }}
                    >
                      {v.name}
                      {delta !== 0 && v.stock > 0 ? (
                        <span className="ml-1 text-xs text-stone-500">
                          {delta > 0 ? '+' : '−'}
                          {formatINR(Math.abs(delta))}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* qty stepper + CTAs */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border">
              <button
                className="flex h-11 w-10 items-center justify-center text-stone-600 hover:text-orange-700 disabled:opacity-40"
                disabled={qty <= 1}
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-sm font-semibold" aria-live="polite">
                {qty}
              </span>
              <button
                className="flex h-11 w-10 items-center justify-center text-stone-600 hover:text-orange-700 disabled:opacity-40"
                disabled={qty >= maxQty || stock <= 0}
                aria-label="Increase quantity"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <Button
              variant="outline"
              disabled={stock <= 0 || adding}
              className="h-11 flex-1 border-orange-600 font-semibold text-orange-700 hover:bg-orange-50 hover:text-orange-800 sm:flex-none sm:px-8"
              onClick={() => handleAddToCart(false)}
            >
              <ShoppingBag className="h-4 w-4" /> Add to Cart
            </Button>
            <Button
              disabled={stock <= 0 || adding}
              className="h-11 flex-1 bg-orange-600 font-semibold text-white hover:bg-orange-700 sm:flex-none sm:px-8"
              onClick={() => handleAddToCart(true)}
            >
              <Zap className="h-4 w-4" /> Buy Now
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              onClick={() => toggleWishlist(product.id)}
            >
              <Heart className={cn('h-5 w-5', wishlisted && 'fill-red-500 text-red-500')} />
            </Button>
          </div>

          {/* bulk / B2B quote CTA */}
          <button
            type="button"
            onClick={() => navigate('quote', { productId: product.id, title: product.title })}
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-teal-300 bg-teal-50/70 px-4 py-3 text-left transition-colors hover:bg-teal-50"
          >
            <span className="flex items-center gap-2.5">
              <Briefcase className="size-4 shrink-0 text-teal-700" />
              <span>
                <span className="block text-sm font-semibold text-teal-900">Need this in bulk? Request a quote</span>
                <span className="block text-[11px] text-teal-700">Volume discounts up to 12%+ · GST invoice · response in 24 hrs</span>
              </span>
            </span>
            <span className="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white">Get Quote</span>
          </button>

          {/* trust rows */}
          <div className="mt-5 space-y-2 rounded-xl border bg-card p-4 text-sm text-stone-600 shadow-sm">
            {isRefurb ? (
              <p className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-600" /> Functional refurbished unit — fully tested &amp; quality checked
              </p>
            ) : (
              <p className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-orange-600" /> Genuine product with brand/manufacturer warranty
              </p>
            )}
            <p className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-orange-600" />
              {product.freeShipping
                ? 'Free shipping on this item'
                : `Shipping ${formatINR(settings?.baseShipFee ?? 49)} — free over ${formatINR(settings?.freeShipThreshold ?? 499)}`}
            </p>
            <p className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-orange-600" /> 7-day easy returns
            </p>
          </div>

          {/* refurbished assurance card */}
          {isRefurb ? (
            <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-teal-900">
                <Recycle className="h-4 w-4 text-teal-700" /> About this refurbished product
              </p>
              <ul className="mt-2.5 space-y-1.5 text-sm text-teal-900/80">
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  21-point quality check: display, battery health, camera, ports &amp; full functionality tested
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  {refurbGradeLabel(product.refurbGrade) === 'Superb condition'
                    ? 'Grade: Excellent — minimal to no signs of use, near-new cosmetics'
                    : refurbGradeLabel(product.refurbGrade) === 'Fair condition'
                      ? 'Grade: Fair — visible signs of use, fully functional body & screen'
                      : 'Grade: Good — light signs of use, screen & body in great shape'}
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  {product.refurbNote?.trim()
                    ? product.refurbNote.trim()
                    : 'Comes with essential accessories; covered by Lastrivon refurbished warranty'}
                </li>
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  Renewed at up to 50% lower price — better for your wallet and the planet 🌱
                </li>
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* ============ specs / description / sold-by ============ */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* description */}
          {product.description ? (
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="text-base font-bold text-stone-900">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-700">
                {product.description}
              </p>
            </section>
          ) : null}

          {/* specifications */}
          {specRows.length > 0 ? (
            <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <h2 className="border-b p-5 pb-3 text-base font-bold text-stone-900">Specifications</h2>
              <table className="w-full text-sm">
                <tbody>
                  {specRows.map(([k, v], i) => (
                    <tr key={k} className={cn(i % 2 === 0 ? 'bg-stone-50' : 'bg-card')}>
                      <td className="w-1/3 px-5 py-2.5 font-medium text-stone-600">{k}</td>
                      <td className="px-5 py-2.5 text-stone-800">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </div>

        {/* sold by */}
        <aside>
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-bold text-stone-900">Sold by</h2>
            {product.vendor ? (
              <div className="mt-3 flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
                  {initials(product.vendor.name, product.vendor.logoText)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">{product.vendor.name}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-stone-500">
                    {product.vendor.rating > 0 ? (
                      <span className="inline-flex items-center gap-0.5 font-medium text-emerald-700">
                        <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" />
                        {product.vendor.rating.toFixed(1)}
                        {product.vendor.ratingCount ? ` (${product.vendor.ratingCount})` : ''}
                      </span>
                    ) : null}
                    {product.vendor.city ? (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {product.vendor.city}
                        {product.vendor.state ? `, ${product.vendor.state}` : ''}
                      </span>
                    ) : null}
                  </p>
                  {product.vendor.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-stone-500">{product.vendor.description}</p>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 border-orange-600 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                    onClick={() => navigate('vendor', { slug: product.vendor!.slug })}
                  >
                    Visit Store
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
                  SK
                </span>
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Lastrivon Retail <span className="font-normal text-stone-500">(Platform-owned)</span>
                  </p>
                  <Badge className="mt-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100">
                    <BadgeCheck className="h-3 w-3" /> Platform Product
                  </Badge>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* ============ reviews ============ */}
      <section ref={reviewsRef} className="mt-10 scroll-mt-32" aria-label="Customer reviews">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900 sm:text-xl">Customer Reviews</h2>
            <div className="mt-1.5 h-1 w-10 rounded-full bg-orange-600" />
          </div>
          <Button
            variant="outline"
            className="border-orange-600 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
            onClick={() => {
              if (!user) {
                toast('Login to write a review')
                navigate('auth')
                return
              }
              setReviewOpen(true)
            }}
          >
            <MessageSquarePlus className="h-4 w-4" /> Write a Review
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* summary */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-5xl font-extrabold text-stone-900">
                {product.rating > 0 ? product.rating.toFixed(1) : '—'}
              </span>
              <div>
                <Stars value={product.rating} className="h-4 w-4" />
                <p className="mt-1 text-xs text-stone-500">
                  {totalReviews} rating{totalReviews === 1 ? '' : 's'} & review
                  {totalReviews === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = breakdown[String(star)] ?? 0
                const pct = breakdownTotal > 0 ? Math.round((count / breakdownTotal) * 100) : 0
                return (
                  <div key={star} className="flex items-center gap-2 text-xs text-stone-500">
                    <span className="w-6 shrink-0 text-right">{star}★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 shrink-0">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* review list */}
          <div className="lg:col-span-2">
            {data && data.reviews.items.length > 0 ? (
              <div className="max-h-96 divide-y overflow-y-auto rounded-xl border bg-card shadow-sm">
                {data.reviews.items.map((rv) => (
                  <article key={rv.id} className="p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">
                        {initials(rv.user.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-800">{rv.user.name}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Stars value={rv.rating} className="h-3 w-3" />
                          {rv.verified ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              <BadgeCheck className="h-3 w-3" /> Verified Purchase
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-stone-400">{formatDate(rv.createdAt)}</span>
                    </div>
                    {rv.title ? <p className="mt-2 text-sm font-semibold text-stone-800">{rv.title}</p> : null}
                    <p className="mt-1 text-sm leading-relaxed text-stone-600">{rv.comment}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
                <Star className="h-8 w-8 text-stone-300" />
                <p className="text-sm font-medium text-stone-600">No reviews yet</p>
                <p className="text-xs text-stone-400">Be the first to share your experience.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============ related ============ */}
      {data && data.related.length > 0 ? (
        <section className="mt-12" aria-label="Related products">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-stone-900 sm:text-xl">Related Products</h2>
            <div className="mt-1.5 h-1 w-10 rounded-full bg-orange-600" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {data.related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ============ review dialog ============ */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
            <DialogDescription>{product.title}</DialogDescription>
          </DialogHeader>

          <div>
            <p className="text-sm font-medium text-stone-700">Your rating</p>
            <div className="mt-1.5 flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  aria-label={`${i} star${i > 1 ? 's' : ''}`}
                  className="transition hover:scale-110"
                  onClick={() => setRevRating(i)}
                >
                  <Star
                    className={cn(
                      'h-7 w-7',
                      i <= revRating ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-300'
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="review-title" className="text-sm font-medium text-stone-700">
              Title <span className="font-normal text-stone-400">(optional)</span>
            </label>
            <Input
              id="review-title"
              value={revTitle}
              onChange={(e) => setRevTitle(e.target.value)}
              placeholder="Summarise your experience"
              className="mt-1"
              maxLength={100}
            />
          </div>

          <div>
            <label htmlFor="review-comment" className="text-sm font-medium text-stone-700">
              Review
            </label>
            <Textarea
              id="review-comment"
              value={revComment}
              onChange={(e) => setRevComment(e.target.value)}
              placeholder="What did you like or dislike?"
              rows={4}
              className="mt-1"
              maxLength={1000}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-orange-600 text-white hover:bg-orange-700"
              disabled={submitting}
              onClick={submitReview}
            >
              {submitting ? 'Submitting…' : 'Submit Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
