'use client'
//
// AdminApp — full-page platform admin panel (no storefront chrome).
// Auth gate: PLATFORM_ADMIN (Owner) / PLATFORM_STAFF (Staff, read-only on owner-only mutations).
//

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown,
  Crown,
  ExternalLink,
  FileText,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Package,
  RotateCcw,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingCart,
  Store,
  TicketPercent,
  Users,
  Wallet,
  Recycle,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
import { DashboardSection, VendorsSection, AdminProductsSection, AdminOrdersSection, ReturnsSection } from './sections'
import {
  CatalogSection,
  CouponsSection,
  BannersSection,
  PlansSection,
  SettlementsSection,
  CustomersSection,
  ReportsSection,
  AuditSection,
  SettingsSection,
} from './sections2'
import { AdminQuotesSection } from './quotes'
import { AdminEwasteSection } from './ewaste'
import { initials } from './forms'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'vendors', label: 'Vendors', icon: Store },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'quotes', label: 'Quotes / B2B', icon: FileText },
  { id: 'ewaste', label: 'E-Waste', icon: Recycle },
  { id: 'catalog', label: 'Catalog', icon: FolderTree },
  { id: 'coupons', label: 'Coupons', icon: TicketPercent },
  { id: 'banners', label: 'Banners', icon: ImageIcon },
  { id: 'plans', label: 'Plans', icon: Crown },
  { id: 'settlements', label: 'Settlements', icon: Wallet },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'audit', label: 'Audit', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
] as const

type TabId = (typeof TABS)[number]['id']

function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-stone-100/60">
      <div className="flex">
        <div className="hidden w-60 shrink-0 border-r border-stone-200 bg-stone-50 p-3 md:block">
          <Skeleton className="mb-4 h-9 w-40" />
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-9 w-full rounded-lg" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-4 md:px-6">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-9 w-36 rounded-full" />
          </div>
          <div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
            <Skeleton className="h-9 w-64" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminApp() {
  const user = useAppStore((s) => s.user)
  const authLoading = useAppStore((s) => s.authLoading)
  const navigate = useAppStore((s) => s.navigate)
  const logout = useAppStore((s) => s.logout)
  const siteName = useAppStore((s) => s.settings?.siteName ?? 'Lastrivon Kart India')

  const [activeTab, setActiveTab] = useState<TabId>('dashboard')

  const isAdminRole = !!user && (user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_STAFF')
  const isOwner = user?.role === 'PLATFORM_ADMIN'

  // Auth gate
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('auth', { redirect: 'admin-panel' })
      return
    }
    if (user.role !== 'PLATFORM_ADMIN' && user.role !== 'PLATFORM_STAFF') {
      toast.error('Admin access required')
      navigate('home')
    }
  }, [user, authLoading, navigate])

  if (authLoading || !isAdminRole) return <AdminSkeleton />

  const jumpTo = (tab: string) => {
    setActiveTab(tab as TabId)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  return (
    <div className="min-h-screen bg-stone-100/60">
      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-stone-200 bg-stone-50 md:flex">
          <div className="flex h-16 items-center gap-2.5 border-b border-stone-200 px-5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-orange-600 text-white shadow-sm">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-stone-900">{siteName}</p>
              <p className="text-[11px] leading-tight text-stone-400">Platform Console</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin sections">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = activeTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => jumpTo(t.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-orange-600 font-medium text-white shadow-sm'
                      : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
                  )}
                >
                  <Icon className={cn('size-4', active ? 'text-white' : 'text-stone-400')} />
                  {t.label}
                </button>
              )
            })}
          </nav>
          <div className="border-t border-stone-200 p-3">
            <button
              type="button"
              onClick={() => navigate('home')}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 hover:bg-stone-200/60 hover:text-stone-800"
            >
              <ExternalLink className="size-4" /> View Storefront
            </button>
          </div>
        </aside>

        {/* Content column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-white shadow-sm md:hidden">
                  <ShieldCheck className="size-5" />
                </span>
                <div className="min-w-0">
                  <h1 className="flex items-center gap-2 text-base font-bold leading-tight text-stone-900">
                    Admin Panel
                    <Badge
                      variant="outline"
                      className={cn(
                        'hidden text-[11px] sm:inline-flex',
                        isOwner ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-stone-300 bg-stone-100 text-stone-600'
                      )}
                    >
                      {isOwner ? 'Owner' : 'Staff'}
                    </Badge>
                  </h1>
                  <p className="truncate text-[11px] leading-tight text-stone-400">{siteName} · Marketplace operations</p>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1 pl-1 pr-2.5 transition-colors hover:bg-stone-50"
                    aria-label="Account menu"
                  >
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-orange-100 text-xs font-bold text-orange-700">
                        {initials(user?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[140px] truncate text-sm font-medium text-stone-700 sm:block">{user?.name}</span>
                    <ChevronDown className="size-4 text-stone-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <p className="text-sm font-medium text-stone-800">{user?.name}</p>
                    <p className="truncate text-xs font-normal text-stone-500">{user?.email}</p>
                    <p className="mt-1 inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                      {isOwner ? 'Platform Owner' : 'Platform Staff'}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('home')}>
                    <ExternalLink className="size-4" /> View Storefront
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:bg-red-50 focus:text-red-600"
                    onClick={() => {
                      void logout().then(() => navigate('home'))
                    }}
                  >
                    <LogOut className="size-4" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile tab bar */}
            <nav
              className="flex gap-1.5 overflow-x-auto border-t border-stone-100 px-3 py-2 md:hidden"
              aria-label="Admin sections"
            >
              {TABS.map((t) => {
                const active = activeTab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => jumpTo(t.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      active ? 'bg-orange-600 text-white' : 'border border-stone-200 bg-white text-stone-600'
                    )}
                  >
                    {t.label}
                  </button>
                )
              })}
            </nav>
          </header>

          {/* Section body */}
          <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-6">
            {activeTab === 'dashboard' && <DashboardSection onNavigate={jumpTo} />}
            {activeTab === 'vendors' && <VendorsSection isOwner={isOwner} />}
            {activeTab === 'products' && <AdminProductsSection isOwner={isOwner} />}
            {activeTab === 'orders' && <AdminOrdersSection />}
            {activeTab === 'returns' && <ReturnsSection />}
            {activeTab === 'quotes' && <AdminQuotesSection />}
            {activeTab === 'ewaste' && <AdminEwasteSection />}
            {activeTab === 'catalog' && <CatalogSection />}
            {activeTab === 'coupons' && <CouponsSection />}
            {activeTab === 'banners' && <BannersSection />}
            {activeTab === 'plans' && <PlansSection isOwner={isOwner} />}
            {activeTab === 'settlements' && <SettlementsSection isOwner={isOwner} />}
            {activeTab === 'customers' && <CustomersSection />}
            {activeTab === 'reports' && <ReportsSection />}
            {activeTab === 'audit' && <AuditSection />}
            {activeTab === 'settings' && <SettingsSection isOwner={isOwner} />}
          </main>

          <footer className="mt-auto px-4 pb-4 pt-2 text-center text-[11px] text-stone-400 md:px-6">
            {siteName} Admin · {TABS.length} sections · Owner & staff roles enforced server-side
          </footer>
        </div>
      </div>
    </div>
  )
}
