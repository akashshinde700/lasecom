'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Clock,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Package,
  RotateCcw,
  ShieldAlert,
  ShoppingCart,
  Store as StoreIcon,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DashboardSection,
  FinanceSection,
  OrdersSection,
  ProductsSection,
  ReturnsSection,
  StaffSection,
  StoreSection,
  type VendorDashboard,
} from './sections'

// ============================================================
// Nav + banner
// ============================================================

type TabId = 'dashboard' | 'products' | 'orders' | 'returns' | 'finance' | 'staff' | 'store'

const NAV: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'store', label: 'Store Settings', icon: StoreIcon },
]

const BANNER_META: Record<string, { cls: string; icon: LucideIcon; text: string }> = {
  PENDING: {
    cls: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: Clock,
    text: 'Your store is awaiting platform approval. You can set up products, but they stay hidden from shoppers until approved.',
  },
  SUSPENDED: {
    cls: 'border-red-200 bg-red-50 text-red-800',
    icon: ShieldAlert,
    text: 'Your store is suspended. Contact platform support to restore your account.',
  },
  REJECTED: {
    cls: 'border-red-200 bg-red-50 text-red-800',
    icon: XCircle,
    text: 'Application rejected. Contact platform support for details.',
  },
}

function StatusBanner({ status }: { status: string }) {
  const meta = BANNER_META[status]
  if (!meta) return null
  const Icon = meta.icon
  return (
    <div role="alert" className={cn('flex items-start gap-2.5 rounded-xl border p-3.5 text-sm font-medium', meta.cls)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{meta.text}</span>
    </div>
  )
}

function VendorSkeleton() {
  return (
    <div className="min-h-screen bg-stone-100/60">
      <div className="h-14 border-b bg-white" />
      <div className="flex">
        <div className="hidden w-56 space-y-2 border-r bg-stone-50 p-3 lg:block">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-lg" />
          ))}
        </div>
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-7 w-48" />
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// VendorApp
// ============================================================

export default function VendorApp() {
  const user = useAppStore((s) => s.user)
  const authLoading = useAppStore((s) => s.authLoading)
  const navigate = useAppStore((s) => s.navigate)
  const logout = useAppStore((s) => s.logout)

  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [dash, setDash] = useState<VendorDashboard | null>(null)
  const [dashLoading, setDashLoading] = useState(true)
  const [dashError, setDashError] = useState('')
  const [dashVersion, setDashVersion] = useState(0)

  const isVendor = !!user && (user.role === 'VENDOR_ADMIN' || user.role === 'VENDOR_STAFF')
  const isOwner = user?.role === 'VENDOR_ADMIN'
  const staffRole = user?.staffRole ?? null

  useEffect(() => {
    document.title = 'Vendor Panel — Lastrivon Kart India'
  }, [])

  // Auth gate
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      toast.error('Please sign in to access the vendor panel')
      navigate('auth', { redirect: 'vendor-panel' })
    } else if (!isVendor) {
      toast.error('Vendor access required')
      navigate('home')
    }
  }, [authLoading, user, isVendor, navigate])

  const refreshDash = useCallback(() => setDashVersion((v) => v + 1), [])

  useEffect(() => {
    if (!isVendor) return
    api<VendorDashboard>('/api/vendor/dashboard').then((res) => {
      if (res.ok && res.data) {
        setDash(res.data)
        setDashError('')
      } else {
        setDashError(res.error ?? 'Failed to load dashboard')
      }
      setDashLoading(false)
    })
  }, [isVendor, dashVersion])

  async function handleLogout() {
    await logout()
    toast.success('Logged out. See you soon!')
    navigate('home')
  }

  if (authLoading || !isVendor) return <VendorSkeleton />

  const vendorName = dash?.vendor.name ?? user.vendor?.name ?? 'Vendor Store'
  const bannerStatus = dash?.vendor.status ?? user.vendor?.status ?? 'ACTIVE'
  const isBlockedVendor = bannerStatus === 'SUSPENDED' || bannerStatus === 'REJECTED'
  const isActiveVendor = bannerStatus === 'ACTIVE'
  const canEditProducts = !isBlockedVendor && (isOwner || staffRole === 'PRODUCT_MANAGER')
  const canAdjustStock =
    !isBlockedVendor && (isOwner || staffRole === 'PRODUCT_MANAGER' || staffRole === 'INVENTORY_MANAGER')
  const canManageOrders = isActiveVendor && (isOwner || staffRole === 'ORDER_MANAGER')
  const canManageReturns = isActiveVendor && (isOwner || staffRole === 'ORDER_MANAGER')
  const canViewFinance = isOwner || staffRole === 'ACCOUNTANT'
  const visibleNav = NAV.filter((item) => {
    if (item.id === 'finance') return canViewFinance
    if (item.id === 'staff' || item.id === 'store') return isOwner
    return true
  })
  const currentTab: TabId = visibleNav.some((item) => item.id === activeTab) ? activeTab : 'dashboard'
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex min-h-screen flex-col bg-stone-100/60">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-white">
              <StoreIcon className="h-4 w-4" aria-hidden />
            </div>
            <span className="whitespace-nowrap font-semibold text-stone-900">Vendor Panel</span>
            <span className="hidden max-w-[200px] truncate rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 sm:inline-block">
              {vendorName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => navigate('home')}>
              <ExternalLink /> View Storefront
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => navigate('home')}
              aria-label="Back to storefront"
            >
              <ExternalLink />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2" aria-label="Account menu">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-600">
                    {initials}
                  </span>
                  <span className="hidden max-w-[120px] truncate md:inline">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs font-normal text-stone-500">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('home')}>
                  <StoreIcon className="h-4 w-4" aria-hidden /> Back to Shopping
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:bg-red-50 focus:text-red-600"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r bg-stone-50 p-3 lg:flex">
          {visibleNav.map((item) => {
            const active = currentTab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-orange-100 text-orange-700'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden /> {item.label}
              </button>
            )
          })}
          <div className="mt-auto px-3 pb-1 text-[11px] text-stone-400">
            {dash?.vendor.plan ? `${dash.vendor.plan.name} plan` : 'Lastrivon Kart Vendor'}
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          {/* Mobile tab row */}
          <nav
            aria-label="Vendor panel sections"
            className="overflow-x-auto border-b bg-white lg:hidden"
          >
            <div className="flex gap-1 px-3 py-2">
              {visibleNav.map((item) => {
                const active = currentTab === item.id
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      active ? 'bg-orange-100 text-orange-700' : 'bg-stone-100 text-stone-600'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden /> {item.label}
                  </button>
                )
              })}
            </div>
          </nav>

          <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
            {bannerStatus !== 'ACTIVE' && <StatusBanner status={bannerStatus} />}

            {currentTab === 'dashboard' && (
              <DashboardSection
                data={dash}
                loading={dashLoading}
                error={dashError}
                onRetry={refreshDash}
                onGotoProducts={() => setActiveTab('products')}
                readOnly={!canEditProducts}
              />
            )}
            {currentTab === 'products' && (
              <ProductsSection
                dash={dash}
                readOnly={!canEditProducts}
                canAdjustStock={canAdjustStock}
                onDashChanged={refreshDash}
              />
            )}
            {currentTab === 'orders' && (
              <OrdersSection readOnly={!canManageOrders} onDashChanged={refreshDash} />
            )}
            {currentTab === 'returns' && (
              <ReturnsSection readOnly={!canManageReturns} onDashChanged={refreshDash} />
            )}
            {currentTab === 'finance' && canViewFinance && <FinanceSection />}
            {currentTab === 'staff' && isOwner && <StaffSection readOnly={isBlockedVendor} />}
            {currentTab === 'store' && isOwner && (
              <StoreSection dash={dash} readOnly={isBlockedVendor} onSaved={refreshDash} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
