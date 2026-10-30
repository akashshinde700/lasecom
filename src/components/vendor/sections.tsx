'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, useAppStore } from '@/lib/store'
import { formatINR, formatINR2, formatDate, formatDateTime, statusColor } from '@/lib/format'
import { toast } from 'sonner'
import { openDocument } from '@/lib/documents'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  IndianRupee,
  MoreHorizontal,
  Package,
  PackagePlus,
  PackageX,
  Pencil,
  Percent,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Star,
  Store as StoreIcon,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import {
  AdjustStockDialog,
  EmptyState,
  ProductFormDialog,
  ProductThumb,
  SectionError,
  StatusChip,
  StockChip,
  firstImage,
  humanStatus,
  type BrandOption,
  type CategoryOption,
  type VendorProduct,
} from './forms'

// ============================================================
// Types
// ============================================================

export type VendorDashboard = {
  vendor: {
    name: string
    status: string
    slug: string
    rating: number
    plan: { id: string; name: string; priceMonthly: number; listingLimit: number } | null
  }
  stats: {
    totalSales: number
    totalOrders: number
    pendingOrders: number
    processingOrders: number
    shippedOrders: number
    deliveredOrders: number
    cancelledOrders: number
    netEarnings: number
    commissionPaid: number
    pendingSettlement: number
    totalProducts: number
    lowStock: { id: string; title: string; stock: number }[]
    rating: number
  }
  salesByDay: { date: string; sales: number }[]
  topProducts: { title: string; soldCount: number; revenue: number }[]
}

type ProductsResp = { items: VendorProduct[]; total: number; page: number; pages: number }

type VendorOrder = {
  subOrderId: string
  orderNumber: string
  orderId: string
  status: string
  itemsTotal: number
  shippingFee: number
  vendorEarning: number
  courierName: string | null
  trackingNumber: string | null
  createdAt: string
  customer: { name: string; city: string; state: string }
  items: {
    id: string
    titleSnapshot: string
    imageSnapshot: string | null
    variantName: string | null
    qty: number
    unitPrice: number
    status: string
  }[]
}

type OrdersResp = { items: VendorOrder[]; total: number; page: number; pages: number }

type VendorReturn = {
  id: string
  status: string
  reason: string
  comment: string | null
  refundAmount: number | null
  createdAt: string
  orderItem: {
    id: string
    titleSnapshot: string
    imageSnapshot: string | null
    qty: number
    effectiveTotal: number
    itemStatus: string
    orderNumber: string
    customer: string
  }
}

type FinanceData = {
  balance: number
  lifetimeEarnings: number
  commissionPaid: number
  settlements: { id: string; amount: number; status: string; reference: string; createdAt: string }[]
  ledger: { id: string; type: string; direction: string; amount: number; notes: string | null; settled: boolean; createdAt: string }[]
}

type StaffMember = { id: string; name: string; email: string; staffRole: string; createdAt: string }

// ============================================================
// Dashboard
// ============================================================

function KpiCard({
  icon: Icon,
  tint,
  label,
  value,
}: {
  icon: LucideIcon
  tint: string
  label: string
  value: string
}) {
  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tint)}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-stone-500">{label}</p>
          <p className="truncate text-lg font-semibold text-stone-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardSection({
  data,
  loading,
  error,
  onRetry,
  onGotoProducts,
  readOnly,
}: {
  data: VendorDashboard | null
  loading: boolean
  error: string
  onRetry: () => void
  onGotoProducts: () => void
  readOnly: boolean
}) {
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-44" />
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }
  if (error && !data) return <SectionError message={error} onRetry={onRetry} />
  if (!data) return null

  const s = data.stats
  const kpis: { icon: LucideIcon; tint: string; label: string; value: string }[] = [
    { icon: IndianRupee, tint: 'bg-orange-100 text-orange-600', label: 'Total Sales', value: formatINR(s.totalSales) },
    { icon: Wallet, tint: 'bg-emerald-100 text-emerald-600', label: 'Net Earnings', value: formatINR(s.netEarnings) },
    { icon: Percent, tint: 'bg-rose-100 text-rose-600', label: 'Commission Paid', value: formatINR(s.commissionPaid) },
    { icon: Clock, tint: 'bg-amber-100 text-amber-600', label: 'Pending Settlement', value: formatINR(s.pendingSettlement) },
    { icon: ShoppingCart, tint: 'bg-violet-100 text-violet-600', label: 'Total Orders', value: String(s.totalOrders) },
    { icon: Package, tint: 'bg-stone-200 text-stone-600', label: 'Products', value: String(s.totalProducts) },
    { icon: Star, tint: 'bg-amber-100 text-amber-600', label: 'Rating', value: s.rating > 0 ? s.rating.toFixed(1) : 'New' },
    { icon: CheckCircle2, tint: 'bg-emerald-100 text-emerald-600', label: 'Delivered', value: String(s.deliveredOrders) },
  ]

  const statusChips = [
    { label: 'Pending', count: s.pendingOrders, dot: 'bg-amber-500' },
    { label: 'Processing', count: s.processingOrders, dot: 'bg-sky-500' },
    { label: 'Shipped', count: s.shippedOrders, dot: 'bg-violet-500' },
    { label: 'Delivered', count: s.deliveredOrders, dot: 'bg-emerald-500' },
    { label: 'Cancelled', count: s.cancelledOrders, dot: 'bg-red-500' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Dashboard</h1>
        <p className="text-sm text-stone-500">How {data.vendor.name} is performing right now.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} icon={k.icon} tint={k.tint} label={k.label} value={k.value} />
        ))}
      </div>

      <Card className="rounded-xl border shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-stone-400">Orders by status</span>
          {statusChips.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs font-medium text-stone-600"
            >
              <span className={cn('h-2 w-2 rounded-full', c.dot)} aria-hidden />
              {c.label}
              <span className="font-semibold text-stone-900">{c.count}</span>
            </span>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl border shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Last 14 days sales</CardTitle>
            <CardDescription>Order value received per day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.salesByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip
                    formatter={(value) => formatINR(Number(value))}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#ea580c" strokeWidth={2} fill="#ffedd5" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top products</CardTitle>
            <CardDescription>Best sellers by units sold</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <EmptyState icon={Package} title="No sales yet" hint="Your best sellers will appear here once orders start rolling in." />
            ) : (
              <ul className="max-h-72 space-y-3 overflow-y-auto pr-2">
                {data.topProducts.map((p, i) => (
                  <li key={p.title} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-800">{p.title}</p>
                      <p className="text-xs text-stone-400">{p.soldCount} sold</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-stone-900">{formatINR(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden /> Low stock alerts
          </CardTitle>
          <CardDescription>Products at or below their low-stock threshold</CardDescription>
        </CardHeader>
        <CardContent>
          {s.lowStock.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All stocked up"
              hint="No products are running low right now."
            />
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto pr-2">
              {s.lowStock.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-lg border bg-stone-50/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-800">{p.title}</p>
                    <Badge className="mt-1 border-transparent bg-red-100 text-red-700">{p.stock} left</Badge>
                  </div>
                  {!readOnly && (
                    <Button variant="outline" size="sm" onClick={onGotoProducts}>
                      Adjust <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Products
// ============================================================

type CatNode = { id: string; name: string; children?: { id: string; name: string }[] }

const PRODUCT_STATUSES = ['ALL', 'ACTIVE', 'PENDING_REVIEW', 'DRAFT', 'ARCHIVED', 'REJECTED']
const PRODUCT_STATUS_LABELS: Record<string, string> = {
  ALL: 'All statuses',
  ACTIVE: 'Active',
  PENDING_REVIEW: 'Pending review',
  DRAFT: 'Draft',
  ARCHIVED: 'Archived',
  REJECTED: 'Rejected',
}

export function ProductsSection({
  dash,
  readOnly,
  onDashChanged,
}: {
  dash: VendorDashboard | null
  readOnly: boolean
  onDashChanged: () => void
}) {
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ProductsResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<VendorProduct | null>(null)
  const [stockTarget, setStockTarget] = useState<VendorProduct | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<VendorProduct | null>(null)

  const refetch = useCallback(() => {
    const q = new URLSearchParams({ page: String(page) })
    if (search.trim()) q.set('search', search.trim())
    if (status !== 'ALL') q.set('status', status)
    api<ProductsResp>(`/api/vendor/products?${q.toString()}`).then((res) => {
      if (res.ok && res.data) {
        setData(res.data)
        setError('')
      } else {
        setError(res.error ?? 'Failed to load products')
      }
      setLoading(false)
    })
  }, [page, search, status])

  useEffect(() => {
    const t = setTimeout(refetch, 250)
    return () => clearTimeout(t)
  }, [refetch])

  useEffect(() => {
    api<CatNode[]>('/api/categories').then((res) => {
      if (res.ok && Array.isArray(res.data)) {
        const flat: CategoryOption[] = []
        for (const p of res.data) {
          flat.push({ id: p.id, label: p.name })
          for (const c of p.children ?? []) flat.push({ id: c.id, label: `${p.name} › ${c.name}` })
        }
        setCategories(flat)
      }
    })
    api<{ id: string; name: string }[]>('/api/brands').then((res) => {
      if (res.ok && Array.isArray(res.data)) setBrands(res.data)
    })
  }, [])

  function afterMutate() {
    refetch()
    onDashChanged()
  }

  function onSearchInput(v: string) {
    setSearchText(v)
    setSearch(v)
    setPage(1)
    setLoading(true)
  }
  function onStatusChange(v: string) {
    setStatus(v)
    setPage(1)
    setLoading(true)
  }
  function gotoPage(p: number) {
    setPage(p)
    setLoading(true)
  }

  async function doArchive(p: VendorProduct) {
    setArchiveTarget(null)
    const res = await api(`/api/vendor/products/${p.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(`"${p.title}" archived`)
      afterMutate()
    } else {
      toast.error(res.error ?? 'Could not archive product')
    }
  }

  const plan = dash?.vendor.plan ?? null
  const used = dash?.stats.totalProducts ?? 0

  const items = data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Products</h1>
          <p className="text-sm text-stone-500">Manage your listings, pricing and inventory.</p>
        </div>
        {!readOnly && (
          <Button
            className="bg-orange-600 text-white hover:bg-orange-700"
            onClick={() => {
              setEditProduct(null)
              setFormOpen(true)
            }}
          >
            <Plus /> Add Product
          </Button>
        )}
      </div>

      {/* Plan usage */}
      {plan && (
        <div className="flex flex-col gap-2 text-sm text-stone-500 sm:flex-row sm:items-center sm:gap-3">
          <span>
            <span className="font-semibold text-stone-700">
              {used}
              {plan.listingLimit >= 0 ? ` / ${plan.listingLimit}` : ''}
            </span>{' '}
            listings used · Plan: <span className="font-semibold text-stone-700">{plan.name}</span>
            {plan.listingLimit === -1 ? ' · Unlimited listings' : ''}
          </span>
          {plan.listingLimit > 0 && (
            <Progress value={Math.min(100, (used / plan.listingLimit) * 100)} className="h-2 sm:w-48" aria-label="Listing usage" />
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <Input
            value={searchText}
            onChange={(e) => onSearchInput(e.target.value)}
            placeholder="Search products…"
            className="pl-9"
            aria-label="Search products"
          />
        </div>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PRODUCT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && data ? (
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> {error}
        </p>
      ) : null}

      {/* Content */}
      {loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : error && !data ? (
        <SectionError message={error} onRetry={refetch} />
      ) : items.length === 0 ? (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-0">
            <EmptyState
              icon={PackageX}
              title="No products found"
              hint={
                search || status !== 'ALL'
                  ? 'Try a different search or clear the status filter.'
                  : 'Add your first product to start selling on Lastrivon Kart.'
              }
            >
              {!readOnly && !search && status === 'ALL' && (
                <Button
                  className="bg-orange-600 text-white hover:bg-orange-700"
                  onClick={() => {
                    setEditProduct(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus /> Add Product
                </Button>
              )}
            </EmptyState>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden rounded-xl border py-0 shadow-sm md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sold</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="w-10 pr-4" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-[280px] pl-4">
                      <div className="flex items-center gap-3">
                        <ProductThumb src={firstImage(p.images)} title={p.title} className="h-12 w-12" />
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium leading-snug text-stone-800">{p.title}</p>
                          <p className="truncate text-xs text-stone-400">
                            {p.brand ? `by ${p.brand.name}` : p.category?.name ?? ''}
                          </p>
                          {p.condition === 'REFURBISHED' ? (
                            <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                              ♻ Refurbished{p.refurbGrade ? ` · ${p.refurbGrade.charAt(0)}${p.refurbGrade.slice(1).toLowerCase()}` : ''}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-semibold text-stone-900">{formatINR(p.price)}</p>
                      {p.mrp > p.price && <p className="text-xs text-stone-400 line-through">{formatINR(p.mrp)}</p>}
                    </TableCell>
                    <TableCell>
                      <StockChip stock={p.stock} threshold={p.lowStockThreshold} />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={p.status} />
                    </TableCell>
                    <TableCell className="text-sm text-stone-600">{p.soldCount}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm text-stone-600">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                        {p.rating > 0 ? p.rating.toFixed(1) : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4">
                      {!readOnly && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400" aria-label={`Actions for ${p.title}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditProduct(p)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStockTarget(p)}>
                              <PackagePlus /> Adjust Stock
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:bg-red-50 focus:text-red-600"
                              onClick={() => setArchiveTarget(p)}
                            >
                              <Archive /> Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {items.map((p) => (
              <Card key={p.id} className="rounded-xl border p-4 shadow-sm">
                <div className="flex gap-3">
                  <ProductThumb src={firstImage(p.images)} title={p.title} className="h-16 w-16" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-stone-800">{p.title}</p>
                    <p className="mt-0.5 truncate text-xs text-stone-400">
                      {p.brand ? `by ${p.brand.name}` : p.category?.name ?? ''}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-stone-900">{formatINR(p.price)}</span>
                      {p.mrp > p.price && <span className="text-xs text-stone-400 line-through">{formatINR(p.mrp)}</span>}
                      <StatusChip status={p.status} />
                      <StockChip stock={p.stock} threshold={p.lowStockThreshold} />
                    </div>
                    <p className="mt-1.5 text-xs text-stone-500">
                      {p.soldCount} sold ·{' '}
                      <Star className="mr-0.5 inline h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                      {p.rating > 0 ? p.rating.toFixed(1) : 'New'}
                    </p>
                  </div>
                </div>
                {!readOnly && (
                  <div className="mt-3 flex gap-2 border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditProduct(p)
                        setFormOpen(true)
                      }}
                    >
                      <Pencil /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setStockTarget(p)}>
                      <PackagePlus /> Stock
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => setArchiveTarget(p)}
                    >
                      <Archive /> Archive
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-500">
                Page {data.page} of {data.pages} · {data.total} products
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => gotoPage(page - 1)}>
                  <ChevronLeft /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => gotoPage(page + 1)}>
                  Next <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      {formOpen && (
        <ProductFormDialog
          key={editProduct?.id ?? 'new'}
          product={editProduct}
          categories={categories}
          brands={brands}
          onClose={() => setFormOpen(false)}
          onSaved={afterMutate}
        />
      )}
      {stockTarget && (
        <AdjustStockDialog
          key={stockTarget.id}
          product={{ id: stockTarget.id, title: stockTarget.title, stock: stockTarget.stock }}
          onClose={() => setStockTarget(null)}
          onSaved={afterMutate}
        />
      )}
      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this product?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget ? `"${archiveTarget.title}" will be hidden from the storefront. You can no longer edit archived listings.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep product</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => archiveTarget && doArchive(archiveTarget)}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// Orders
// ============================================================

const ORDER_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PACKED', label: 'Packed' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function generateTracking(): string {
  return 'SBX' + String(Math.floor(100000000 + Math.random() * 900000000))
}

function OrderDialog({
  order,
  readOnly,
  onClose,
  onChanged,
  onDashChanged,
}: {
  order: VendorOrder
  readOnly: boolean
  onClose: () => void
  onChanged: () => void
  onDashChanged: () => void
}) {
  const [current, setCurrent] = useState<VendorOrder>(order)
  const [busy, setBusy] = useState(false)
  const [shipOpen, setShipOpen] = useState(false)
  const [courier, setCourier] = useState('Lastrivon Express')
  const [tracking, setTracking] = useState(generateTracking)
  const [cancelOpen, setCancelOpen] = useState(false)

  async function setStatus(status: string, extra?: { courierName?: string; trackingNumber?: string }) {
    setBusy(true)
    const res = await api<{ status: string; courierName: string | null; trackingNumber: string | null }>(
      `/api/vendor/suborders/${current.subOrderId}/status`,
      { method: 'POST', json: { status, ...extra } }
    )
    setBusy(false)
    if (res.ok && res.data) {
      toast.success(`Order ${current.orderNumber} marked as ${humanStatus(res.data.status)}`)
      setCurrent((c) => ({
        ...c,
        status: res.data!.status,
        courierName: res.data!.courierName ?? c.courierName,
        trackingNumber: res.data!.trackingNumber ?? c.trackingNumber,
      }))
      setShipOpen(false)
      onChanged()
      onDashChanged()
    } else {
      toast.error(res.error ?? 'Could not update the order')
    }
  }

  const st = current.status

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{current.orderNumber}</span>
            <StatusChip status={current.status} />
          </DialogTitle>
          <DialogDescription>
            {current.customer.name}
            {current.customer.city || current.customer.state
              ? ` — ${[current.customer.city, current.customer.state].filter(Boolean).join(', ')}`
              : ''}{' '}
            · {formatDate(current.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Items */}
          <div className="space-y-2">
            {current.items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                <ProductThumb src={it.imageSnapshot} title={it.titleSnapshot} className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-800">{it.titleSnapshot}</p>
                  <p className="text-xs text-stone-400">
                    {it.variantName ? `${it.variantName} · ` : ''}
                    {it.qty} × {formatINR2(it.unitPrice)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-stone-900">{formatINR2(it.qty * it.unitPrice)}</span>
              </div>
            ))}
          </div>

          {/* Tracking */}
          {current.trackingNumber && (
            <p className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-700">
              <Truck className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                {current.courierName ?? 'Courier'} · <span className="font-mono">{current.trackingNumber}</span>
              </span>
            </p>
          )}

          {/* Totals */}
          <div className="space-y-2 rounded-xl border bg-stone-50/60 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500">Items total</span>
              <span className="font-medium text-stone-800">{formatINR2(current.itemsTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500">Shipping fee</span>
              <span className="font-medium text-stone-800">
                {current.shippingFee > 0 ? formatINR2(current.shippingFee) : 'FREE'}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-stone-700">Your earning</span>
              <span className="font-bold text-emerald-600">{formatINR2(current.vendorEarning)}</span>
            </div>
          </div>

          {/* Documents */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const res = await openDocument('vendor-po', current.subOrderId)
                if (!res.ok) toast.error(res.error ?? 'Could not generate the document')
              }}
            >
              <Download className="h-3.5 w-3.5" /> Purchase Order
            </Button>
            {current.items.some((it) => ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURNED', 'REFUNDED'].includes(it.status)) && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const res = await openDocument('vendor-return', current.subOrderId)
                  if (!res.ok) toast.error(res.error ?? 'Could not generate the document')
                }}
              >
                <Download className="h-3.5 w-3.5" /> Purchase Return
              </Button>
            )}
          </div>

          {/* Ship form */}
          {!readOnly && st === 'PACKED' && shipOpen && (
            <div className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
              <p className="text-sm font-semibold text-stone-700">Shipping details</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="o-courier">Courier name</Label>
                  <Input id="o-courier" value={courier} onChange={(e) => setCourier(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-tracking">Tracking number</Label>
                  <Input id="o-tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-orange-600 text-white hover:bg-orange-700"
                  onClick={() => setStatus('SHIPPED', { courierName: courier, trackingNumber: tracking })}
                  disabled={busy}
                >
                  {busy ? <span className="inline h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Truck />}
                  Confirm shipment
                </Button>
                <Button variant="outline" onClick={() => setShipOpen(false)} disabled={busy}>
                  Back
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              {st === 'CONFIRMED' && (
                <>
                  <Button
                    className="flex-1 bg-orange-600 text-white hover:bg-orange-700"
                    onClick={() => setStatus('PROCESSING')}
                    disabled={busy}
                  >
                    Start Processing
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setCancelOpen(true)}
                    disabled={busy}
                  >
                    Cancel Order
                  </Button>
                </>
              )}
              {st === 'PROCESSING' && (
                <Button
                  className="flex-1 bg-orange-600 text-white hover:bg-orange-700"
                  onClick={() => setStatus('PACKED')}
                  disabled={busy}
                >
                  Mark Packed
                </Button>
              )}
              {st === 'PACKED' && !shipOpen && (
                <Button
                  className="flex-1 bg-orange-600 text-white hover:bg-orange-700"
                  onClick={() => setShipOpen(true)}
                  disabled={busy}
                >
                  <Truck /> Ship Order
                </Button>
              )}
              {st === 'SHIPPED' && (
                <Button
                  className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => setStatus('DELIVERED')}
                  disabled={busy}
                >
                  <CheckCircle2 /> Mark Delivered
                </Button>
              )}
              {st === 'DELIVERED' && (
                <p className="flex w-full items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Delivered — no further action needed.
                </p>
              )}
              {st === 'CANCELLED' && (
                <p className="flex w-full items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-500">
                  This sub-order was cancelled and the stock was returned to inventory.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Cancel confirm */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this sub-order?</AlertDialogTitle>
            <AlertDialogDescription>
              Order {current.orderNumber} will be cancelled, the items restocked and the customer refunded if they had
              paid online. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                setCancelOpen(false)
                setStatus('CANCELLED')
              }}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

export function OrdersSection({
  readOnly,
  onDashChanged,
}: {
  readOnly: boolean
  onDashChanged: () => void
}) {
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<OrdersResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOrder, setDialogOrder] = useState<VendorOrder | null>(null)

  const refetch = useCallback(() => {
    const q = new URLSearchParams({ page: String(page) })
    if (status !== 'ALL') q.set('status', status)
    api<OrdersResp>(`/api/vendor/orders?${q.toString()}`).then((res) => {
      if (res.ok && res.data) {
        setData(res.data)
        setError('')
      } else {
        setError(res.error ?? 'Failed to load orders')
      }
      setLoading(false)
    })
  }, [page, status])

  useEffect(() => {
    refetch()
  }, [refetch])

  function onTabChange(v: string) {
    setStatus(v)
    setPage(1)
    setLoading(true)
  }
  function gotoPage(p: number) {
    setPage(p)
    setLoading(true)
  }

  const items = data?.items ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Orders</h1>
        <p className="text-sm text-stone-500">Fulfil orders and keep customers updated at every step.</p>
      </div>

      <div className="overflow-x-auto pb-1">
        <Tabs value={status} onValueChange={onTabChange}>
          <TabsList className="inline-flex max-w-full">
            {ORDER_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="whitespace-nowrap">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {error && data ? (
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : error && !data ? (
        <SectionError message={error} onRetry={refetch} />
      ) : items.length === 0 ? (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-0">
            <EmptyState
              icon={ShoppingCart}
              title="No orders here"
              hint={status === 'ALL' ? 'New orders will appear as soon as customers check out.' : `You have no ${humanStatus(status).toLowerCase()} orders.`}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden rounded-xl border py-0 shadow-sm md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Earning</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((o) => (
                  <TableRow key={o.subOrderId}>
                    <TableCell className="pl-4">
                      <p className="font-mono text-sm font-semibold text-stone-900">{o.orderNumber}</p>
                      <p className="text-xs text-stone-400">{formatDate(o.createdAt)}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-stone-700">{o.customer.name}</p>
                      <p className="text-xs text-stone-400">
                        {[o.customer.city, o.customer.state].filter(Boolean).join(', ') || '—'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] text-xs text-stone-600">
                        {o.items.slice(0, 2).map((it) => (
                          <p key={it.id} className="truncate">
                            {it.titleSnapshot} × {it.qty}
                          </p>
                        ))}
                        {o.items.length > 2 && <p className="text-stone-400">+{o.items.length - 2} more</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-semibold text-stone-900">{formatINR(o.itemsTotal)}</p>
                      <p className="text-xs text-stone-400">+{formatINR(o.shippingFee)} ship</p>
                    </TableCell>
                    <TableCell className="text-sm font-bold text-emerald-600">{formatINR2(o.vendorEarning)}</TableCell>
                    <TableCell>
                      <StatusChip status={o.status} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => setDialogOrder(o)}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {items.map((o) => (
              <Card key={o.subOrderId} className="rounded-xl border p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-semibold text-stone-900">{o.orderNumber}</p>
                    <p className="text-xs text-stone-400">{formatDate(o.createdAt)}</p>
                  </div>
                  <StatusChip status={o.status} />
                </div>
                <p className="mt-2 text-sm font-medium text-stone-700">{o.customer.name}</p>
                <p className="text-xs text-stone-400">
                  {[o.customer.city, o.customer.state].filter(Boolean).join(', ') || '—'}
                </p>
                <div className="mt-2 text-xs text-stone-600">
                  {o.items.slice(0, 2).map((it) => (
                    <p key={it.id} className="truncate">
                      {it.titleSnapshot} × {it.qty}
                    </p>
                  ))}
                  {o.items.length > 2 && <p className="text-stone-400">+{o.items.length - 2} more</p>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <div>
                    <p className="text-xs text-stone-400">Total {formatINR(o.itemsTotal)}</p>
                    <p className="text-sm font-bold text-emerald-600">{formatINR2(o.vendorEarning)} earning</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setDialogOrder(o)}>
                    Manage
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-500">
                Page {data.page} of {data.pages} · {data.total} orders
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => gotoPage(page - 1)}>
                  <ChevronLeft /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => gotoPage(page + 1)}>
                  Next <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {dialogOrder && (
        <OrderDialog
          key={dialogOrder.subOrderId}
          order={dialogOrder}
          readOnly={readOnly}
          onClose={() => setDialogOrder(null)}
          onChanged={refetch}
          onDashChanged={onDashChanged}
        />
      )}
    </div>
  )
}

// ============================================================
// Returns
// ============================================================

export function ReturnsSection({ onDashChanged }: { onDashChanged: () => void }) {
  const [items, setItems] = useState<VendorReturn[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<{ r: VendorReturn; action: 'APPROVED' | 'REJECTED' } | null>(null)

  const refetch = useCallback(() => {
    api<{ items: VendorReturn[] }>('/api/vendor/returns').then((res) => {
      if (res.ok && res.data) {
        setItems(res.data.items)
        setError('')
      } else {
        setError(res.error ?? 'Failed to load return requests')
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function resolve() {
    if (!confirm) return
    const { r, action } = confirm
    setConfirm(null)
    const res = await api<{ status: string }>(`/api/vendor/returns/${r.id}`, { method: 'POST', json: { action } })
    if (res.ok) {
      toast.success(action === 'APPROVED' ? 'Return approved — refund initiated' : 'Return request rejected')
      refetch()
      if (action === 'APPROVED') onDashChanged()
    } else {
      toast.error(res.error ?? 'Could not process the return request')
    }
  }

  const pendingCount = items?.filter((r) => r.status === 'PENDING').length ?? 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Returns</h1>
        <p className="text-sm text-stone-500">
          Customer return requests for your products{pendingCount > 0 ? ` — ${pendingCount} awaiting your review` : ''}.
        </p>
      </div>

      {loading && items === null ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : error && items === null ? (
        <SectionError message={error} onRetry={refetch} />
      ) : items && items.length === 0 ? (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-0">
            <EmptyState
              icon={RotateCcw}
              title="No return requests"
              hint="Customer returns for your products will show up here for review."
            />
          </CardContent>
        </Card>
      ) : items ? (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((r) => {
            const amount = r.refundAmount ?? r.orderItem.effectiveTotal
            return (
              <Card key={r.id} className="rounded-xl border shadow-sm">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <ProductThumb src={r.orderItem.imageSnapshot} title={r.orderItem.titleSnapshot} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-800">{r.orderItem.titleSnapshot}</p>
                      <p className="font-mono text-xs text-stone-400">
                        {r.orderItem.orderNumber} · {r.orderItem.customer}
                      </p>
                    </div>
                    <StatusChip status={r.status} />
                  </div>
                  <div className="rounded-lg bg-stone-50 px-3 py-2">
                    <p className="text-sm font-medium text-stone-700">{r.reason}</p>
                    {r.comment && <p className="mt-0.5 text-xs italic text-stone-500">“{r.comment}”</p>}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <p className="text-xs text-stone-400">
                      {formatDate(r.createdAt)}
                      {r.status === 'PENDING' ? ` · refund ${formatINR2(amount)}` : ''}
                    </p>
                    {r.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => setConfirm({ r, action: 'APPROVED' })}
                        >
                          Approve Refund
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => setConfirm({ r, action: 'REJECTED' })}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === 'APPROVED' ? 'Approve this refund?' : 'Reject this return request?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === 'APPROVED'
                ? `Refund of ${formatINR2((confirm?.r.refundAmount ?? confirm?.r.orderItem.effectiveTotal) ?? 0)} will be deducted from your vendor balance and returned to the customer.`
                : 'The customer will be notified that the return was rejected. The item stays delivered on your order.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              className={confirm?.action === 'APPROVED' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-600 text-white hover:bg-red-700'}
              onClick={resolve}
            >
              {confirm?.action === 'APPROVED' ? 'Approve refund' : 'Reject return'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// Finance
// ============================================================

const LEDGER_META: Record<string, { label: string; cls: string }> = {
  SALE_CREDIT: { label: 'Sale', cls: 'bg-emerald-100 text-emerald-700' },
  COMMISSION_DEBIT: { label: 'Commission', cls: 'bg-rose-100 text-rose-700' },
  REFUND_DEBIT: { label: 'Refund', cls: 'bg-rose-100 text-rose-700' },
  SETTLEMENT_PAYOUT: { label: 'Payout', cls: 'bg-stone-200 text-stone-700' },
}

function settlementChip(status: string) {
  const cls =
    status === 'PROCESSED'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'FAILED'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700'
  return <Badge className={cn('border-transparent font-medium', cls)}>{humanStatus(status)}</Badge>
}

export function FinanceSection() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refetch = useCallback(() => {
    api<FinanceData>('/api/vendor/finance').then((res) => {
      if (res.ok && res.data) {
        setData(res.data)
        setError('')
      } else {
        setError(res.error ?? 'Failed to load finance data')
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  function exportCsv() {
    if (!data) return
    const rows: string[][] = [['Date', 'Type', 'Direction', 'Amount (INR)', 'Notes', 'Settled']]
    for (const l of data.ledger) {
      rows.push([
        new Date(l.createdAt).toISOString(),
        l.type,
        l.direction,
        String(l.amount),
        l.notes ?? '',
        l.settled ? 'yes' : 'no',
      ])
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ledger.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Ledger exported as CSV')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Finance</h1>
        <p className="text-sm text-stone-500">Earnings, commissions and settlement payouts.</p>
      </div>

      {loading && !data ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : error && !data ? (
        <SectionError message={error} onRetry={refetch} />
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-xl border shadow-sm">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Available balance</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">{formatINR2(data.balance)}</p>
                <p className="mt-1 text-xs text-stone-400">Settled weekly by the platform</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border shadow-sm">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Lifetime earnings</p>
                <p className="mt-1 text-3xl font-bold text-stone-900">{formatINR(data.lifetimeEarnings)}</p>
                <p className="mt-1 text-xs text-stone-400">Net of commissions and refunds</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border shadow-sm">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Commission paid</p>
                <p className="mt-1 text-3xl font-bold text-stone-900">{formatINR(data.commissionPaid)}</p>
                <p className="mt-1 text-xs text-stone-400">Marketplace fee on your sales</p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Settlements</CardTitle>
              <CardDescription>Payout runs initiated by the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {data.settlements.length === 0 ? (
                <EmptyState icon={Wallet} title="No settlements yet" hint="Your first payout will appear after the platform settles your balance." />
              ) : (
                <div className="max-h-96 overflow-y-auto pr-2">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Reference</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.settlements.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs">{s.reference}</TableCell>
                          <TableCell className="font-semibold text-stone-900">{formatINR2(s.amount)}</TableCell>
                          <TableCell>{settlementChip(s.status)}</TableCell>
                          <TableCell className="text-sm text-stone-500">{formatDate(s.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">Ledger</CardTitle>
                <CardDescription>Latest 50 transactions on your account</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {data.ledger.length === 0 ? (
                <EmptyState icon={Wallet} title="No transactions yet" hint="Ledger entries appear as soon as you make a sale." />
              ) : (
                <div className="max-h-96 overflow-y-auto pr-2">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Settled</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ledger.map((l) => {
                        const meta = LEDGER_META[l.type] ?? { label: humanStatus(l.type), cls: 'bg-stone-100 text-stone-600' }
                        const credit = l.direction === 'CREDIT'
                        return (
                          <TableRow key={l.id}>
                            <TableCell className="whitespace-nowrap text-sm text-stone-500">{formatDateTime(l.createdAt)}</TableCell>
                            <TableCell>
                              <Badge className={cn('border-transparent font-medium', meta.cls)}>{meta.label}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <p className="truncate text-sm text-stone-600">{l.notes ?? '—'}</p>
                            </TableCell>
                            <TableCell>
                              {l.settled ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Settled" />
                              ) : (
                                <Clock className="h-4 w-4 text-amber-500" aria-label="Unsettled" />
                              )}
                            </TableCell>
                            <TableCell className={cn('text-right font-semibold', credit ? 'text-emerald-600' : 'text-red-600')}>
                              {credit ? '+' : '-'}
                              {formatINR2(l.amount)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

// ============================================================
// Staff
// ============================================================

const STAFF_ROLE_META: Record<string, { label: string; cls: string }> = {
  PRODUCT_MANAGER: { label: 'Product Manager', cls: 'bg-violet-100 text-violet-700' },
  ORDER_MANAGER: { label: 'Order Manager', cls: 'bg-amber-100 text-amber-700' },
  INVENTORY_MANAGER: { label: 'Inventory Manager', cls: 'bg-emerald-100 text-emerald-700' },
  ACCOUNTANT: { label: 'Accountant', cls: 'bg-rose-100 text-rose-700' },
}

function StaffAddDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [staffRole, setStaffRole] = useState('ORDER_MANAGER')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!name.trim() || !email.trim() || !password) {
      toast.error('Name, email and password are required')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setBusy(true)
    const res = await api('/api/vendor/staff', {
      method: 'POST',
      json: { name: name.trim(), email: email.trim(), password, staffRole },
    })
    setBusy(false)
    if (res.ok) {
      toast.success('Staff member added — they can now sign in to the vendor panel')
      onSaved()
      onClose()
    } else {
      toast.error(res.error ?? 'Could not add staff member')
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add staff member</DialogTitle>
          <DialogDescription>
            They will receive VENDOR_STAFF access scoped to your store with the role you pick.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="st-name">Full name</Label>
            <Input id="st-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-email">Email</Label>
            <Input
              id="st-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@yourstore.in"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-pass">Temporary password</Label>
            <Input
              id="st-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={staffRole} onValueChange={setStaffRole}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STAFF_ROLE_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="bg-orange-600 text-white hover:bg-orange-700" onClick={submit} disabled={busy}>
            Add staff
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StaffSection({ readOnly }: { readOnly: boolean }) {
  const [items, setItems] = useState<StaffMember[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<StaffMember | null>(null)

  const refetch = useCallback(() => {
    api<{ items: StaffMember[] }>('/api/vendor/staff').then((res) => {
      if (res.ok && res.data) {
        setItems(res.data.items)
        setError('')
      } else {
        setError(res.error ?? 'Failed to load staff')
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function doRemove(s: StaffMember) {
    setRemoveTarget(null)
    const res = await api(`/api/vendor/staff/${s.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(`${s.name} removed from your team`)
      refetch()
    } else {
      toast.error(res.error ?? 'Could not remove staff member')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Staff</h1>
          <p className="text-sm text-stone-500">Team members with access to this vendor panel.</p>
        </div>
        {!readOnly && (
          <Button className="bg-orange-600 text-white hover:bg-orange-700" onClick={() => setAddOpen(true)}>
            <Plus /> Add Staff
          </Button>
        )}
      </div>

      {readOnly && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm font-medium text-amber-800">
          <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Staff management is available to the store owner only — you are viewing the list in read-only mode.
        </p>
      )}

      {loading && items === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : error && items === null ? (
        <SectionError message={error} onRetry={refetch} />
      ) : items && items.length === 0 ? (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title="No staff members yet"
              hint="Add staff to share the workload — each gets scoped permissions."
            >
              {!readOnly && (
                <Button className="bg-orange-600 text-white hover:bg-orange-700" onClick={() => setAddOpen(true)}>
                  <Plus /> Add Staff
                </Button>
              )}
            </EmptyState>
          </CardContent>
        </Card>
      ) : items ? (
        <Card className="rounded-xl border py-0 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {!readOnly && <TableHead className="pr-4 text-right" aria-label="Actions" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => {
                const meta = STAFF_ROLE_META[s.staffRole] ?? { label: s.staffRole, cls: 'bg-stone-100 text-stone-600' }
                return (
                  <TableRow key={s.id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-600">
                          {s.name
                            .split(' ')
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-stone-800">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-stone-500">{s.email}</TableCell>
                    <TableCell>
                      <Badge className={cn('border-transparent font-medium', meta.cls)}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-stone-500">{formatDate(s.createdAt)}</TableCell>
                    {!readOnly && (
                      <TableCell className="pr-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => setRemoveTarget(s)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      {addOpen && <StaffAddDialog onClose={() => setAddOpen(false)} onSaved={refetch} />}

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `${removeTarget.name} (${removeTarget.email}) will immediately lose access to the vendor panel.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => removeTarget && doRemove(removeTarget)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// Store settings
// ============================================================

export function StoreSection({ dash, onSaved }: { dash: VendorDashboard | null; onSaved: () => void }) {
  const navigate = useAppStore((s) => s.navigate)

  const [name, setName] = useState(dash?.vendor.name ?? '')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [stateField, setStateField] = useState('')
  const [gstin, setGstin] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankIfsc, setBankIfsc] = useState('')
  const [busy, setBusy] = useState(false)

  const slug = dash?.vendor.slug ?? ''

  // Public store page carries description/city/state — use it to prefill what the
  // dashboard payload does not include (phone/GSTIN/bank stay blank for privacy).
  useEffect(() => {
    if (!slug) return
    api<{ vendor: { description: string | null; city: string | null; state: string | null } }>(
      `/api/vendors/${slug}`
    ).then((res) => {
      const v = res.ok ? res.data?.vendor : null
      if (v) {
        setDescription((p) => p || v.description || '')
        setCity((p) => p || v.city || '')
        setStateField((p) => p || v.state || '')
      }
    })
  }, [slug])

  async function save() {
    if (!name.trim()) {
      toast.error('Store name is required')
      return
    }
    setBusy(true)
    const res = await api('/api/vendor/profile', {
      method: 'PATCH',
      json: {
        name: name.trim(),
        description,
        phone,
        city,
        state: stateField,
        gstin,
        pickupAddress,
        bankAccountName,
        bankAccountNumber,
        bankIfsc,
      },
    })
    setBusy(false)
    if (res.ok) {
      toast.success('Store profile updated')
      onSaved()
    } else {
      toast.error(res.error ?? 'Could not save store profile')
    }
  }

  const vendor = dash?.vendor

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Store Settings</h1>
        <p className="text-sm text-stone-500">Your public store profile and payout details.</p>
      </div>

      {vendor && (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <StatusChip status={vendor.status} />
            {vendor.plan && (
              <Badge variant="outline" className="font-medium">
                {vendor.plan.name} plan
              </Badge>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium text-stone-600">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
              {vendor.rating > 0 ? vendor.rating.toFixed(1) : 'New store'}
            </span>
            {vendor.slug && (
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate('vendor', { slug: vendor.slug })}>
                View public store <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <StoreIcon className="h-4 w-4 text-orange-600" aria-hidden /> Store profile
          </CardTitle>
          <CardDescription>Shown to customers on your storefront page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="v-name">
                Store name <span className="text-red-500">*</span>
              </Label>
              <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-phone">Phone</Label>
              <Input id="v-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-desc">Description</Label>
              <Textarea
                id="v-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Tell shoppers what makes your store special…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-city">City</Label>
              <Input id="v-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Mumbai" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-state">State</Label>
              <Input id="v-state" value={stateField} onChange={(e) => setStateField(e.target.value)} placeholder="e.g. Maharashtra" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-gstin">GSTIN</Label>
              <Input id="v-gstin" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-pickup">Pickup address</Label>
              <Textarea
                id="v-pickup"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                rows={2}
                placeholder="Where couriers collect your shipments"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-orange-600" aria-hidden /> Payout details
          </CardTitle>
          <CardDescription>Used by the platform for your weekly settlement transfers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-name">Account holder name</Label>
              <Input id="b-name" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-num">Account number</Label>
              <Input id="b-num" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-ifsc">IFSC code</Label>
              <Input id="b-ifsc" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} placeholder="SBIN0001234" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="bg-orange-600 text-white hover:bg-orange-700" onClick={save} disabled={busy}>
          {busy ? <span className="inline h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  )
}
