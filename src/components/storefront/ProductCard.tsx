'use client'

import { useEffect, useRef, useState } from 'react'
import { Star, Heart, ShoppingBag, BadgeCheck, Check, Truck } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useAppStore, api } from '@/lib/store'
import { formatINR, discountPercent, parseJson } from '@/lib/format'
import { toast } from 'sonner'

/* ============================ shared types ============================ */

export type ProductCardData = {
  id: string
  title: string
  slug: string
  price: number
  mrp: number
  images: string | null
  rating: number
  reviewCount: number
  badge: string | null
  sponsored: boolean
  stock: number
  sellerType: string
  freeShipping: boolean
  condition?: string | null
  refurbGrade?: string | null
  vendor?: { name: string; slug: string } | null
  brand?: { name: string; slug: string } | null
  category?: { name: string; slug: string } | null
  _count?: { variants: number }
}

/** Human label for a refurb grade (returns null for NEW/unknown). */
export function refurbGradeLabel(grade?: string | null): string | null {
  switch ((grade ?? '').toUpperCase()) {
    case 'EXCELLENT':
      return 'Superb condition'
    case 'GOOD':
      return 'Good condition'
    case 'FAIR':
      return 'Fair condition'
    default:
      return null
  }
}

/* ===================== image helpers (exported) ======================= */

const FALLBACK_EMOJI: Record<string, string> = {
  electronics: '📱',
  mobiles: '📱',
  laptops: '💻',
  'audio-wearables': '🎧',
  fashion: '👗',
  footwear: '👟',
  'mens-clothing': '👔',
  'womens-ethnic': '🥻',
  'home-kitchen': '🏺',
  beauty: '💄',
  grocery: '🛒',
  default: '🛍️',
}

export function emojiFor(categorySlug?: string | null): string {
  return FALLBACK_EMOJI[categorySlug ?? ''] ?? FALLBACK_EMOJI.default
}

/** Parse the JSON-string images field, dropping empty/invalid URLs. */
export function productImages(p: { images?: string | null } & Record<string, unknown>): string[] {
  return parseJson<string[]>(p.images as string | null, []).filter(
    (u) => typeof u === 'string' && u.trim() !== ''
  )
}

/**
 * <img> that fades in once loaded (per-image state; kept key'd by src so a
 * changed URL re-runs the fade). Cached images that finish before React
 * attaches onLoad are handled via the ref complete-check.
 */
function FadeInImg({
  src,
  alt,
  imgClassName = '',
}: {
  src: string
  alt: string
  imgClassName?: string
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      ref={(el) => {
        if (el && el.complete && el.naturalWidth > 0) setLoaded(true)
      }}
      onLoad={() => setLoaded(true)}
      onError={(e) => {
        ;(e.target as HTMLImageElement).style.opacity = '0'
      }}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
        loaded ? 'opacity-100' : 'opacity-0'
      } ${imgClassName}`}
    />
  )
}

/**
 * Product image with graceful placeholder fallback.
 * Renders a warm placeholder (emoji + gradient) behind the <img>; if the URL
 * is missing or fails to load the placeholder stays visible.
 */
export function ProductImg({
  product,
  className = '',
  imgClassName = '',
}: {
  product: { images?: string | null; title?: string; category?: { slug?: string | null } | null }
  className?: string
  imgClassName?: string
}) {
  const urls = productImages(product)
  const url = urls[0] ?? null
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-lg bg-gradient-to-br from-stone-100 via-orange-50 to-amber-50 ${className}`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span className="text-5xl sm:text-6xl select-none" aria-hidden="true">
          {emojiFor(product.category?.slug)}
        </span>
        {product.title ? (
          <span className="max-w-[85%] truncate px-2 text-[11px] font-medium text-stone-400">
            {product.title}
          </span>
        ) : null}
      </div>
      {url ? (
        <FadeInImg key={url} src={url} alt={product.title ?? 'Product image'} imgClassName={imgClassName} />
      ) : null}
    </div>
  )
}

/* ============================ star rating ============================= */

export function Stars({ value, className = 'h-3.5 w-3.5' }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${className} ${
            i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'
          }`}
        />
      ))}
    </span>
  )
}

/* =========================== cart & wishlist ========================== */

export function useAddToCart() {
  const user = useAppStore((s) => s.user)
  const addToGuestCart = useAppStore((s) => s.addToGuestCart)
  const refreshCartCount = useAppStore((s) => s.refreshCartCount)
  const navigate = useAppStore((s) => s.navigate)

  /** Resolves to true when the item landed in the cart, false on failure. */
  async function addToCart(
    p: ProductCardData & Record<string, unknown>,
    qty = 1,
    variant: { id: string; name: string; price: number; stock: number } | null = null
  ): Promise<boolean> {
    const variantId = variant?.id ?? null
    if (!variantId && (p._count?.variants ?? 0) > 0) {
      toast.info('Please choose an option first')
      navigate('product', { slug: p.slug })
      return false
    }
    if (!user) {
      addToGuestCart({
        productId: p.id,
        variantId,
        qty,
        title: p.title,
        slug: p.slug,
        image: productImages(p)[0] ?? null,
        price: variant?.price ?? p.price,
        mrp: p.mrp,
        stock: variant?.stock ?? p.stock,
        variantName: variant?.name ?? null,
        vendorName: p.vendor?.name ?? 'Lastrivon Retail',
        vendorSlug: p.vendor?.slug ?? null,
        shippingFee: 49,
        freeShipping: !!p.freeShipping,
      })
      toast.success('Added to cart', {
        description: p.title,
        action: { label: 'View Cart', onClick: () => navigate('cart') },
      })
      return true
    }
    const r = await api('/api/cart/items', { method: 'POST', json: { productId: p.id, variantId, qty } })
    if (r.ok) {
      refreshCartCount()
      toast.success('Added to cart', {
        description: p.title,
        action: { label: 'View Cart', onClick: () => navigate('cart') },
      })
      return true
    }
    if ((r.error ?? '').toLowerCase().includes('variant')) {
      toast.info('Please choose an option first')
      navigate('product', { slug: p.slug })
      return false
    }
    toast.error(r.error ?? 'Failed to add to cart')
    return false
  }
  return addToCart
}

export function useToggleWishlist() {
  const user = useAppStore((s) => s.user)
  const wishlistIds = useAppStore((s) => s.wishlistIds)
  const setWishlistIds = useAppStore((s) => s.setWishlistIds)
  const navigate = useAppStore((s) => s.navigate)

  async function toggleWishlist(productId: string) {
    if (!user) {
      toast('Login to save items')
      navigate('auth')
      return
    }
    const r = await api<{ wishlisted: boolean }>('/api/wishlist', {
      method: 'POST',
      json: { productId },
    })
    if (r.ok && r.data) {
      const next = r.data.wishlisted
        ? Array.from(new Set([...wishlistIds, productId]))
        : wishlistIds.filter((id) => id !== productId)
      setWishlistIds(next)
      toast.success(r.data.wishlisted ? 'Saved to wishlist' : 'Removed from wishlist')
    } else {
      toast.error(r.error ?? 'Failed to update wishlist')
    }
  }
  return toggleWishlist
}

/* ============================ badge chips ============================= */

const BADGE_STYLES: Record<string, string> = {
  BESTSELLER: 'bg-amber-100 text-amber-800',
  NEW_ARRIVAL: 'bg-emerald-100 text-emerald-800',
  DEAL: 'bg-red-100 text-red-700',
}
const BADGE_LABELS: Record<string, string> = {
  BESTSELLER: 'Bestseller',
  NEW_ARRIVAL: 'New',
  DEAL: 'Deal',
}
/* ============================ ProductCard ============================= */

export default function ProductCard({
  product,
  className = '',
}: {
  product: ProductCardData
  className?: string
}) {
  const navigate = useAppStore((s) => s.navigate)
  const wishlistIds = useAppStore((s) => s.wishlistIds)
  const addToCart = useAddToCart()
  const toggleWishlist = useToggleWishlist()

  /* brief success feedback on the card's button after a successful add */
  const [added, setAdded] = useState(false)
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (addedTimer.current) clearTimeout(addedTimer.current)
    }
  }, [])

  async function handleAddToCart() {
    const ok = await addToCart(product)
    if (!ok) return
    setAdded(true)
    if (addedTimer.current) clearTimeout(addedTimer.current)
    addedTimer.current = setTimeout(() => setAdded(false), 1400)
  }

  const off = discountPercent(product.mrp, product.price)
  const wishlisted = wishlistIds.includes(product.id)
  const outOfStock = product.stock <= 0
  const lowStock = !outOfStock && product.stock <= 5

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${className}`}
    >
      {/* image */}
      <div
        className="relative cursor-pointer"
        onClick={() => navigate('product', { slug: product.slug })}
        role="link"
        aria-label={product.title}
      >
        <ProductImg
          product={product}
          className="rounded-b-none rounded-t-xl"
          imgClassName="transition-transform duration-300 group-hover:scale-[1.04]"
        />

        {/* refurbished chip (teal) — above the badge chip */}
        {product.condition === 'REFURBISHED' ? (
          <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
            <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              ♻ Refurbished
            </span>
            {product.badge && BADGE_STYLES[product.badge] ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BADGE_STYLES[product.badge]}`}
              >
                {BADGE_LABELS[product.badge] ?? product.badge}
              </span>
            ) : null}
          </span>
        ) : product.badge && BADGE_STYLES[product.badge] ? (
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BADGE_STYLES[product.badge]}`}
          >
            {BADGE_LABELS[product.badge] ?? product.badge}
          </span>
        ) : null}

        {/* wishlist heart top-right */}
        <button
          type="button"
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform duration-200 hover:scale-110 active:scale-90"
          onClick={(e) => {
            e.stopPropagation()
            toggleWishlist(product.id)
          }}
        >
          <motion.span
            key={wishlisted ? 'on' : 'off'}
            className="flex h-full w-full items-center justify-center"
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 1.35 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          >
            <Heart
              className={`h-4 w-4 ${wishlisted ? 'fill-red-500 text-red-500' : 'text-stone-500'}`}
            />
          </motion.span>
        </button>

        {/* out of stock overlay */}
        {outOfStock ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-md bg-stone-800 px-3 py-1 text-xs font-semibold text-white">
              Out of stock
            </span>
          </div>
        ) : null}
      </div>

      {/* content */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        {/* rating chip */}
        <div className="flex items-center gap-1">
          {product.rating > 0 && product.reviewCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
              <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" />
              {product.rating.toFixed(1)}
              <span className="font-normal text-emerald-600/70">({product.reviewCount})</span>
            </span>
          ) : (
            <span className="inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-500">
              New
            </span>
          )}
          {lowStock ? (
            <span className="text-[11px] font-medium text-red-600">Only {product.stock} left</span>
          ) : null}
        </div>

        {/* refurb grade line */}
        {product.condition === 'REFURBISHED' ? (
          <span className="w-fit text-[11px] font-medium text-teal-700">
            ♻ {refurbGradeLabel(product.refurbGrade) ?? 'Refurbished'} · Quality checked
          </span>
        ) : null}

        {/* title */}
        <h3
          className="line-clamp-2 cursor-pointer text-sm font-medium leading-snug text-stone-800 hover:text-orange-700"
          onClick={() => navigate('product', { slug: product.slug })}
        >
          {product.title}
        </h3>

        {/* vendor */}
        {product.vendor ? (
          <button
            type="button"
            className="w-fit text-left text-xs text-stone-500 hover:text-orange-700 hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              navigate('vendor', { slug: product.vendor!.slug })
            }}
          >
            by {product.vendor.name}
          </button>
        ) : (
          <span className="inline-flex w-fit items-center gap-1 text-xs text-stone-500">
            by Lastrivon Retail
            <BadgeCheck className="h-3 w-3 text-orange-600" />
          </span>
        )}

        {/* price row */}
        <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
          <span className="text-base font-bold text-stone-900">{formatINR(product.price)}</span>
          {product.mrp > product.price ? (
            <span className="text-xs text-stone-400 line-through">{formatINR(product.mrp)}</span>
          ) : null}
          {off > 0 ? (
            <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[11px] font-bold text-orange-600">
              {off}% off
            </span>
          ) : null}
        </div>

        {/* free delivery mini-line */}
        {product.freeShipping ? (
          <span className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-emerald-700">
            <Truck className="h-3 w-3" />
            Free delivery
          </span>
        ) : null}

        {/* sponsored label — honest, subtle */}
        {product.sponsored ? (
          <span className="w-fit rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-400">
            Sponsored
          </span>
        ) : null}

        <div className="mt-auto pt-2">
          <Button
            size="sm"
            disabled={outOfStock}
            className={`w-full text-white transition-colors ${
              added ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'
            }`}
            onClick={(e) => {
              e.stopPropagation()
              handleAddToCart()
            }}
          >
            {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
            {outOfStock ? 'Out of stock' : added ? '✓ Added' : 'Add to cart'}
          </Button>
        </div>
      </div>
    </div>
  )
}
