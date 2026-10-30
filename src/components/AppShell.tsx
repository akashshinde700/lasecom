'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useAppStore, buildHash, parseHash } from '@/lib/store'
import { Skeleton } from '@/components/ui/skeleton'

// Storefront
import Header from '@/components/storefront/Header'
import Footer from '@/components/storefront/Footer'
import BottomNav from '@/components/storefront/BottomNav'
import ScrollTop from '@/components/storefront/ScrollTop'

// All views are client-only (zustand persist + browser APIs)
const HomePage = dynamic(() => import('@/components/storefront/HomePage'), { ssr: false, loading: () => <PageSkeleton /> })
const ProductListing = dynamic(() => import('@/components/storefront/ProductListing'), { ssr: false, loading: () => <PageSkeleton /> })
const ProductDetail = dynamic(() => import('@/components/storefront/ProductDetail'), { ssr: false, loading: () => <PageSkeleton /> })
const VendorStore = dynamic(() => import('@/components/storefront/VendorStore'), { ssr: false, loading: () => <PageSkeleton /> })

const AuthView = dynamic(() => import('@/components/shop/AuthView'), { ssr: false, loading: () => <PageSkeleton /> })
const CartView = dynamic(() => import('@/components/shop/CartView'), { ssr: false, loading: () => <PageSkeleton /> })
const CheckoutView = dynamic(() => import('@/components/shop/CheckoutView'), { ssr: false, loading: () => <PageSkeleton /> })
const OrderSuccessView = dynamic(() => import('@/components/shop/OrderSuccessView'), { ssr: false, loading: () => <PageSkeleton /> })
const OrdersView = dynamic(() => import('@/components/shop/OrdersView'), { ssr: false, loading: () => <PageSkeleton /> })
const OrderDetailView = dynamic(() => import('@/components/shop/OrderDetailView'), { ssr: false, loading: () => <PageSkeleton /> })
const WishlistView = dynamic(() => import('@/components/shop/WishlistView'), { ssr: false, loading: () => <PageSkeleton /> })
const AccountView = dynamic(() => import('@/components/shop/AccountView'), { ssr: false, loading: () => <PageSkeleton /> })
const StaticView = dynamic(() => import('@/components/shop/StaticView'), { ssr: false, loading: () => <PageSkeleton /> })
const NotificationsView = dynamic(() => import('@/components/shop/NotificationsView'), { ssr: false, loading: () => <PageSkeleton /> })
const QuoteView = dynamic(() => import('@/components/shop/QuoteView'), { ssr: false, loading: () => <PageSkeleton /> })
const EwasteView = dynamic(() => import('@/components/shop/EwasteView'), { ssr: false, loading: () => <PageSkeleton /> })
const B2BView = dynamic(() => import('@/components/shop/B2BView'), { ssr: false, loading: () => <PageSkeleton /> })
const AssistantChat = dynamic(() => import('@/components/shop/AssistantChat'), { ssr: false })

const VendorApp = dynamic(() => import('@/components/vendor/VendorApp'), { ssr: false, loading: () => <PageSkeleton /> })
const AdminApp = dynamic(() => import('@/components/admin/AdminApp'), { ssr: false, loading: () => <PageSkeleton /> })

function PageSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-10 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function isPanel(view: string) {
  return view === 'vendor-panel' || view === 'admin-panel'
}

export default function AppShell() {
  const view = useAppStore((s) => s.view)
  const refreshMe = useAppStore((s) => s.refreshMe)
  const syncFromHash = useAppStore((s) => s.syncFromHash)

  useEffect(() => {
    refreshMe()
  }, [refreshMe])

  /* ---- browser back/forward support (hash-based history) ---- */
  useEffect(() => {
    // First load: honour a deep link like #/product?slug=... , else write the
    // current view into the URL so the back button has a baseline entry.
    const initial = parseHash(window.location.hash)
    if (initial) {
      useAppStore.setState({ view: initial.view, params: initial.params })
    } else if (!window.location.hash) {
      history.replaceState(null, '', buildHash(useAppStore.getState().view, useAppStore.getState().params))
    }
    const onPopState = () => {
      syncFromHash()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [syncFromHash])

  if (isPanel(view)) {
    return (
      <div className="min-h-screen bg-background">
        {view === 'vendor-panel' ? <VendorApp /> : <AdminApp />}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
      <Header />
      <main key={view} className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {view === 'home' && <HomePage />}
        {view === 'listing' && <ProductListing />}
        {view === 'product' && <ProductDetail />}
        {view === 'vendor' && <VendorStore />}
        {view === 'auth' && <AuthView />}
        {view === 'cart' && <CartView />}
        {view === 'checkout' && <CheckoutView />}
        {view === 'order-success' && <OrderSuccessView />}
        {view === 'orders' && <OrdersView />}
        {view === 'order-detail' && <OrderDetailView />}
        {view === 'wishlist' && <WishlistView />}
        {view === 'account' && <AccountView />}
        {view === 'notifications' && <NotificationsView />}
        {view === 'static' && <StaticView />}
        {view === 'quote' && <QuoteView />}
        {view === 'b2b' && <B2BView />}
        {view === 'ewaste' && <EwasteView />}
      </main>
      <Footer />
      <BottomNav />
      <ScrollTop />
      <AssistantChat />
    </div>
  )
}
