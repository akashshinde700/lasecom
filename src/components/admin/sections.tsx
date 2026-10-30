'use client'
//
// Admin panel sections (part 1): Dashboard, Vendors, Products, Orders, Returns
//

import { Fragment, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { openDocument, type DocRequestKind } from '@/lib/documents'
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  IndianRupee,
  ImageOff,
  Loader2,
  MapPin,
  Megaphone,
  MoreHorizontal,
  Package,
  PackageX,
  Percent,
  RotateCcw,
  Search,
  ShoppingCart,
  Star,
  Store,
  TrendingUp,
  Wallet,
  X,
  Download,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '@/lib/store'
import { PAYMENT_STATUS_LABEL, formatDate, formatDateTime, formatINR, formatINR2, parseJson, statusColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  EmptyState,
  OwnerButton,
  OwnerDropdownItem,
  PageHeader,
  Pager,
  ProductFormDialog,
  StatusChip,
  initials,
} from './forms'

// ============================================================
// Shared small pieces
// ============================================================

function KpiCard({
  label,
  value,
  subtext,
  icon,
  tint,
}: {
  label: string
  value: string
  subtext?: string
  icon: React.ReactNode
  tint: string
}) {
  return (
    <Card className="rounded-xl border-stone-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</p>
          <div className={cn('rounded-lg p-1.5', tint)}>{icon}</div>
        </div>
        <p className="mt-2 text-lg font-bold tracking-tight text-stone-900 md:text-xl">{value}</p>
        {subtext ? <p className="mt-0.5 text-[11px] leading-snug text-stone-400">{subtext}</p> : null}
      </CardContent>
    </Card>
  )
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            value === o.value
              ? 'border-orange-600 bg-orange-600 text-white'
              : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function RowSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-md" />
      ))}
    </div>
  )
}

// ============================================================
// DashboardSection — GET /api/admin/dashboard
// ============================================================

type DashboardData = {
  gmv: number
  platformSales: number
  vendorSales: number
  commissionEarned: number
  platformProductMargin: number
  paymentFees: number
  refundsTotal: number
  netRevenue: number
  pendingSettlements: number
  orders: { total: number; pendingPayment: number; confirmed: number; shipped: number; delivered: number; cancelled: number; aov: number }
  customers: { total: number; newThisWeek: number }
  vendors: { total: number; active: number; pending: number }
  lowStock: { id: string; title: string; stock: number; vendor: string | null }[]
  topProducts: { title: string; soldCount: number; revenue: number }[]
  topCategories: { name: string; revenue: number }[]
  topVendors: { name: string; revenue: number; orders: number }[]
  salesByDay: { date: string; gmv: number; orders: number }[]
  recentOrders: { orderNumber: string; customer: string; total: number; status: string; paymentStatus: string; createdAt: string }[]
  subscriptionRevenue: number
}

export function DashboardSection({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api<DashboardData>('/api/admin/dashboard').then((res) => {
      if (!alive) return
      if (res.ok && res.data) setData(res.data)
      else setError(res.error ?? 'Failed to load dashboard')
    })
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description="Platform overview — GMV, revenue, vendors and orders" />
        <Card className="rounded-xl border-stone-200 shadow-sm">
          <EmptyState icon={<AlertTriangle className="size-10" />} title="Could not load dashboard" hint={error} />
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description="Platform overview — GMV, revenue, vendors and orders" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const d = data
  const maxCatRevenue = Math.max(1, ...d.topCategories.map((c) => c.revenue))

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description="Platform overview — GMV, revenue, vendors and orders" />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="GMV"
          value={formatINR2(d.gmv)}
          subtext="GMV ≠ platform profit"
          icon={<TrendingUp className="size-4 text-emerald-600" />}
          tint="bg-emerald-100"
        />
        <KpiCard
          label="Net Revenue"
          value={formatINR2(d.netRevenue)}
          subtext="Commission + 1P margin − refunds (estimate)"
          icon={<Wallet className="size-4 text-violet-600" />}
          tint="bg-violet-100"
        />
        <KpiCard
          label="Commission Earned"
          value={formatINR2(d.commissionEarned)}
          subtext="From vendor (3P) sales"
          icon={<Percent className="size-4 text-amber-600" />}
          tint="bg-amber-100"
        />
        <KpiCard
          label="1P Product Margin"
          value={formatINR2(d.platformProductMargin)}
          subtext="Platform-owned sales − cost"
          icon={<Package className="size-4 text-emerald-600" />}
          tint="bg-emerald-100"
        />
        <KpiCard
          label="Pending Settlements"
          value={formatINR2(d.pendingSettlements)}
          subtext="Owed to vendors"
          icon={<Clock className="size-4 text-amber-600" />}
          tint="bg-amber-100"
        />
        <KpiCard
          label="Refunds"
          value={formatINR2(d.refundsTotal)}
          subtext="Total refunded to customers"
          icon={<RotateCcw className="size-4 text-red-600" />}
          tint="bg-red-100"
        />
        <KpiCard
          label="Subscription Revenue"
          value={formatINR2(d.subscriptionRevenue)}
          subtext="Active vendor plans / month"
          icon={<Crown className="size-4 text-violet-600" />}
          tint="bg-violet-100"
        />
        <KpiCard
          label="Payment Gateway Fees"
          value={formatINR2(d.paymentFees)}
          subtext="2% on successful payments"
          icon={<CreditCard className="size-4 text-stone-500" />}
          tint="bg-stone-100"
        />
      </div>

      {/* Mini stats */}
      <Card className="rounded-xl border-stone-200 shadow-sm">
        <CardContent className="grid grid-cols-2 gap-4 p-4 lg:grid-cols-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Orders</p>
            <p className="mt-1 text-xl font-bold text-stone-900">{d.orders.total.toLocaleString('en-IN')}</p>
            <p className="mt-0.5 text-xs text-stone-400">AOV {formatINR(d.orders.aov)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Customers</p>
            <p className="mt-1 text-xl font-bold text-stone-900">{d.customers.total.toLocaleString('en-IN')}</p>
            <p className="mt-0.5 text-xs text-stone-400">+{d.customers.newThisWeek} this week</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Vendors</p>
            <p className="mt-1 flex items-center gap-2 text-xl font-bold text-stone-900">
              {d.vendors.active}
              <span className="text-sm font-normal text-stone-400">/ {d.vendors.total} active</span>
            </p>
            {d.vendors.pending > 0 ? (
              <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                {d.vendors.pending} pending approval
              </span>
            ) : (
              <p className="mt-0.5 text-xs text-stone-400">No pending approvals</p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Sales Split</p>
            <div className="mt-1.5 flex flex-col items-start gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                <BadgeCheck className="size-3.5 text-stone-500" /> Platform (1P) {formatINR(d.platformSales)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                <Store className="size-3.5" /> Vendors (3P) {formatINR(d.vendorSales)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 14-day chart */}
      <Card className="rounded-xl border-stone-200 shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Last 14 days</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={d.salesByDay} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="left"
                width={72}
                tick={{ fontSize: 11, fill: '#78716c' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatINR(Number(v))}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                width={32}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#78716c' }}
                tickLine={false}
                axisLine={false}
              />
              <RTooltip
                formatter={(value, name) =>
                  name === 'gmv' ? [formatINR2(Number(value)), 'GMV'] : [String(value), 'Orders']
                }
                contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="gmv" name="GMV" fill="#fb923c" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#1c1917"
                strokeWidth={2}
                dot={{ r: 2.5, fill: '#1c1917' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top lists + low stock */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Top Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {d.topProducts.length === 0 ? <p className="py-4 text-center text-xs text-stone-400">No sales yet</p> : null}
            {d.topProducts.map((p, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-800" title={p.title}>
                    {i + 1}. {p.title}
                  </p>
                  <p className="text-xs text-stone-400">{p.soldCount} sold</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-emerald-700">{formatINR(p.revenue)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Top Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.topCategories.length === 0 ? <p className="py-4 text-center text-xs text-stone-400">No sales yet</p> : null}
            {d.topCategories.map((c, i) => (
              <div key={i}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-stone-800">{c.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-stone-600">{formatINR(c.revenue)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.max(4, (c.revenue / maxCatRevenue) * 100)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Top Vendors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {d.topVendors.length === 0 ? <p className="py-4 text-center text-xs text-stone-400">No vendor sales yet</p> : null}
            {d.topVendors.map((v, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-800">
                    {i + 1}. {v.name}
                  </p>
                  <p className="text-xs text-stone-400">{v.orders} sub-orders</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-violet-700">{formatINR(v.revenue)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-stone-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Low Stock Alerts</CardTitle>
            <AlertTriangle className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            {d.lowStock.length === 0 ? (
              <p className="py-4 text-center text-xs text-stone-400">All products healthy 🎉</p>
            ) : null}
            {d.lowStock.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onNavigate?.('products')}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-stone-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-800" title={p.title}>
                    {p.title}
                  </p>
                  <p className="truncate text-xs text-stone-400">{p.vendor ?? 'Platform (1P)'}</p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                  {p.stock} left
                </span>
              </button>
            ))}
            {d.lowStock.length > 0 ? (
              <button
                type="button"
                onClick={() => onNavigate?.('products')}
                className="pt-1 text-xs font-medium text-orange-600 hover:text-orange-700"
              >
                Manage products →
              </button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="rounded-xl border-stone-200 shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Recent Orders</CardTitle>
          <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700" onClick={() => onNavigate?.('orders')}>
            View all
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.recentOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState title="No orders yet" />
                    </TableCell>
                  </TableRow>
                ) : null}
                {d.recentOrders.map((o) => (
                  <TableRow key={o.orderNumber}>
                    <TableCell className="font-mono text-xs font-semibold">{o.orderNumber}</TableCell>
                    <TableCell>{o.customer}</TableCell>
                    <TableCell className="text-right font-semibold">{formatINR2(o.total)}</TableCell>
                    <TableCell>
                      <StatusChip status={o.status} />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={o.paymentStatus} label={PAYMENT_STATUS_LABEL[o.paymentStatus] ?? o.paymentStatus} />
                    </TableCell>
                    <TableCell className="text-xs text-stone-500">{formatDate(o.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// VendorsSection — GET /api/admin/vendors?status&search
// ============================================================

type AdminVendor = {
  id: string
  name: string
  slug: string
  email: string
  status: string
  commissionPercent: number | null
  city: string | null
  state: string | null
  gstin: string | null
  rating: number
  plan: { name: string; priceMonthly: number } | null
  productCount: number
  orderCount: number
  totalSales: number
  createdAt: string
  owner: { name: string; email: string }
}

type PlanRow = {
  id: string
  name: string
  priceMonthly: number
  listingLimit: number
  commissionDiscountPercent: number
  features: string
  active: boolean
  _count?: { vendors: number }
}

const VENDOR_STATUS_CHIPS = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
]

type ConfirmDlg = { title: string; description: string; confirmLabel: string; run: () => void } | null

export function VendorsSection({ isOwner }: { isOwner: boolean }) {
  const [items, setItems] = useState<AdminVendor[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [busy, setBusy] = useState(false)

  // dialogs
  const [confirmDlg, setConfirmDlg] = useState<ConfirmDlg>(null)
  const [rejectDlg, setRejectDlg] = useState<{ id: string; name: string; reason: string } | null>(null)
  const [commissionDlg, setCommissionDlg] = useState<{ id: string; name: string; value: string } | null>(null)
  const [planDlg, setPlanDlg] = useState<{ id: string; name: string; planId: string } | null>(null)

  function fetchVendors(sf: string, s: string) {
    const q = new URLSearchParams()
    if (sf !== 'ALL') q.set('status', sf)
    if (s.trim()) q.set('search', s.trim())
    api<{ items: AdminVendor[] }>(`/api/admin/vendors?${q.toString()}`).then((res) => {
      if (res.ok && res.data) setItems(res.data.items)
      else toast.error(res.error ?? 'Failed to load vendors')
      setLoading(false)
    })
  }

  useEffect(() => {
    const t = setTimeout(() => fetchVendors(statusFilter, search), search ? 300 : 0)
    return () => clearTimeout(t)
     
  }, [statusFilter, search])

  useEffect(() => {
    api<{ items: PlanRow[] }>('/api/admin/plans').then((res) => {
      if (res.ok && res.data) setPlans(res.data.items)
    })
  }, [])

  function refetch() {
    fetchVendors(statusFilter, search)
  }

  function setVendorStatus(id: string, status: string, reason?: string) {
    setBusy(true)
    api(`/api/admin/vendors/${id}/status`, { method: 'POST', json: { status, ...(reason ? { reason } : {}) } }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(`Vendor marked ${status.toLowerCase()}`)
        setConfirmDlg(null)
        refetch()
      } else {
        toast.error(res.error ?? 'Failed to update vendor')
      }
    })
  }

  function saveCommission() {
    if (!commissionDlg) return
    const v = Number(commissionDlg.value)
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      toast.error('Commission percent must be 0-100')
      return
    }
    setBusy(true)
    api(`/api/admin/vendors/${commissionDlg.id}`, { method: 'PATCH', json: { commissionPercent: v } }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success('Commission updated')
        setCommissionDlg(null)
        refetch()
      } else {
        toast.error(res.error ?? 'Failed to update commission')
      }
    })
  }

  function savePlan() {
    if (!planDlg) return
    setBusy(true)
    api(`/api/admin/vendors/${planDlg.id}`, { method: 'PATCH', json: { planId: planDlg.planId || null } }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success('Plan updated')
        setPlanDlg(null)
        refetch()
      } else {
        toast.error(res.error ?? 'Failed to update plan')
      }
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vendors"
        description={`${items.length} vendor${items.length === 1 ? '' : 's'} — approve, suspend and manage commissions`}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Chips options={VENDOR_STATUS_CHIPS} value={statusFilter} onChange={setStatusFilter} />
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or slug…"
            className="pl-8"
          />
        </div>
      </div>

      <Card className="rounded-xl border-stone-200 shadow-sm">
        {loading ? (
          <RowSkeleton rows={5} />
        ) : items.length === 0 ? (
          <EmptyState icon={<Store className="size-10" />} title="No vendors found" hint="Try changing the status filter or search term." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1150px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead>Vendor</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Stats</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">
                          {initials(v.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="max-w-[170px] truncate font-medium text-stone-800" title={v.name}>
                            {v.name}
                          </p>
                          <p className="truncate text-xs text-stone-400">/{v.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[150px] truncate text-sm">{v.owner.name}</p>
                      <p className="max-w-[150px] truncate text-xs text-stone-400">{v.owner.email}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{v.gstin ?? '—'}</TableCell>
                    <TableCell className="text-xs text-stone-600">
                      {v.city || v.state ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3 text-stone-400" />
                          {[v.city, v.state].filter(Boolean).join(', ')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {v.plan ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[11px] text-violet-700">
                            <Crown className="size-3" /> {v.plan.name}
                          </Badge>
                          <span className="text-[11px] text-stone-400">{formatINR(v.plan.priceMonthly)}/mo</span>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400">No plan</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isOwner ? (
                        <button
                          type="button"
                          onClick={() => setCommissionDlg({ id: v.id, name: v.name, value: String(v.commissionPercent ?? '') })}
                          className="rounded-md border border-dashed border-stone-300 px-2 py-0.5 text-xs font-semibold text-stone-700 hover:border-orange-400 hover:text-orange-700"
                          title="Edit commission"
                        >
                          {v.commissionPercent != null ? `${v.commissionPercent}%` : 'Set %'}
                        </button>
                      ) : (
                        <span className="text-xs text-stone-500">{v.commissionPercent != null ? `${v.commissionPercent}%` : '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs leading-4 text-stone-600">
                        <p>{v.productCount} products</p>
                        <p>{v.orderCount} orders · {formatINR(v.totalSales)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-stone-700">★ {v.rating.toFixed(1)}</span>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={v.status} />
                    </TableCell>
                    <TableCell className="text-xs text-stone-500">{formatDate(v.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${v.name}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-xs text-stone-400">{v.name}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {v.status === 'PENDING' ? (
                            <OwnerDropdownItem
                              isOwner={isOwner}
                              onSelect={() =>
                                setConfirmDlg({
                                  title: `Approve "${v.name}"?`,
                                  description: 'The vendor store will go live on the marketplace immediately and the owner will be notified.',
                                  confirmLabel: 'Approve vendor',
                                  run: () => setVendorStatus(v.id, 'ACTIVE'),
                                })
                              }
                            >
                              <BadgeCheck className="size-4 text-emerald-600" /> Approve
                            </OwnerDropdownItem>
                          ) : null}
                          {v.status !== 'REJECTED' ? (
                            <OwnerDropdownItem
                              isOwner={isOwner}
                              onSelect={() => setRejectDlg({ id: v.id, name: v.name, reason: '' })}
                            >
                              <X className="size-4 text-red-500" /> Reject…
                            </OwnerDropdownItem>
                          ) : null}
                          {v.status === 'ACTIVE' ? (
                            <OwnerDropdownItem
                              isOwner={isOwner}
                              destructive
                              onSelect={() =>
                                setConfirmDlg({
                                  title: `Suspend "${v.name}"?`,
                                  description: 'Their products will be hidden from the storefront until reactivated.',
                                  confirmLabel: 'Suspend vendor',
                                  run: () => setVendorStatus(v.id, 'SUSPENDED'),
                                })
                              }
                            >
                              <Ban className="size-4 text-amber-600" /> Suspend
                            </OwnerDropdownItem>
                          ) : null}
                          {v.status === 'SUSPENDED' || v.status === 'REJECTED' ? (
                            <OwnerDropdownItem
                              isOwner={isOwner}
                              onSelect={() =>
                                setConfirmDlg({
                                  title: `Reactivate "${v.name}"?`,
                                  description: 'The vendor will become ACTIVE and their products visible again.',
                                  confirmLabel: 'Reactivate',
                                  run: () => setVendorStatus(v.id, 'ACTIVE'),
                                })
                              }
                            >
                              <RotateCcw className="size-4 text-emerald-600" /> Reactivate
                            </OwnerDropdownItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <OwnerDropdownItem
                            isOwner={isOwner}
                            onSelect={() => setPlanDlg({ id: v.id, name: v.name, planId: '' })}
                          >
                            <Crown className="size-4 text-violet-500" /> Edit plan…
                          </OwnerDropdownItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* generic confirm */}
      <AlertDialog open={!!confirmDlg} onOpenChange={(o) => !o && setConfirmDlg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDlg?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDlg?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(confirmDlg?.confirmLabel === 'Suspend vendor' && 'bg-amber-600 text-white hover:bg-amber-700')}
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                confirmDlg?.run()
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {confirmDlg?.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* reject with reason */}
      <Dialog open={!!rejectDlg} onOpenChange={(o) => !o && setRejectDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject vendor application</DialogTitle>
            <DialogDescription>
              {rejectDlg?.name} will be marked REJECTED and the owner will be notified with your reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={rejectDlg?.reason ?? ''}
            onChange={(e) => setRejectDlg(rejectDlg ? { ...rejectDlg, reason: e.target.value } : null)}
            placeholder="Reason for rejection (shared with the vendor)…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDlg(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => rejectDlg && setVendorStatus(rejectDlg.id, 'REJECTED', rejectDlg.reason)}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Reject vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* commission dialog */}
      <Dialog open={!!commissionDlg} onOpenChange={(o) => !o && setCommissionDlg(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit commission</DialogTitle>
            <DialogDescription>
              Platform commission on {commissionDlg?.name} sales. Leave empty to fall back to the category / platform default.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="vendor-commission">Commission percent (0–100)</Label>
            <Input
              id="vendor-commission"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={commissionDlg?.value ?? ''}
              onChange={(e) => setCommissionDlg(commissionDlg ? { ...commissionDlg, value: e.target.value } : null)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommissionDlg(null)}>
              Cancel
            </Button>
            <Button onClick={saveCommission} disabled={busy} className="bg-orange-600 text-white hover:bg-orange-700">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* plan dialog */}
      <Dialog open={!!planDlg} onOpenChange={(o) => !o && setPlanDlg(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change subscription plan</DialogTitle>
            <DialogDescription>Assign a plan to {planDlg?.name}. Affects listing limits & commission discounts.</DialogDescription>
          </DialogHeader>
          <Select value={planDlg?.planId || undefined} onValueChange={(v) => setPlanDlg(planDlg ? { ...planDlg, planId: v } : null)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {formatINR(p.priceMonthly)}/mo
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDlg(null)}>
              Cancel
            </Button>
            <Button onClick={savePlan} disabled={busy || !planDlg?.planId} className="bg-orange-600 text-white hover:bg-orange-700">
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// AdminProductsSection — GET /api/admin/products
// ============================================================

type AdminProduct = {
  id: string
  title: string
  slug: string
  images: string
  price: number
  mrp: number
  stock: number
  status: string
  sellerType: string
  isFeatured: boolean
  sponsored: boolean
  condition?: string
  refurbGrade?: string | null
  vendor: { id: string; name: string; slug: string } | null
  brand: { id: string; name: string } | null
  category: { id: string; name: string } | null
}

function ProductThumb({ p }: { p: AdminProduct }) {
  const url = parseJson<string[]>(p.images, []).find((u) => !!u)
  if (!url) {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-400">
        <ImageOff className="size-4" />
      </span>
    )
  }
   
  return (
    <img
      src={url}
      alt={p.title}
      className="size-10 shrink-0 rounded-md border border-stone-200 bg-stone-50 object-cover"
      onError={(e) => {
        ;(e.target as HTMLImageElement).style.visibility = 'hidden'
      }}
    />
  )
}

function stockChip(stock: number) {
  if (stock === 0) return 'bg-red-100 text-red-700'
  if (stock <= 10) return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

export function AdminProductsSection({ isOwner }: { isOwner: boolean }) {
  const [items, setItems] = useState<AdminProduct[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [sellerType, setSellerType] = useState('ALL')
  const [vendorSlug, setVendorSlug] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [priceDlg, setPriceDlg] = useState<{ id: string; title: string; price: string; mrp: string; stock: string } | null>(null)
  const [archiveDlg, setArchiveDlg] = useState<AdminProduct | null>(null)
  const [busy, setBusy] = useState(false)

  function fetchProducts(p = page) {
    const q = new URLSearchParams()
    if (search.trim()) q.set('search', search.trim())
    if (status !== 'ALL') q.set('status', status)
    if (sellerType !== 'ALL') q.set('sellerType', sellerType)
    if (vendorSlug.trim()) q.set('vendor', vendorSlug.trim())
    q.set('page', String(p))
    api<{ items: AdminProduct[]; total: number; page: number; pages: number }>(`/api/admin/products?${q.toString()}`).then((res) => {
      if (res.ok && res.data) {
        setItems(res.data.items)
        setTotal(res.data.total)
        setPage(res.data.page)
        setPages(res.data.pages)
      } else {
        toast.error(res.error ?? 'Failed to load products')
      }
      setLoading(false)
    })
  }

  useEffect(() => {
    const t = setTimeout(() => fetchProducts(1), search || vendorSlug ? 300 : 0)
    return () => clearTimeout(t)
     
  }, [search, status, sellerType, vendorSlug])

  function patchProduct(id: string, body: Record<string, unknown>, okMsg: string) {
    setBusy(true)
    api(`/api/admin/products/${id}`, { method: 'PATCH', json: body }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(okMsg)
        fetchProducts()
      } else {
        toast.error(res.error ?? 'Update failed')
      }
    })
  }

  function savePrice() {
    if (!priceDlg) return
    const price = Number(priceDlg.price)
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Invalid price')
      return
    }
    const body: Record<string, unknown> = { price }
    if (priceDlg.mrp) {
      const mrp = Number(priceDlg.mrp)
      if (!Number.isFinite(mrp) || mrp <= 0) {
        toast.error('Invalid MRP')
        return
      }
      body.mrp = mrp
    }
    body.stock = Math.max(0, Math.floor(Number(priceDlg.stock) || 0))
    setPriceDlg(null)
    patchProduct(priceDlg.id, body, 'Product updated')
  }

  function archive(p: AdminProduct) {
    setBusy(true)
    api(`/api/admin/products/${p.id}`, { method: 'DELETE' }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(`"${p.title}" archived`)
        setArchiveDlg(null)
        fetchProducts()
      } else {
        toast.error(res.error ?? 'Archive failed')
      }
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description={`${total} product${total === 1 ? '' : 's'} across platform (1P) and vendors (3P)`}
        actions={
          <Button onClick={() => setAddOpen(true)} className="bg-orange-600 text-white hover:bg-orange-700">
            <Package className="size-4" /> Add Platform Product
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="relative col-span-2 sm:col-span-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title…" className="pl-8" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING_REVIEW">Pending review</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sellerType} onValueChange={setSellerType}>
          <SelectTrigger className="w-full bg-white">
            <SelectValue placeholder="Seller type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sellers</SelectItem>
            <SelectItem value="PLATFORM">Platform (1P)</SelectItem>
            <SelectItem value="VENDOR">Vendor (3P)</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={vendorSlug}
          onChange={(e) => setVendorSlug(e.target.value)}
          placeholder="Vendor slug (optional)"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <Card className="rounded-xl border-stone-200 shadow-sm">
        {loading ? (
          <RowSkeleton rows={8} />
        ) : items.length === 0 ? (
          <EmptyState icon={<PackageX className="size-10" />} title="No products found" hint="Adjust the filters or add a platform product." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1050px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <ProductThumb p={p} />
                        <div className="min-w-0">
                          <p className="max-w-[240px] truncate font-medium text-stone-800" title={p.title}>
                            {p.title}
                          </p>
                          <p className="text-xs text-stone-400">{p.brand?.name ?? p.category?.name ?? '—'}</p>
                          {p.condition === 'REFURBISHED' ? (
                            <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                              ♻ Refurbished{p.refurbGrade ? ` · ${p.refurbGrade.charAt(0)}${p.refurbGrade.slice(1).toLowerCase()}` : ''}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.sellerType === 'PLATFORM' ? (
                        <Badge variant="outline" className="border-stone-300 bg-stone-100 text-[11px] text-stone-700">
                          1P
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[11px] text-violet-700">
                          3P
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-sm text-stone-600">{p.vendor?.name ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <p className="font-semibold text-stone-800">{formatINR2(p.price)}</p>
                      {p.mrp > p.price ? <p className="text-[11px] text-stone-400 line-through">{formatINR(p.mrp)}</p> : null}
                    </TableCell>
                    <TableCell>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', stockChip(p.stock))}>{p.stock}</span>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={p.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Toggle featured"
                          title={p.isFeatured ? 'Un-feature' : 'Feature on homepage'}
                          onClick={() => patchProduct(p.id, { isFeatured: !p.isFeatured }, p.isFeatured ? 'Removed from featured' : 'Marked as featured')}
                          className={cn(
                            'rounded-md p-1.5 transition-colors',
                            p.isFeatured ? 'bg-amber-100 text-amber-600' : 'text-stone-300 hover:bg-stone-100 hover:text-stone-500'
                          )}
                        >
                          <Star className={cn('size-4', p.isFeatured && 'fill-amber-400')} />
                        </button>
                        <button
                          type="button"
                          aria-label="Toggle sponsored"
                          title={p.sponsored ? 'Remove sponsored' : 'Mark sponsored'}
                          onClick={() => patchProduct(p.id, { sponsored: !p.sponsored }, p.sponsored ? 'Sponsorship removed' : 'Marked as sponsored')}
                          className={cn(
                            'rounded-md p-1.5 transition-colors',
                            p.sponsored ? 'bg-violet-100 text-violet-600' : 'text-stone-300 hover:bg-stone-100 hover:text-stone-500'
                          )}
                        >
                          <Megaphone className="size-4" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${p.title}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onSelect={() => setPriceDlg({ id: p.id, title: p.title, price: String(p.price), mrp: String(p.mrp), stock: String(p.stock) })}>
                            <IndianRupee className="size-4" /> Edit price / stock
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {p.status !== 'ARCHIVED' ? (
                            <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onSelect={() => setArchiveDlg(p)}>
                              <PackageX className="size-4" /> Archive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => patchProduct(p.id, { status: 'ACTIVE' }, 'Product restored')}>
                              <RotateCcw className="size-4" /> Restore to active
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!loading && items.length > 0 ? (
          <div className="px-4 pb-3">
            <Pager page={page} pages={pages} onPage={(p) => { setLoading(true); fetchProducts(p) }} />
          </div>
        ) : null}
      </Card>

      <ProductFormDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => fetchProducts(page)} />

      {/* edit price dialog */}
      <Dialog open={!!priceDlg} onOpenChange={(o) => !o && setPriceDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{priceDlg?.title}</DialogTitle>
            <DialogDescription>Update selling price, MRP and stock. Stock changes are logged as manual adjustments.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Price (₹)</Label>
              <Input type="number" min="1" value={priceDlg?.price ?? ''} onChange={(e) => setPriceDlg(priceDlg ? { ...priceDlg, price: e.target.value } : null)} />
            </div>
            <div className="grid gap-1.5">
              <Label>MRP (₹)</Label>
              <Input type="number" min="1" value={priceDlg?.mrp ?? ''} onChange={(e) => setPriceDlg(priceDlg ? { ...priceDlg, mrp: e.target.value } : null)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Stock</Label>
              <Input type="number" min="0" value={priceDlg?.stock ?? ''} onChange={(e) => setPriceDlg(priceDlg ? { ...priceDlg, stock: e.target.value } : null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceDlg(null)}>
              Cancel
            </Button>
            <Button onClick={savePrice} className="bg-orange-600 text-white hover:bg-orange-700">
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* archive confirm */}
      <AlertDialog open={!!archiveDlg} onOpenChange={(o) => !o && setArchiveDlg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{archiveDlg?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Archived products are hidden from the storefront. Order history is preserved. You can restore it to active later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                if (archiveDlg) archive(archiveDlg)
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Archive product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// AdminOrdersSection — GET /api/admin/orders
// ============================================================

type AdminOrder = {
  id: string
  orderNumber: string
  customer: string
  status: string
  paymentStatus: string
  paymentMethod: string
  grandTotal: number
  createdAt: string
  subOrders: { id: string; vendorName: string | null; status: string; itemsTotal: number }[]
}

const ORDER_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED']
const SUB_FLOW = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Payment Pending',
  CONFIRMED: 'Confirmed',
  PARTIALLY_SHIPPED: 'Partially Shipped',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

async function downloadDoc(kind: DocRequestKind, id: string) {
  const res = await openDocument(kind, id)
  if (!res.ok) toast.error(res.error ?? 'Could not generate the document')
}

export function AdminOrdersSection() {
  const [items, setItems] = useState<AdminOrder[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [vendorId, setVendorId] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([])

  const [expanded, setExpanded] = useState<string | null>(null)
  const [subDlg, setSubDlg] = useState<{
    subId: string
    orderNumber: string
    vendorLabel: string
    current: string
    next: string
    courierName: string
    trackingNumber: string
  } | null>(null)
  const [cancelDlg, setCancelDlg] = useState<AdminOrder | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<{ items: { id: string; name: string }[] }>('/api/admin/vendors').then((res) => {
      if (res.ok && res.data) setVendors(res.data.items.map((v) => ({ id: v.id, name: v.name })))
    })
  }, [])

  function fetchOrders(p = page) {
    const q = new URLSearchParams()
    if (status !== 'ALL') q.set('status', status)
    if (search.trim()) q.set('search', search.trim())
    if (vendorId !== 'ALL') q.set('vendor', vendorId)
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    q.set('page', String(p))
    api<{ items: AdminOrder[]; total: number; page: number; pages: number }>(`/api/admin/orders?${q.toString()}`).then((res) => {
      if (res.ok && res.data) {
        setItems(res.data.items)
        setTotal(res.data.total)
        setPage(res.data.page)
        setPages(res.data.pages)
      } else {
        toast.error(res.error ?? 'Failed to load orders')
      }
      setLoading(false)
    })
  }

  useEffect(() => {
    const t = setTimeout(() => fetchOrders(1), search ? 300 : 0)
    return () => clearTimeout(t)
     
  }, [status, search, vendorId, from, to])

  const nextStatuses = useMemo(() => {
    if (!subDlg) return []
    const cur = SUB_FLOW.indexOf(subDlg.current)
    if (cur < 0) return []
    return SUB_FLOW.slice(cur + 1)
  }, [subDlg])

  function submitSubStatus() {
    if (!subDlg) return
    const body: Record<string, unknown> = { status: subDlg.next }
    if (subDlg.next === 'SHIPPED') {
      if (subDlg.courierName.trim()) body.courierName = subDlg.courierName.trim()
      if (subDlg.trackingNumber.trim()) body.trackingNumber = subDlg.trackingNumber.trim()
    }
    setBusy(true)
    api(`/api/admin/suborders/${subDlg.subId}/status`, { method: 'POST', json: body }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(`${subDlg.vendorLabel} → ${subDlg.next.toLowerCase()}`)
        setSubDlg(null)
        fetchOrders()
      } else {
        toast.error(res.error ?? 'Status update failed')
      }
    })
  }

  function forceCancel(o: AdminOrder) {
    setBusy(true)
    api(`/api/admin/orders/${o.id}/cancel`, { method: 'POST', json: {} }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(`Order ${o.orderNumber} cancelled`)
        setCancelDlg(null)
        fetchOrders()
      } else {
        toast.error(res.error ?? 'Cancel failed')
      }
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Orders" description={`${total} order${total === 1 ? '' : 's'} across the platform`} />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_LABELS[s] ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative col-span-2">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order number or customer…" className="pl-8" />
        </div>
        <Select value={vendorId} onValueChange={setVendorId}>
          <SelectTrigger className="w-full bg-white">
            <SelectValue placeholder="Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All vendors</SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="bg-white" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="bg-white" />
      </div>

      <Card className="rounded-xl border-stone-200 shadow-sm">
        {loading ? (
          <RowSkeleton rows={8} />
        ) : items.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="size-10" />} title="No orders found" hint="Try widening the date range or clearing filters." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead className="w-8" />
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((o) => {
                  const open = expanded === o.id
                  const cancellable = o.status === 'CONFIRMED' || o.status === 'PENDING_PAYMENT'
                  return (
                    <Fragment key={o.id}>
                      <TableRow className={cn(open && 'bg-orange-50/40')}>
                        <TableCell>
                          <button
                            type="button"
                            aria-label={open ? 'Collapse sub-orders' : 'Expand sub-orders'}
                            onClick={() => setExpanded(open ? null : o.id)}
                            className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                          >
                            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold">{o.orderNumber}</TableCell>
                        <TableCell className="max-w-[140px] truncate">{o.customer}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-stone-600">{o.paymentMethod}</span>
                            <StatusChip status={o.paymentStatus} label={PAYMENT_STATUS_LABEL[o.paymentStatus] ?? o.paymentStatus} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatINR2(o.grandTotal)}</TableCell>
                        <TableCell>
                          <StatusChip status={o.status} label={ORDER_STATUS_LABELS[o.status] ?? o.status} />
                        </TableCell>
                        <TableCell className="text-xs text-stone-500">{formatDate(o.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={!cancellable}
                            title={cancellable ? 'Force cancel this order' : 'Only confirmed / pending-payment orders can be cancelled'}
                            onClick={() => setCancelDlg(o)}
                          >
                            <X className="size-3.5" /> Force cancel
                          </Button>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow key={`${o.id}-sub`} className="hover:bg-transparent">
                          <TableCell colSpan={8} className="bg-stone-50/60 p-0">
                            <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-3 pt-3 pb-2">
                              <span className="text-[11px] font-medium text-stone-500">Documents:</span>
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => downloadDoc('invoice', o.id)}>
                                <Download className="size-3" /> {o.paymentStatus === 'PAID' ? 'Tax Invoice' : 'Invoice'}
                              </Button>
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => downloadDoc('proforma', o.id)}>
                                <Download className="size-3" /> Proforma
                              </Button>
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => downloadDoc('purchase-return', o.id)}>
                                <Download className="size-3" /> Purchase Return
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2 p-3">
                              {o.subOrders.length === 0 ? (
                                <p className="text-xs text-stone-400">No sub-orders</p>
                              ) : null}
                              {o.subOrders.map((so) => (
                                <div key={so.id} className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="max-w-[200px] truncate text-sm font-medium text-stone-800">
                                      {so.vendorName ?? 'Platform (1P)'}
                                    </p>
                                    <p className="text-xs text-stone-400">{formatINR2(so.itemsTotal)} items value</p>
                                  </div>
                                  <StatusChip status={so.status} />
                                  {so.vendorName ? (
                                    <>
                                      <Button variant="outline" size="sm" className="h-7 text-xs" title="Purchase order to vendor" onClick={() => downloadDoc('vendor-po', so.id)}>
                                        <Download className="size-3" /> PO
                                      </Button>
                                      <Button variant="outline" size="sm" className="h-7 text-xs" title="Purchase return to vendor" onClick={() => downloadDoc('vendor-return', so.id)}>
                                        <Download className="size-3" /> Return
                                      </Button>
                                    </>
                                  ) : null}
                                  {so.status !== 'CANCELLED' && so.status !== 'DELIVERED' ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() =>
                                        setSubDlg({
                                          subId: so.id,
                                          orderNumber: o.orderNumber,
                                          vendorLabel: so.vendorName ?? 'Platform (1P)',
                                          current: so.status,
                                          next: '',
                                          courierName: '',
                                          trackingNumber: '',
                                        })
                                      }
                                    >
                                      Update status
                                    </Button>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {!loading && items.length > 0 ? (
          <div className="px-4 pb-3">
            <Pager page={page} pages={pages} onPage={(p) => { setLoading(true); fetchOrders(p) }} />
          </div>
        ) : null}
      </Card>

      {/* sub-order status dialog */}
      <Dialog open={!!subDlg} onOpenChange={(o) => !o && setSubDlg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update sub-order status</DialogTitle>
            <DialogDescription>
              {subDlg?.vendorLabel} on order {subDlg?.orderNumber}. Currently{' '}
              <StatusChip status={subDlg?.current ?? ''} className="align-middle" /> — status moves forward only.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>New status</Label>
              <Select value={subDlg?.next || undefined} onValueChange={(v) => setSubDlg(subDlg ? { ...subDlg, next: v } : null)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select next status" />
                </SelectTrigger>
                <SelectContent>
                  {nextStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ORDER_STATUS_LABELS[s] ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {subDlg?.next === 'SHIPPED' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Courier name</Label>
                  <Input
                    value={subDlg.courierName}
                    onChange={(e) => setSubDlg({ ...subDlg, courierName: e.target.value })}
                    placeholder="Lastrivon Express (auto)"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Tracking number</Label>
                  <Input
                    value={subDlg.trackingNumber}
                    onChange={(e) => setSubDlg({ ...subDlg, trackingNumber: e.target.value })}
                    placeholder="Auto-generated if empty"
                  />
                </div>
              </div>
            ) : null}
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              The customer is notified automatically and the parent order status is recalculated.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDlg(null)}>
              Cancel
            </Button>
            <Button onClick={submitSubStatus} disabled={busy || !subDlg?.next} className="bg-orange-600 text-white hover:bg-orange-700">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Update status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* force cancel */}
      <AlertDialog open={!!cancelDlg} onOpenChange={(o) => !o && setCancelDlg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force cancel {cancelDlg?.orderNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              Restocks items + refunds if paid. All sub-orders will be cancelled, stock returned and the customer notified. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                if (cancelDlg) forceCancel(cancelDlg)
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Force cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// ReturnsSection — GET /api/admin/returns?status
// ============================================================

type AdminReturn = {
  id: string
  status: string
  reason: string
  comment: string | null
  refundAmount: number
  createdAt: string
  orderItem: {
    id: string
    titleSnapshot: string
    imageSnapshot: string
    qty: number
    effectiveTotal: number
    itemStatus: string
    orderNumber: string
    vendor: string | null
    customer: string
  }
}

const RETURN_CHIPS = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'REJECTED', label: 'Rejected' },
]

export function ReturnsSection() {
  const [items, setItems] = useState<AdminReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [approveDlg, setApproveDlg] = useState<AdminReturn | null>(null)
  const [rejectDlg, setRejectDlg] = useState<AdminReturn | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const q = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`
    api<{ items: AdminReturn[] }>(`/api/admin/returns${q}`).then((res) => {
      if (res.ok && res.data) setItems(res.data.items)
      else toast.error(res.error ?? 'Failed to load returns')
      setLoading(false)
    })
  }, [statusFilter])

  function resolve(rr: AdminReturn, action: 'APPROVED' | 'REJECTED') {
    setBusy(true)
    api(`/api/admin/returns/${rr.id}`, { method: 'POST', json: { action } }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(action === 'APPROVED' ? 'Return approved — refund initiated' : 'Return rejected')
        setApproveDlg(null)
        setRejectDlg(null)
        setItems((prev) => prev.filter((r) => r.id !== rr.id))
      } else {
        toast.error(res.error ?? 'Failed to resolve return')
      }
    })
  }

  const pendingCount = items.filter((r) => r.status === 'PENDING').length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Returns"
        description={pendingCount > 0 ? `${pendingCount} return request${pendingCount === 1 ? '' : 's'} awaiting decision` : 'Customer return requests'}
      />

      <Chips options={RETURN_CHIPS} value={statusFilter} onChange={setStatusFilter} />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="rounded-xl border-stone-200 shadow-sm">
          <EmptyState icon={<RotateCcw className="size-10" />} title="No return requests" hint="Returns raised by customers for delivered items will appear here." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((rr) => {
            const refund = rr.refundAmount && rr.refundAmount > 0 ? rr.refundAmount : rr.orderItem.effectiveTotal
            return (
              <Card key={rr.id} className="rounded-xl border-stone-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-stone-800" title={rr.orderItem.titleSnapshot}>
                        {rr.orderItem.titleSnapshot}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-400">
                        <span className="font-mono">{rr.orderItem.orderNumber}</span> · {rr.orderItem.vendor ?? 'Platform (1P)'}
                      </p>
                    </div>
                    <StatusChip status={rr.status} />
                  </div>

                  <div className="mt-3 rounded-lg bg-stone-50 p-2.5 text-xs">
                    <p>
                      <span className="font-medium text-stone-600">Reason:</span>{' '}
                      <span className="text-stone-700">{rr.reason.replaceAll('_', ' ').toLowerCase()}</span>
                    </p>
                    {rr.comment ? (
                      <p className="mt-1 text-stone-500">
                        <span className="font-medium text-stone-600">Comment:</span> {rr.comment}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                    <span>
                      {rr.orderItem.customer} · {formatDateTime(rr.createdAt)}
                    </span>
                    <span className="font-semibold text-stone-700">
                      {formatINR2(refund)} refund · qty {rr.orderItem.qty}
                    </span>
                  </div>

                  {rr.status === 'PENDING' ? (
                    <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3">
                      <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setApproveDlg(rr)}>
                        <BadgeCheck className="size-4" /> Approve refund
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setRejectDlg(rr)}
                      >
                        <X className="size-4" /> Reject
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* approve confirm */}
      <AlertDialog open={!!approveDlg} onOpenChange={(o) => !o && setApproveDlg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve return & refund?</AlertDialogTitle>
            <AlertDialogDescription>
              A refund of{' '}
              <span className="font-semibold text-stone-900">
                {formatINR2(
                  approveDlg ? (approveDlg.refundAmount && approveDlg.refundAmount > 0 ? approveDlg.refundAmount : approveDlg.orderItem.effectiveTotal) : 0
                )}
              </span>{' '}
              for "{approveDlg?.orderItem.titleSnapshot}" will be issued to {approveDlg?.orderItem.customer}. The vendor ledger is
              debited automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                if (approveDlg) resolve(approveDlg, 'APPROVED')
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Approve & refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* reject confirm */}
      <AlertDialog open={!!rejectDlg} onOpenChange={(o) => !o && setRejectDlg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject return request?</AlertDialogTitle>
            <AlertDialogDescription>
              "{rejectDlg?.orderItem.titleSnapshot}" will remain delivered and {rejectDlg?.orderItem.customer} will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                if (rejectDlg) resolve(rejectDlg, 'REJECTED')
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Reject return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
