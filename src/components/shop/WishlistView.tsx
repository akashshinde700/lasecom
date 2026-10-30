'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAppStore, api } from '@/lib/store'
import { formatINR, discountPercent, parseJson } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/shop/EmptyState'
import { Heart, HeartOff, Loader2, ShoppingBag, Star, Truck } from 'lucide-react'

type WishProduct = {
  id: string
  title: string
  slug: string
  price: number
  mrp: number
  images: string
  rating: number
  reviewCount: number
  stock: number
  freeShipping: boolean
  vendor: { name: string; slug: string } | null
  brand: { name: string; slug: string } | null
}

type WishItem = { id: string; product: WishProduct }

export default function WishlistView() {
  const user = useAppStore((s) => s.user)
  const authLoading = useAppStore((s) => s.authLoading)
  const navigate = useAppStore((s) => s.navigate)
  const params = useAppStore((s) => s.params)
  const refreshCartCount = useAppStore((s) => s.refreshCartCount)

  const [items, setItems] = useState<WishItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  /* Auth gate */
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Please login to view your wishlist')
      navigate('auth', { redirect: params.redirect ?? 'wishlist' })
    }
  }, [authLoading, user, navigate, params.redirect])

  const load = useCallback(() => {
    api<{ items: WishItem[] }>('/api/wishlist').then((res) => {
      if (!res.ok || !res.data) {
        setError(res.error ?? 'Could not load wishlist')
        setItems([])
        return
      }
      setItems(res.data.items)
    })
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const addToCart = async (p: WishProduct) => {
    setAddingId(p.id)
    const res = await api('/api/cart/items', {
      method: 'POST',
      json: { productId: p.id, variantId: null, qty: 1 },
    })
    setAddingId(null)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not add to cart')
      return
    }
    refreshCartCount()
    toast.success(`"${p.title}" added to cart`)
  }

  const removeFromWishlist = async (p: WishProduct) => {
    setRemovingId(p.id)
    const res = await api(`/api/wishlist/${p.id}`, { method: 'DELETE' })
    setRemovingId(null)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not remove item')
      return
    }
    setItems((prev) => prev?.filter((i) => i.product.id !== p.id) ?? prev)
    toast.success('Removed from wishlist')
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="mb-5 h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center gap-2.5">
        <Heart className="h-6 w-6 fill-orange-600 text-orange-600" />
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">My Wishlist</h1>
        {items ? <span className="text-sm font-normal text-stone-400">({items.length} items)</span> : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center">
          <p className="text-sm text-stone-600">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
        </div>
      ) : items === null ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-7 w-7" />}
          title="Your wishlist is empty"
          description="Tap the ♥ on any product to save it here for later."
          actionLabel="Explore Products"
          onAction={() => navigate('home')}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map(({ product: p }) => {
            const image = parseJson<string[]>(p.images, [])[0] ?? null
            const off = discountPercent(p.mrp, p.price)
            const outOfStock = p.stock <= 0
            return (
              <div
                key={p.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <button
                  onClick={() => navigate('product', { slug: p.slug })}
                  className="relative block aspect-square w-full bg-stone-100"
                  aria-label={`View ${p.title}`}
                >
                  {image ? (
                    <img
                      src={image}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-stone-300">
                      <ShoppingBag className="h-8 w-8" />
                    </div>
                  )}
                  {off > 0 ? (
                    <span className="absolute left-2 top-2 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {off}% OFF
                    </span>
                  ) : null}
                  {outOfStock ? (
                    <span className="absolute inset-x-0 bottom-0 bg-stone-900/70 py-1 text-center text-[11px] font-semibold text-white">
                      Out of stock
                    </span>
                  ) : null}
                </button>

                <button
                  onClick={() => removeFromWishlist(p)}
                  disabled={removingId === p.id}
                  aria-label="Remove from wishlist"
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform hover:scale-110"
                >
                  {removingId === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                  ) : (
                    <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                  )}
                </button>

                <div className="flex flex-1 flex-col p-3">
                  <button
                    onClick={() => navigate('product', { slug: p.slug })}
                    className="line-clamp-2 text-left text-xs font-medium leading-snug text-stone-900 hover:text-orange-700"
                  >
                    {p.title}
                  </button>
                  <p className="mt-0.5 truncate text-[11px] text-stone-400">
                    {p.brand?.name ?? p.vendor?.name ?? 'Lastrivon Retail'}
                  </p>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-stone-900">{formatINR(p.price)}</span>
                    {p.mrp > p.price ? (
                      <span className="text-[11px] text-stone-400 line-through">{formatINR(p.mrp)}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px]">
                    {p.rating > 0 ? (
                      <span className="flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                        <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" />
                        {p.rating.toFixed(1)}
                      </span>
                    ) : null}
                    {p.freeShipping ? (
                      <span className="flex items-center gap-0.5 text-emerald-600">
                        <Truck className="h-3 w-3" /> Free
                      </span>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    disabled={outOfStock || addingId === p.id}
                    onClick={() => addToCart(p)}
                    className={cn(
                      'mt-2.5 w-full',
                      outOfStock
                        ? 'cursor-not-allowed bg-stone-100 text-stone-400 hover:bg-stone-100'
                        : 'bg-orange-600 text-white hover:bg-orange-700'
                    )}
                  >
                    {addingId === p.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {outOfStock ? 'Out of stock' : 'Add to Cart'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-stone-400">
        <HeartOff className="h-3.5 w-3.5" /> Tip: items stay in your wishlist until you remove them.
      </div>
    </div>
  )
}
