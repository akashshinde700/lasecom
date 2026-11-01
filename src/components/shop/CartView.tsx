'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore, api } from '@/lib/store'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/shop/EmptyState'
import {
  ShoppingBag,
  Trash2,
  Minus,
  Plus,
  Tag,
  Loader2,
  ArrowRight,
  Truck,
  Store,
  BadgeCheck,
} from 'lucide-react'

export type UnifiedCartItem = {
  key: string
  productId: string
  variantId: string | null
  cartItemId?: string // server cart-item id (logged-in users only)
  qty: number
  title: string
  slug: string
  image: string | null
  price: number
  mrp: number
  stock: number
  variantName: string | null
  vendorName: string
  vendorSlug: string | null
  freeShipping: boolean
}

type ApiCartItem = {
  id: string
  productId: string
  variantId: string | null
  qty: number
  product: {
    id: string
    title: string
    slug: string
    price: number
    mrp: number
    images: string
    stock: number
    freeShipping: boolean
    vendor: { name: string; slug: string } | null
  }
  variant: { id: string; name: string; price: number; stock: number } | null
}

export type AppliedCoupon = { code: string; discount: number; description?: string | null }

/** Shipping per vendor group, mirroring server checkout logic. */
export function groupShippingFees(
  groups: { vendorName: string; subtotal: number; anyFreeShipping: boolean }[],
  freeShipThreshold: number,
  baseShipFee: number
): { perGroup: Record<string, number>; total: number } {
  const perGroup: Record<string, number> = {}
  let total = 0
  for (const g of groups) {
    const fee = g.anyFreeShipping || g.subtotal >= freeShipThreshold ? 0 : baseShipFee
    perGroup[g.vendorName] = fee
    total += fee
  }
  return { perGroup, total: Math.round(total * 100) / 100 }
}

export function itemImage(images: string | null | undefined): string | null {
  if (!images) return null
  try {
    const arr = JSON.parse(images) as string[]
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null
  } catch {
    return null
  }
}

function mapApiCartItem(i: ApiCartItem): UnifiedCartItem {
  const price = i.variant?.price ?? i.product.price
  return {
    key: `${i.productId}:${i.variantId ?? ''}`,
    productId: i.productId,
    variantId: i.variantId,
    cartItemId: i.id,
    qty: i.qty,
    title: i.product.title,
    slug: i.product.slug,
    image: itemImage(i.product.images),
    price,
    mrp: i.product.mrp,
    stock: i.variant?.stock ?? i.product.stock,
    variantName: i.variant?.name ?? null,
    vendorName: i.product.vendor?.name ?? 'Lastrivon Retail',
    vendorSlug: i.product.vendor?.slug ?? null,
    freeShipping: i.product.freeShipping,
  }
}

export function CartItemThumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="aspect-square w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100">
      {src ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-stone-300">
          <ShoppingBag className="h-6 w-6" />
        </div>
      )}
    </div>
  )
}

export default function CartView() {
  const user = useAppStore((s) => s.user)
  const guestCart = useAppStore((s) => s.guestCart)
  const guestCouponCode = useAppStore((s) => s.guestCouponCode)
  const setGuestCouponCode = useAppStore((s) => s.setGuestCouponCode)
  const settings = useAppStore((s) => s.settings)
  const navigate = useAppStore((s) => s.navigate)
  const updateGuestQty = useAppStore((s) => s.updateGuestQty)
  const removeGuestItem = useAppStore((s) => s.removeGuestItem)
  const refreshCartCount = useAppStore((s) => s.refreshCartCount)

  const [serverItems, setServerItems] = useState<UnifiedCartItem[] | null>(null)
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  const [couponInput, setCouponInput] = useState('')
  const [couponBusy, setCouponBusy] = useState(false)

  const threshold = settings?.freeShipThreshold ?? 499
  const baseFee = settings?.baseShipFee ?? 49

  /* Guest cart is derived directly from the persisted store — no fetch needed. */
  const guestItems = useMemo<UnifiedCartItem[]>(
    () =>
      guestCart.map((i) => ({
        key: `${i.productId}:${i.variantId ?? ''}`,
        productId: i.productId,
        variantId: i.variantId ?? null,
        qty: i.qty,
        title: i.title,
        slug: i.slug,
        image: i.image,
        price: i.price,
        mrp: i.mrp,
        stock: i.stock,
        variantName: i.variantName ?? null,
        vendorName: i.vendorName || 'Lastrivon Retail',
        vendorSlug: i.vendorSlug ?? null,
        freeShipping: i.freeShipping,
      })),
    [guestCart]
  )

  const items = user ? serverItems : guestItems

  const load = useCallback(() => {
    api<{ items: ApiCartItem[]; couponCode: string | null }>('/api/cart').then((res) => {
      if (!res.ok || !res.data) {
        setServerItems([])
        return
      }
      setServerItems(res.data.items.map(mapApiCartItem))
      if (res.data.couponCode) {
        setCoupon({ code: res.data.couponCode, discount: 0 })
        const total = res.data.items.reduce(
          (s, i) => s + (i.variant?.price ?? i.product.price) * i.qty,
          0
        )
        api<{ code: string; discount: number; description: string | null }>(
          '/api/coupons/validate',
          { method: 'POST', json: { code: res.data.couponCode, itemsTotal: total } }
        ).then((v) => {
          if (v.ok && v.data) {
            setCoupon({ code: v.data.code, discount: v.data.discount, description: v.data.description })
          }
        })
      } else {
        setCoupon(null)
      }
    })
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  // Re-validate coupon discount whenever the basket value changes (or load persisted guest coupon).
  const itemsTotalRaw = useMemo(
    () => (items ?? []).reduce((s, i) => s + i.price * i.qty, 0),
    [items]
  )
  const activeCouponCode = coupon?.code ?? (!user ? guestCouponCode : null)
  useEffect(() => {
    const code = activeCouponCode
    if (!code || itemsTotalRaw <= 0) return
    let cancelled = false
    api<{ code: string; discount: number; description: string | null }>('/api/coupons/validate', {
      method: 'POST',
      json: { code, itemsTotal: itemsTotalRaw },
    }).then((v) => {
      if (cancelled) return
      if (v.ok && v.data) {
        setCoupon({ code: v.data.code, discount: v.data.discount, description: v.data.description })
      } else {
        setCoupon(null)
        if (!user) setGuestCouponCode(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [activeCouponCode, itemsTotalRaw, user, setGuestCouponCode])

  const groups = useMemo(() => {
    const map = new Map<string, { vendorName: string; subtotal: number; anyFreeShipping: boolean; items: UnifiedCartItem[] }>()
    for (const i of items ?? []) {
      const g = map.get(i.vendorName) ?? { vendorName: i.vendorName, subtotal: 0, anyFreeShipping: false, items: [] }
      g.subtotal += i.price * i.qty
      if (i.freeShipping) g.anyFreeShipping = true
      g.items.push(i)
      map.set(i.vendorName, g)
    }
    return [...map.values()]
  }, [items])

  const shipping = useMemo(
    () => groupShippingFees(groups, threshold, baseFee),
    [groups, threshold, baseFee]
  )

  const discount = coupon ? Math.min(coupon.discount, itemsTotalRaw) : 0
  const grandTotal = Math.max(0, itemsTotalRaw - discount + shipping.total)

  /* Free-shipping progress banner (items subtotal vs threshold). */
  const freeShipPct =
    threshold > 0 ? Math.min(100, Math.round((itemsTotalRaw / threshold) * 100)) : 100
  const qualifiesFreeShip = itemsTotalRaw >= threshold

  const changeQty = async (item: UnifiedCartItem, next: number) => {
    if (next < 1) return
    if (next > item.stock) {
      toast.error(`Only ${item.stock} in stock`)
      return
    }
    if (user && item.cartItemId) {
      setServerItems((prev) => prev?.map((i) => (i.key === item.key ? { ...i, qty: next } : i)) ?? prev)
      const res = await api(`/api/cart/items/${item.cartItemId}`, {
        method: 'PATCH',
        json: { qty: next },
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update quantity')
        load()
      }
      refreshCartCount()
    } else {
      updateGuestQty(item.productId, item.variantId, next)
    }
  }

  const removeItem = async (item: UnifiedCartItem) => {
    if (user && item.cartItemId) {
      setServerItems((prev) => prev?.filter((i) => i.key !== item.key) ?? prev)
      const res = await api(`/api/cart/items/${item.cartItemId}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not remove item')
        load()
      }
      refreshCartCount()
      toast.success('Removed from cart')
    } else {
      removeGuestItem(item.productId, item.variantId)
      toast.success('Removed from cart')
    }
  }

  const applyCoupon = async () => {
    const code = couponInput.trim()
    if (!code) {
      toast.error('Enter a coupon code')
      return
    }
    if (itemsTotalRaw <= 0) {
      toast.error('Add items to your cart first')
      return
    }
    setCouponBusy(true)
    if (user) {
      const res = await api<{ code: string; discount: number; description: string | null }>(
        '/api/cart/coupon',
        { method: 'POST', json: { code } }
      )
      setCouponBusy(false)
      if (!res.ok || !res.data) {
        toast.error(res.error ?? 'Invalid coupon')
        return
      }
      setCoupon({ code: res.data.code, discount: res.data.discount, description: res.data.description })
      toast.success(`Coupon ${res.data.code} applied`)
    } else {
      const res = await api<{ code: string; discount: number; description: string | null }>(
        '/api/coupons/validate',
        { method: 'POST', json: { code, itemsTotal: itemsTotalRaw } }
      )
      setCouponBusy(false)
      if (!res.ok || !res.data) {
        toast.error(res.error ?? 'Invalid coupon')
        return
      }
      setCoupon({ code: res.data.code, discount: res.data.discount, description: res.data.description })
      setGuestCouponCode(res.data.code)
      toast.success(`Coupon ${res.data.code} applied`)
    }
    setCouponInput('')
  }

  const removeCoupon = async () => {
    if (user) {
      await api('/api/cart/coupon', { method: 'DELETE' })
    } else {
      setGuestCouponCode(null)
    }
    setCoupon(null)
    toast.success('Coupon removed')
  }

  if (items === null) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={<ShoppingBag className="h-7 w-7" />}
          title="Your cart is empty"
          description="Browse deals and bestsellers to find something you love."
          actionLabel="Start Shopping"
          onAction={() => navigate('home')}
          secondaryLabel="Today's Deals"
          onSecondary={() => navigate('listing', { badge: 'DEAL' })}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:pb-12">
      <div className="mb-5 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          Shopping Cart <span className="text-base font-normal text-stone-400">({items.reduce((s, i) => s + i.qty, 0)} items)</span>
        </h1>
        <button
          onClick={() => navigate('home')}
          className="hidden text-sm font-medium text-orange-600 hover:text-orange-700 md:block"
        >
          Continue shopping
        </button>
      </div>

      {items.length > 0 && itemsTotalRaw > 0 ? (
        <div
          role="status"
          className={cn(
            'mb-5 rounded-xl border p-3',
            qualifiesFreeShip ? 'border-emerald-200 bg-emerald-50' : 'border-orange-200 bg-orange-50'
          )}
        >
          <div className="flex items-center gap-2.5">
            {qualifiesFreeShip ? (
              <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <Truck className="h-5 w-5 shrink-0 text-orange-600" />
            )}
            <p
              className={cn(
                'text-sm font-medium',
                qualifiesFreeShip ? 'text-emerald-800' : 'text-orange-800'
              )}
            >
              {qualifiesFreeShip
                ? '🎉 Yay! Your order qualifies for FREE delivery'
                : `Add ${formatINR(threshold - itemsTotalRaw)} more for FREE delivery`}
            </p>
          </div>
          <Progress
            value={freeShipPct}
            aria-label="Free delivery progress"
            className={cn(
              'mt-2 h-1.5',
              qualifiesFreeShip
                ? 'bg-emerald-100 [&>div]:bg-emerald-500'
                : 'bg-orange-100 [&>div]:bg-orange-500'
            )}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Items grouped by seller */}
        <div className="space-y-5">
          {groups.map((g) => (
            <Card key={g.vendorName} className="rounded-xl border shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
                  <Store className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-semibold text-stone-800">Sold by {g.vendorName}</span>
                  {shipping.perGroup[g.vendorName] === 0 ? (
                    <span className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <Truck className="h-3.5 w-3.5" /> Free delivery
                    </span>
                  ) : (
                    <span className="ml-auto text-xs text-stone-500">
                      Delivery {formatINR(shipping.perGroup[g.vendorName])}
                    </span>
                  )}
                </div>
                <div className="divide-y divide-stone-100">
                  {g.items.map((item) => (
                    <div key={item.key} className="flex gap-4 p-4">
                      <button
                        onClick={() => navigate('product', { slug: item.slug })}
                        className="shrink-0"
                        aria-label={`View ${item.title}`}
                      >
                        <CartItemThumb src={item.image} alt={item.title} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => navigate('product', { slug: item.slug })}
                          className="line-clamp-2 text-left text-sm font-medium text-stone-900 hover:text-orange-700"
                        >
                          {item.title}
                        </button>
                        {item.variantName ? (
                          <span className="mt-1 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                            {item.variantName}
                          </span>
                        ) : null}
                        <div className="mt-1.5 flex items-baseline gap-2">
                          <span className="text-sm font-bold text-stone-900">{formatINR(item.price)}</span>
                          {item.mrp > item.price ? (
                            <span className="text-xs text-stone-400 line-through">{formatINR(item.mrp)}</span>
                          ) : null}
                        </div>
                        <div className="mt-2.5 flex items-center justify-between">
                          <div className="flex items-center rounded-lg border border-stone-200">
                            <button
                              onClick={() => changeQty(item, item.qty - 1)}
                              disabled={item.qty <= 1}
                              aria-label="Decrease quantity"
                              className="flex h-8 w-8 items-center justify-center rounded-l-lg text-stone-600 hover:bg-stone-50 disabled:opacity-40"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-9 text-center text-sm font-medium">{item.qty}</span>
                            <button
                              onClick={() => changeQty(item, item.qty + 1)}
                              aria-label="Increase quantity"
                              className="flex h-8 w-8 items-center justify-center rounded-r-lg text-stone-600 hover:bg-stone-50"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-stone-900">
                              {formatINR(item.price * item.qty)}
                            </span>
                            <button
                              onClick={() => removeItem(item)}
                              aria-label="Remove item"
                              className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <button
            onClick={() => navigate('home')}
            className="text-sm font-medium text-orange-600 hover:text-orange-700 md:hidden"
          >
            Continue shopping →
          </button>
        </div>

        {/* Coupon + Summary */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-800">
                <Tag className="h-4 w-4 text-orange-600" /> Apply coupon
              </div>
              {coupon ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-bold tracking-wide text-emerald-700">
                        {coupon.code}
                      </span>
                      {coupon.description ? (
                        <p className="mt-1.5 text-xs text-emerald-700">{coupon.description}</p>
                      ) : null}
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter code e.g. SAVE10"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                    className="uppercase"
                  />
                  <Button
                    onClick={applyCoupon}
                    disabled={couponBusy}
                    variant="outline"
                    className="shrink-0 border-orange-600 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                  >
                    {couponBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-stone-800">Price Details</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-stone-600">
                  <span>Items total</span>
                  <span className="font-medium text-stone-900">{formatINR(itemsTotalRaw)}</span>
                </div>
                {discount > 0 ? (
                  <div className="flex justify-between text-emerald-600">
                    <span>Coupon discount ({coupon?.code})</span>
                    <span className="font-medium">−{formatINR(discount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-stone-600">
                  <span>Delivery</span>
                  <span className={cn('font-medium', shipping.total === 0 ? 'text-emerald-600' : 'text-stone-900')}>
                    {shipping.total === 0 ? 'FREE' : formatINR(shipping.total)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold text-stone-900">
                  <span>Grand Total</span>
                  <span>{formatINR(grandTotal)}</span>
                </div>
              </div>
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                🚚 Free delivery on orders over {formatINR(threshold)}
              </p>
              <Button
                onClick={() => navigate('checkout')}
                className="mt-4 hidden w-full bg-orange-600 text-white hover:bg-orange-700 md:flex"
              >
                Proceed to Checkout {formatINR(grandTotal)}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-stone-900">{formatINR(grandTotal)}</p>
            {discount > 0 ? (
              <p className="text-xs text-emerald-600">You save {formatINR(discount)}</p>
            ) : (
              <p className="text-xs text-stone-400">Inclusive of all fees</p>
            )}
          </div>
          <Button
            onClick={() => navigate('checkout')}
            className="bg-orange-600 px-6 text-white hover:bg-orange-700"
          >
            Proceed to Checkout <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
