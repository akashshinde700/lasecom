'use client'

import { useEffect, useState } from 'react'
import { Star, MapPin, ArrowLeft, SearchX, Store } from 'lucide-react'
import { useAppStore, api } from '@/lib/store'
import ProductCard, { type ProductCardData } from './ProductCard'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type VendorData = {
  id: string
  name: string
  slug: string
  logoText: string | null
  bannerUrl: string | null
  description: string | null
  rating: number
  ratingCount: number
  city: string | null
  state: string | null
  createdAt: string
}

function initials(v: VendorData): string {
  if (v.logoText && v.logoText.trim()) return v.logoText.trim().slice(0, 2).toUpperCase()
  return v.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function VendorStore() {
  const navigate = useAppStore((s) => s.navigate)
  const params = useAppStore((s) => s.params)
  const settings = useAppStore((s) => s.settings)
  const siteName = settings?.siteName ?? 'Lastrivon Kart India'

  const slug = params.slug ?? ''
  const [vendor, setVendor] = useState<VendorData | null>(null)
  const [products, setProducts] = useState<ProductCardData[]>([])
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  /* loading is derived: true until the current slug has been fetched */
  const loading = slug !== loadedSlug

  useEffect(() => {
    if (!slug) return
    let alive = true
    api<{ vendor: VendorData; products: ProductCardData[] }>(
      `/api/vendors/${encodeURIComponent(slug)}`
    ).then((r) => {
      if (!alive) return
      if (r.ok && r.data) {
        setVendor(r.data.vendor)
        setProducts(r.data.products ?? [])
        setNotFound(false)
        document.title = `${r.data.vendor.name} - ${siteName}`
      } else {
        setNotFound(true)
      }
      setLoadedSlug(slug)
    })
    return () => {
      alive = false
    }
  }, [slug, siteName])

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <Skeleton className="h-44 w-full rounded-xl sm:h-40" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-3">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (notFound || !vendor) {
    return (
      <div className="container mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-24 text-center">
        <SearchX className="h-12 w-12 text-stone-300" />
        <p className="text-lg font-semibold text-stone-700">Store not found</p>
        <p className="text-sm text-stone-500">This seller may no longer be active on {siteName}.</p>
        <Button
          className="mt-2 bg-orange-600 text-white hover:bg-orange-700"
          onClick={() => navigate('home')}
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-5 sm:py-6">
      <button
        className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-orange-700"
        onClick={() => navigate('home')}
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* hero card */}
      <section
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
        aria-label={`${vendor.name} store`}
      >
        {/* banner strip */}
        <div className="relative h-20 bg-gradient-to-r from-orange-100 via-amber-50 to-orange-50 sm:h-28">
          {vendor.bannerUrl && vendor.bannerUrl.trim() !== '' ? (
            <img
              src={vendor.bannerUrl}
              alt={`${vendor.name} banner`}
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.opacity = '0'
              }}
            />
          ) : null}
        </div>

        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-8 flex items-end gap-4 sm:-mt-10">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-background bg-orange-100 text-lg font-bold text-orange-700 shadow sm:h-20 sm:w-20 sm:text-xl">
              {initials(vendor)}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="truncate text-xl font-bold text-stone-900 sm:text-2xl">{vendor.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
                {vendor.rating > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-bold text-white">
                    {vendor.rating.toFixed(1)}
                    <Star className="h-3 w-3 fill-white" />
                  </span>
                ) : null}
                {vendor.city || vendor.state ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {[vendor.city, vendor.state].filter(Boolean).join(', ')}
                  </span>
                ) : null}
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <Store className="h-3.5 w-3.5" /> Member since {formatDate(vendor.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {vendor.description ? (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-600">
              {vendor.description}
            </p>
          ) : null}
        </div>
      </section>

      {/* products */}
      <section className="mt-8" aria-label="Store products">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-stone-900 sm:text-xl">
            All products <span className="font-normal text-stone-500">({products.length})</span>
          </h2>
          <div className="mt-1.5 h-1 w-10 rounded-full bg-orange-600" />
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
            <Store className="h-10 w-10 text-stone-300" />
            <p className="text-sm font-medium text-stone-600">No products listed yet</p>
            <p className="text-xs text-stone-400">Check back soon — this store is just getting started.</p>
          </div>
        ) : (
          <div
            className={cn(
              'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4',
              products.length === 1 && 'sm:grid-cols-1 lg:grid-cols-2'
            )}
          >
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
