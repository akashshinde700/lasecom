'use client'

import { useEffect, useState } from 'react'
import { MapPin, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore, api } from '@/lib/store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Cat = { id: string; name: string; slug: string }

const HELP_LINKS: { label: string; page: string }[] = [
  { label: 'About Us', page: 'about' },
  { label: 'Contact Us', page: 'contact' },
  { label: 'FAQ', page: 'faq' },
  { label: 'Shipping Policy', page: 'shipping' },
  { label: 'Returns & Refunds', page: 'returns' },
  { label: 'Privacy Policy', page: 'privacy' },
  { label: 'Terms & Conditions', page: 'terms' },
  { label: 'Get the App', page: 'app' },
]

const PAYMENT_METHODS = ['Razorpay', 'UPI', 'Cards', 'NetBanking', 'COD']

export default function Footer() {
  const navigate = useAppStore((s) => s.navigate)
  const settings = useAppStore((s) => s.settings)
  const [categories, setCategories] = useState<Cat[]>([])
  const [email, setEmail] = useState('')
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/categories', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j.ok) setCategories((j.data as Cat[]).slice(0, 8))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const siteName = settings?.siteName ?? 'Lastrivon Kart India'

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (subscribing) return
    setSubscribing(true)
    const res = await api<{ already: boolean }>('/api/newsletter', {
      method: 'POST',
      json: { email: email.trim() },
    })
    setSubscribing(false)
    if (res.ok) {
      toast.success(
        res.data?.already
          ? "You're already subscribed — see you in your inbox!"
          : 'Subscribed! Welcome to the deals club 🎉'
      )
      setEmail('')
    } else {
      toast.error(res.error ?? 'Subscription failed')
    }
  }

  return (
    <footer className="mt-auto border-t border-stone-800 bg-stone-900 text-stone-300">
      <div className="container mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {/* brand */}
          <div className="col-span-2 lg:col-span-1">
            <p className="flex items-center gap-1.5 text-xl font-extrabold text-orange-500">
              🛍️ {siteName}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-400">
              India&apos;s trusted multi-vendor marketplace — shop genuine products from thousands of
              sellers and platform-owned stores.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-stone-400">
              <MapPin className="h-3.5 w-3.5 text-orange-500" /> Serving all of India
            </p>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                100% Secure Payments
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <span
                    key={m}
                    className="rounded-md border border-stone-700 bg-stone-800 px-2 py-1 text-[11px] font-medium text-stone-300"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* shop */}
          <nav aria-label="Shop categories">
            <p className="text-sm font-semibold uppercase tracking-wide text-white">Shop</p>
            <ul className="mt-3 space-y-2">
              {categories.map((c) => (
                <li key={c.id}>
                  <button
                    className="text-sm text-stone-400 hover:text-orange-400"
                    onClick={() => navigate('listing', { category: c.slug })}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
              <li>
                <button
                  className="text-sm font-medium text-orange-400 hover:text-orange-300"
                  onClick={() => navigate('listing', { badge: 'DEAL' })}
                >
                  Today&apos;s Deals
                </button>
              </li>
              <li>
                <button
                  className="text-sm font-medium text-teal-400 hover:text-teal-300"
                  onClick={() => navigate('listing', { condition: 'REFURBISHED' })}
                >
                  ♻ Renewed &amp; Refurbished
                </button>
              </li>
            </ul>
          </nav>

          {/* help */}
          <nav aria-label="Help">
            <p className="text-sm font-semibold uppercase tracking-wide text-white">Help</p>
            <ul className="mt-3 space-y-2">
              {HELP_LINKS.map((l) => (
                <li key={l.page}>
                  <button
                    className="text-sm text-stone-400 hover:text-orange-400"
                    onClick={() => navigate('static', { page: l.page })}
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* vendors + business */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-white">For Vendors</p>
            <p className="mt-3 text-sm leading-relaxed text-stone-400">
              Sell on {siteName} and reach crores of customers across India. Easy onboarding,
              transparent commissions and weekly settlements.
            </p>
            <div className="mt-4 flex flex-col items-start gap-2">
              <button
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                onClick={() => navigate('auth', { tab: 'vendor' })}
              >
                Become a Seller
              </button>
              <button
                className="text-sm text-stone-400 hover:text-orange-400"
                onClick={() => navigate('auth', { tab: 'vendor' })}
              >
                Vendor Login →
              </button>
            </div>
            <div className="mt-6 border-t border-stone-800 pt-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-white">For Business</p>
              <div className="mt-3 flex flex-col items-start gap-2">
                <button
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                  onClick={() => navigate('b2b')}
                >
                  Bulk Buying (B2B)
                </button>
                <button
                  className="text-sm text-stone-400 hover:text-orange-400"
                  onClick={() => navigate('quote')}
                >
                  Request a Quote →
                </button>
                <button
                  className="text-sm text-stone-400 hover:text-emerald-400"
                  onClick={() => navigate('ewaste')}
                >
                  ♻ Give us your e-waste →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* newsletter strip */}
        <div className="mt-8 border-t border-stone-800 pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-white">
                Get the best deals in your inbox
              </p>
              <p className="mt-1 text-xs text-stone-400">
                New arrivals, exclusive offers &amp; the weekly Renewed Store drop. No spam.
              </p>
            </div>
            <form className="flex w-full max-w-md gap-2" onSubmit={subscribe}>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address for newsletter"
                className="h-10 border-stone-700 bg-stone-800 text-stone-200 placeholder:text-stone-500 focus-visible:ring-orange-500"
              />
              <Button
                type="submit"
                disabled={subscribing}
                className="h-10 shrink-0 bg-orange-600 px-4 text-white hover:bg-orange-700"
              >
                {subscribing ? (
                  'Subscribing…'
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Subscribe
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* bottom bar */}
      <div className="border-t border-stone-800">
        <div className="container mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-stone-500 sm:flex-row">
          <p>© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
          <p>Made in India 🇮🇳</p>
        </div>
      </div>
    </footer>
  )
}
