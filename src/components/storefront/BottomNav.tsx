'use client'

import { Heart, Home, LayoutGrid, Package, ShoppingBag, type LucideIcon } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

type NavItem = {
  key: string
  label: string
  icon: LucideIcon
  active: boolean
  badge?: number
  go: () => void
}

export default function BottomNav() {
  const view = useAppStore((s) => s.view)
  const navigate = useAppStore((s) => s.navigate)
  const cartCount = useAppStore((s) => s.cartCount)
  const wishlistIds = useAppStore((s) => s.wishlistIds)
  const user = useAppStore((s) => s.user)

  /* wishlist requires login in this app — guests always see 0 */
  const wishlistCount = user ? wishlistIds.length : 0

  const items: NavItem[] = [
    {
      key: 'home',
      label: 'Home',
      icon: Home,
      active: view === 'home',
      go: () => navigate('home'),
    },
    {
      key: 'shop',
      label: 'Shop',
      icon: LayoutGrid,
      active: view === 'listing' || view === 'product' || view === 'vendor',
      go: () => navigate('listing', {}),
    },
    {
      key: 'wishlist',
      label: 'Wishlist',
      icon: Heart,
      active: view === 'wishlist',
      badge: wishlistCount > 0 ? wishlistCount : undefined,
      go: () => navigate('wishlist'),
    },
    {
      key: 'orders',
      label: 'Orders',
      icon: Package,
      active: view === 'orders' || view === 'order-detail',
      go: () => navigate('orders'),
    },
    {
      key: 'cart',
      label: 'Cart',
      icon: ShoppingBag,
      active: view === 'cart' || view === 'checkout',
      badge: cartCount > 0 ? cartCount : undefined,
      go: () => navigate('cart'),
    },
  ]

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.go}
              aria-label={item.label}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'relative flex h-16 flex-col items-center justify-center gap-0.5 transition-colors',
                item.active ? 'text-orange-600' : 'text-stone-500'
              )}
            >
              {item.active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-orange-600"
                />
              )}
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute right-[22%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
