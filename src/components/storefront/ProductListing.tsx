'use client'

import { useEffect, useMemo, useState } from 'react'
import { SearchX, SlidersHorizontal, Star, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore, api } from '@/lib/store'
import ProductCard, { type ProductCardData } from './ProductCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Cat = { id: string; name: string; slug: string; children?: Cat[] }
type Brand = { id: string; name: string; slug: string }
type ListData = { items: ProductCardData[]; total: number; page: number; limit: number; pages: number }

const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Rating' },
] as const

const PAGE_SIZE = 12

/* ============================== filters =============================== */

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">{title}</p>
      {children}
    </div>
  )
}

function FiltersContent({
  categories,
  brands,
  category,
  brand,
  onCategory,
  onBrand,
  condition,
  onCondition,
  minInput,
  maxInput,
  setMinInput,
  setMaxInput,
  applyPrice,
  rating,
  onRating,
  inStock,
  onInStock,
  clearAll,
}: {
  categories: Cat[]
  brands: Brand[]
  category: string
  brand: string
  onCategory: (slug: string) => void
  onBrand: (slug: string) => void
  condition: string
  onCondition: (c: string) => void
  minInput: string
  maxInput: string
  setMinInput: (v: string) => void
  setMaxInput: (v: string) => void
  applyPrice: () => void
  rating: number | null
  onRating: (r: number | null) => void
  inStock: boolean
  onInStock: (v: boolean) => void
  clearAll: () => void
}) {
  return (
    <div className="space-y-5">
      <FilterSection title="Category">
        <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
          {categories.map((c) => (
            <div key={c.id}>
              <button
                className={cn(
                  'block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-orange-50',
                  category === c.slug ? 'font-semibold text-orange-700' : 'text-stone-700'
                )}
                onClick={() => onCategory(c.slug)}
              >
                {c.name}
              </button>
              {c.children?.length ? (
                <div className="ml-3 border-l border-stone-200 pl-2">
                  {c.children.map((ch) => (
                    <button
                      key={ch.id}
                      className={cn(
                        'block w-full rounded-md px-2 py-1 text-left text-xs hover:bg-orange-50',
                        category === ch.slug ? 'font-semibold text-orange-700' : 'text-stone-500'
                      )}
                      onClick={() => onCategory(ch.slug)}
                    >
                      {ch.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </FilterSection>

      <Separator />

      <FilterSection title="Brands">
        <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
          {brands.map((b) => (
            <label
              key={b.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm text-stone-700 hover:text-orange-700"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-orange-600"
                checked={brand === b.slug}
                onChange={() => onBrand(b.slug)}
              />
              {b.name}
            </label>
          ))}
        </div>
      </FilterSection>

      <Separator />

      <FilterSection title="Condition">
        <div className="space-y-1">
          {[
            { value: '', label: 'All' },
            { value: 'NEW', label: 'Brand New' },
            { value: 'REFURBISHED', label: '♻ Refurbished (Renewed)' },
          ].map((opt) => (
            <label
              key={opt.value || 'all'}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm text-stone-700 hover:text-orange-700"
            >
              <input
                type="radio"
                name="condition"
                className="h-4 w-4 accent-orange-600"
                checked={condition === opt.value}
                onChange={() => onCondition(condition === opt.value ? '' : opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </FilterSection>

      <Separator />

      <FilterSection title="Price (₹)">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Min"
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            className="h-9 text-sm"
            aria-label="Minimum price"
          />
          <span className="text-stone-400">–</span>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            className="h-9 text-sm"
            aria-label="Maximum price"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full border-orange-600 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
          onClick={applyPrice}
        >
          Apply
        </Button>
      </FilterSection>

      <Separator />

      <FilterSection title="Customer Rating">
        <div className="space-y-1">
          {[4, 3, 2].map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm text-stone-700 hover:text-orange-700"
            >
              <input
                type="radio"
                name="rating"
                className="h-4 w-4 accent-orange-600"
                checked={rating === r}
                onChange={() => onRating(rating === r ? null : r)}
              />
              <span className="inline-flex items-center gap-1">
                {r}
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> & above
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      <Separator />

      <FilterSection title="Availability">
        <label className="flex items-center justify-between text-sm text-stone-700">
          In stock only
          <Switch checked={inStock} onCheckedChange={onInStock} />
        </label>
      </FilterSection>

      <Separator />

      <Button variant="outline" className="w-full" onClick={clearAll}>
        Clear all filters
      </Button>
    </div>
  )
}

/* ============================ ProductListing ========================== */

export default function ProductListing() {
  const params = useAppStore((s) => s.params)

  /* remount the listing whenever the entry params change — this resets all
     filter state cleanly without setState-in-effect cycles */
  const paramsKey = JSON.stringify([
    params.search,
    params.category,
    params.badge,
    params.vendor,
    params.sponsored,
    params.condition,
  ])

  return (
    <ListingInner
      key={paramsKey}
      search0={params.search ?? ''}
      category0={params.category ?? ''}
      badge0={params.badge ?? ''}
      vendor0={params.vendor ?? ''}
      sponsored0={params.sponsored === 'true'}
      condition0={params.condition ?? ''}
    />
  )
}

function ListingInner({
  search0,
  category0,
  badge0,
  vendor0,
  sponsored0,
  condition0,
}: {
  search0: string
  category0: string
  badge0: string
  vendor0: string
  sponsored0: boolean
  condition0: string
}) {
  const navigate = useAppStore((s) => s.navigate)
  const settings = useAppStore((s) => s.settings)
  const siteName = settings?.siteName ?? 'Lastrivon Kart India'

  const [categories, setCategories] = useState<Cat[]>([])
  const [brands, setBrands] = useState<Brand[]>([])

  /* filters (initialized from view params) */
  const [search, setSearch] = useState(search0)
  const [category, setCategory] = useState(category0)
  const [brand, setBrand] = useState('')
  const [badge, setBadge] = useState(badge0)
  const [condition, setCondition] = useState(
    condition0.toUpperCase() === 'REFURBISHED' ? 'REFURBISHED' : condition0.toUpperCase() === 'NEW' ? 'NEW' : ''
  )
  const [vendor] = useState(vendor0)
  const [min, setMin] = useState<number | null>(null)
  const [max, setMax] = useState<number | null>(null)
  const [minInput, setMinInput] = useState('')
  const [maxInput, setMaxInput] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [inStock, setInStock] = useState(false)
  const [sort, setSort] = useState<string>('relevance')
  const [page, setPage] = useState(1)

  const [data, setData] = useState<ListData | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  /* load filter sources once */
  useEffect(() => {
    api<Cat[]>('/api/categories').then((r) => {
      if (r.ok && r.data) setCategories(r.data)
    })
    api<Brand[]>('/api/brands').then((r) => {
      if (r.ok && r.data) setBrands(r.data)
    })
  }, [])

  /* build query + fetch (loading is derived: true until current query resolved) */
  const query = useMemo(() => {
    const qs = new URLSearchParams()
    if (search) qs.set('search', search)
    if (category) qs.set('category', category)
    if (brand) qs.set('brand', brand)
    if (badge) qs.set('badge', badge)
    if (condition) qs.set('condition', condition)
    if (vendor) qs.set('vendor', vendor)
    if (min !== null) qs.set('min', String(min))
    if (max !== null) qs.set('max', String(max))
    if (rating !== null) qs.set('rating', String(rating))
    if (sponsored0) qs.set('sponsored', 'true')
    qs.set('sort', sort)
    qs.set('page', String(page))
    qs.set('limit', String(PAGE_SIZE))
    return qs.toString()
  }, [search, category, brand, badge, condition, vendor, min, max, rating, sponsored0, sort, page])

  const [loadedQuery, setLoadedQuery] = useState<string | null>(null)
  const loading = query !== loadedQuery

  useEffect(() => {
    let alive = true
    api<ListData>(`/api/products?${query}`).then((r) => {
      if (!alive) return
      if (r.ok && r.data) setData(r.data)
      else setData({ items: [], total: 0, page: 1, limit: PAGE_SIZE, pages: 1 })
      setLoadedQuery(query)
    })
    return () => {
      alive = false
    }
  }, [query])

  /* document title */
  useEffect(() => {
    const catName = categories.find((c) => c.slug === category || c.children?.some((ch) => ch.slug === category))?.name
    let title = 'All Products'
    if (badge === 'DEAL') title = 'Deals of the Day'
    else if (badge === 'BESTSELLER') title = 'Best Sellers'
    else if (badge === 'NEW_ARRIVAL') title = 'New Arrivals'
    else if (condition === 'REFURBISHED') title = 'Renewed & Refurbished'
    else if (condition === 'NEW') title = 'Brand New Products'
    if (category && catName) title = catName
    if (search) title = `Search: ${search}`
    document.title = `${title} - ${siteName}`
  }, [badge, condition, category, search, categories, siteName])

  /* scroll to top on page change */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  const visibleItems = useMemo(() => {
    const items = data?.items ?? []
    return inStock ? items.filter((i) => i.stock > 0) : items
  }, [data, inStock])

  const catNameOf = (slug: string) =>
    categories.find((c) => c.slug === slug)?.name ??
    categories.find((c) => c.children?.some((ch) => ch.slug === slug))?.children?.find((ch) => ch.slug === slug)
      ?.name ??
    slug
  const brandNameOf = (slug: string) => brands.find((b) => b.slug === slug)?.name ?? slug

  const activeChips: { key: string; label: string; clear: () => void }[] = []
  if (search)
    activeChips.push({ key: 'search', label: `"${search}"`, clear: () => { setSearch(''); setPage(1); navigate('listing', {}) } })
  if (category)
    activeChips.push({ key: 'category', label: catNameOf(category), clear: () => { setCategory(''); setPage(1) } })
  if (brand) activeChips.push({ key: 'brand', label: brandNameOf(brand), clear: () => { setBrand(''); setPage(1) } })
  if (badge) activeChips.push({ key: 'badge', label: badge === 'NEW_ARRIVAL' ? 'New' : badge === 'BESTSELLER' ? 'Bestseller' : 'Deals', clear: () => { setBadge(''); setPage(1) } })
  if (condition)
    activeChips.push({
      key: 'condition',
      label: condition === 'REFURBISHED' ? 'Refurbished' : 'Brand New',
      clear: () => { setCondition(''); setPage(1) },
    })
  if (min !== null || max !== null)
    activeChips.push({
      key: 'price',
      label: `₹${min ?? 0} – ₹${max ?? '∞'}`,
      clear: () => { setMin(null); setMax(null); setMinInput(''); setMaxInput(''); setPage(1) },
    })
  if (rating !== null)
    activeChips.push({ key: 'rating', label: `${rating}★ & above`, clear: () => { setRating(null); setPage(1) } })
  if (inStock) activeChips.push({ key: 'stock', label: 'In stock only', clear: () => { setInStock(false); setPage(1) } })

  function clearAllFilters() {
    setCategory('')
    setBrand('')
    setBadge('')
    setCondition('')
    setMin(null)
    setMax(null)
    setMinInput('')
    setMaxInput('')
    setRating(null)
    setInStock(false)
    setPage(1)
  }

  const total = data?.total ?? 0
  const pages = data?.pages ?? 1
  const title =
    badge === 'DEAL'
      ? 'Deals of the Day'
      : badge === 'BESTSELLER'
        ? 'Best Sellers'
        : badge === 'NEW_ARRIVAL'
          ? 'New Arrivals'
          : condition === 'REFURBISHED'
            ? 'Renewed & Refurbished'
            : condition === 'NEW'
              ? 'Brand New Products'
              : search
                ? `Results for "${search}"`
                : category
                  ? catNameOf(category)
                  : 'All Products'

  return (
    <div className="container mx-auto max-w-7xl px-4 py-5 sm:py-6">
      <div className="flex gap-6">
        {/* sidebar (desktop) */}
        <aside className="hidden w-64 shrink-0 lg:block" aria-label="Product filters">
          <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto rounded-xl border bg-card p-4 shadow-sm">
            <FiltersContent
              categories={categories}
              brands={brands}
              category={category}
              brand={brand}
              onCategory={(slug) => { setCategory(category === slug ? '' : slug); setPage(1) }}
              onBrand={(slug) => { setBrand(brand === slug ? '' : slug); setPage(1) }}
              condition={condition}
              onCondition={(c) => { setCondition(c); setPage(1) }}
              minInput={minInput}
              maxInput={maxInput}
              setMinInput={setMinInput}
              setMaxInput={setMaxInput}
              applyPrice={() => {
                const mn = parseFloat(minInput)
                const mx = parseFloat(maxInput)
                setMin(isNaN(mn) ? null : mn)
                setMax(isNaN(mx) ? null : mx)
                setPage(1)
              }}
              rating={rating}
              onRating={(r) => { setRating(r); setPage(1) }}
              inStock={inStock}
              onInStock={(v) => { setInStock(v); setPage(1) }}
              clearAll={clearAllFilters}
            />
          </div>
        </aside>

        {/* main */}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">{title}</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {loading ? 'Loading…' : `${total} product${total === 1 ? '' : 's'} found`}
          </p>

          {/* top bar */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* mobile filters */}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal className="h-4 w-4" /> Filters
                  {activeChips.length > 0 ? (
                    <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-600 text-[10px] font-bold text-white">
                      {activeChips.length}
                    </span>
                  ) : null}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-6">
                  <FiltersContent
                    categories={categories}
                    brands={brands}
                    category={category}
                    brand={brand}
                    onCategory={(slug) => { setCategory(category === slug ? '' : slug); setPage(1) }}
                    onBrand={(slug) => { setBrand(brand === slug ? '' : slug); setPage(1) }}
                    condition={condition}
                    onCondition={(c) => { setCondition(c); setPage(1) }}
                    minInput={minInput}
                    maxInput={maxInput}
                    setMinInput={setMinInput}
                    setMaxInput={setMaxInput}
                    applyPrice={() => {
                      const mn = parseFloat(minInput)
                      const mx = parseFloat(maxInput)
                      setMin(isNaN(mn) ? null : mn)
                      setMax(isNaN(mx) ? null : mx)
                      setPage(1)
                    }}
                    rating={rating}
                    onRating={(r) => { setRating(r); setPage(1) }}
                    inStock={inStock}
                    onInStock={(v) => { setInStock(v); setPage(1) }}
                    clearAll={() => { clearAllFilters(); setFiltersOpen(false) }}
                  />
                </div>
              </SheetContent>
            </Sheet>

            {/* sort */}
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-sm text-stone-500 sm:inline">Sort by</span>
              <Select
                value={sort}
                onValueChange={(v) => { setSort(v); setPage(1) }}
              >
                <SelectTrigger className="h-9 w-[170px] text-sm" aria-label="Sort products">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* active filter chips */}
          {activeChips.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {activeChips.map((c) => (
                <Badge
                  key={c.key}
                  variant="outline"
                  className="flex items-center gap-1 border-stone-300 bg-stone-50 py-1 pl-2.5 pr-1 text-xs font-normal text-stone-700"
                >
                  {c.label}
                  <button
                    aria-label={`Remove filter ${c.label}`}
                    className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-stone-200"
                    onClick={c.clear}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <button className="ml-1 text-xs font-medium text-orange-700 hover:underline" onClick={clearAllFilters}>
                Clear all
              </button>
            </div>
          ) : null}

          {/* grid */}
          {loading ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div key={i} className="space-y-2 rounded-xl border p-3">
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-8 w-full rounded-md" />
                </div>
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
              <SearchX className="h-12 w-12 text-stone-300" />
              <p className="text-lg font-semibold text-stone-700">No products found</p>
              <p className="max-w-sm text-sm text-stone-500">
                Try adjusting your filters or search for something else.
              </p>
              <Button
                className="mt-2 bg-orange-600 text-white hover:bg-orange-700"
                onClick={() => { clearAllFilters(); if (search) navigate('listing', {}) }}
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {visibleItems.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {/* pagination */}
          {!loading && pages > 1 ? (
            <div className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
              <Button
                variant="outline"
                size="icon"
                disabled={page <= 1}
                aria-label="Previous page"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {pageNumbers(page, pages).map((n, i) =>
                n === '…' ? (
                  <span key={`e${i}`} className="px-1.5 text-stone-400">
                    …
                  </span>
                ) : (
                  <Button
                    key={n}
                    variant={n === page ? 'default' : 'outline'}
                    size="icon"
                    className={n === page ? 'bg-orange-600 text-white hover:bg-orange-700' : ''}
                    aria-label={`Page ${n}`}
                    aria-current={n === page ? 'page' : undefined}
                    onClick={() => setPage(n as number)}
                  >
                    {n}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="icon"
                disabled={page >= pages}
                aria-label="Next page"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < total - 1) out.push('…')
  out.push(total)
  return out
}
