'use client'

//
// QuoteView — Request For Quote form (customer RFQ + B2B bulk inquiries).
// Entry params (via navigate('quote', params)):
//   kind       : 'b2b' → B2B bulk inquiry mode (company/GST fields, products optional)
//   productId  : prefill a product line from a PDP "Request Bulk Quote" click
//   title      : product title for the prefilled line
//

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore, api } from '@/lib/store'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Briefcase,
  CheckCircle2,
  FileText,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'

type QuoteLine = {
  key: string
  productId: string | null
  title: string
  qty: number
  targetPrice: string
  price: number
  condition: string
}

type ProductHit = {
  id: string
  title: string
  slug: string
  price: number
  condition: string
  category: { name: string } | null
}

type QuoteResult = {
  id: string
  quoteNumber: string
  status: string
  itemCount: number
}

function QuoteInner({ kind }: { kind: 'CUSTOMER' | 'B2B' }) {
  const user = useAppStore((s) => s.user)
  const params = useAppStore((s) => s.params)
  const navigate = useAppStore((s) => s.navigate)
  const isB2B = kind === 'B2B'

  const [lines, setLines] = useState<QuoteLine[]>(() =>
    params.productId && params.title
      ? [{ key: 'p-' + params.productId, productId: params.productId, title: params.title, qty: 10, targetPrice: '', price: 0, condition: 'NEW' }]
      : []
  )
  const [contact, setContact] = useState({
    name: '', company: '', email: '', phone: '', gstin: '', message: '',
  })
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState<ProductHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [showHits, setShowHits] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<QuoteResult | null>(null)

  /* prefill contact for logged-in users (runs once on mount) */
  const userRef = useRef(user)
  useEffect(() => {
    if (userRef.current) {
      setContact((c) => ({
        ...c,
        name: c.name || userRef.current!.name,
        email: c.email || userRef.current!.email,
        phone: c.phone || userRef.current!.phone || '',
      }))
    }
  }, [])

  const doSearch = useCallback((q: string) => {
    setSearching(true)
    api<{ items: ProductHit[] }>(`/api/products?search=${encodeURIComponent(q)}&limit=8`)
      .then((res) => {
        setSearching(false)
        if (res.ok && res.data) setHits(res.data.items)
        else setHits([])
      })
      .catch(() => {
        setSearching(false)
        setHits([])
      })
  }, [])

  const addLine = (hit: ProductHit) => {
    setLines((ls) => {
      if (ls.some((l) => l.productId === hit.id)) {
        toast.info('Product already added — update its quantity instead')
        return ls
      }
      return [
        ...ls,
        {
          key: 'p-' + hit.id,
          productId: hit.id,
          title: hit.title,
          qty: isB2B ? 10 : 1,
          targetPrice: '',
          price: hit.price,
          condition: hit.condition,
        },
      ]
    })
    setSearch('')
    setHits(null)
    setShowHits(false)
  }

  const addManualLine = () => {
    setLines((ls) => [
      ...ls,
      { key: 'm-' + Date.now().toString(36), productId: null, title: '', qty: isB2B ? 10 : 1, targetPrice: '', price: 0, condition: 'NEW' },
    ])
  }

  const updateLine = (key: string, patch: Partial<QuoteLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key))

  const estTotal = useMemo(
    () => lines.reduce((s, l) => s + (l.targetPrice ? Number(l.targetPrice) * l.qty : l.price * l.qty), 0),
    [lines]
  )

  const submit = async () => {
    if (!contact.name.trim()) return toast.error('Please enter your name')
    if (!contact.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()))
      return toast.error('Please enter a valid email')
    if (contact.phone.replace(/\D/g, '').length < 10) return toast.error('Please enter a valid 10-digit phone number')
    if (isB2B && lines.length === 0 && !contact.message.trim())
      return toast.error('Add products or describe your requirement in the message')
    if (!isB2B && lines.length === 0) return toast.error('Add at least one product to the quote')
    if (lines.some((l) => !l.productId && !l.title.trim()))
      return toast.error('Every manual line needs a product description')

    setBusy(true)
    const res = await api<QuoteResult>('/api/quotes', {
      method: 'POST',
      json: {
        kind,
        name: contact.name.trim(),
        company: contact.company.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
        gstin: contact.gstin.trim(),
        message: contact.message.trim(),
        items: lines.map((l) => ({
          productId: l.productId ?? undefined,
          title: l.productId ? l.title : l.title.trim(),
          qty: l.qty,
          targetPrice: l.targetPrice ? Number(l.targetPrice) : undefined,
        })),
      },
    })
    setBusy(false)
    if (!res.ok || !res.data) {
      toast.error(res.error ?? 'Could not submit the quote request')
      return
    }
    setResult(res.data)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  /* ---------------- success screen ---------------- */
  if (result) {
    return (
      <div className="mx-auto max-w-xl px-4 py-14">
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="size-9 text-emerald-600" />
            </span>
            <h1 className="text-xl font-bold text-stone-900">
              {isB2B ? 'B2B inquiry received' : 'Quote request received'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              Reference <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs font-semibold text-stone-700">{result.quoteNumber}</span>
              {user ? ' — track it anytime under Account → My Quotes.' : ' — our team will reach out on your email/phone within 24 business hours.'}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => navigate('home')} className="bg-orange-600 text-white hover:bg-orange-700">
                Continue shopping
              </Button>
              {user ? (
                <Button variant="outline" onClick={() => navigate('account', { section: 'quotes' })}>
                  View My Quotes
                </Button>
              ) : (
                <Button variant="outline" onClick={() => navigate('listing')}>
                  Browse products
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* ---------------- form ---------------- */
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6">
        <Badge className={cn('mb-2 gap-1', isB2B ? 'bg-teal-600 hover:bg-teal-700' : 'bg-orange-600 hover:bg-orange-700')}>
          {isB2B ? <Briefcase className="size-3" /> : <FileText className="size-3" />}
          {isB2B ? 'B2B / Bulk Inquiry' : 'Customer Quote'}
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          {isB2B ? 'Get a business quotation' : 'Request a quote'}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {isB2B
            ? 'Bulk pricing, GST invoicing and a dedicated account manager — tell us what you need and we will respond within 24 business hours.'
            : 'Looking for a better price on quantity or an item you cannot find? Send us the details and we will quote back.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* products */}
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-800">
                <Package className="size-4 text-orange-600" /> Products {isB2B ? '(optional for general inquiries)' : ''}
              </h2>

              {/* product search */}
              <div className="relative mb-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                    <Input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value)
                        if (e.target.value.trim().length >= 2) {
                          setShowHits(true)
                          doSearch(e.target.value.trim())
                        } else {
                          setHits(null)
                          setShowHits(false)
                        }
                      }}
                      onFocus={() => { if (hits) setShowHits(true) }}
                      placeholder="Search the catalog to add a product…"
                      className="pl-9"
                      aria-label="Search products"
                    />
                  </div>
                  <Button variant="outline" onClick={addManualLine} title="Add a custom line">
                    <Plus className="size-4" /> Custom
                  </Button>
                </div>
                {showHits ? (
                  <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
                    {searching ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-stone-500">
                        <Loader2 className="size-4 animate-spin" /> Searching…
                      </div>
                    ) : hits && hits.length > 0 ? (
                      hits.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => addLine(h)}
                          className="flex w-full items-center justify-between gap-3 border-b border-stone-100 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-orange-50/60"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-stone-800">{h.title}</p>
                            <p className="text-[11px] text-stone-400">{h.category?.name ?? 'Product'}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {h.condition === 'REFURBISHED' ? (
                              <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">♻ Refurb</span>
                            ) : null}
                            <span className="text-xs font-semibold text-stone-700">{formatINR(h.price)}</span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="p-3 text-sm text-stone-500">No products found — use “Custom” to describe the item.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowHits(false)}
                      className="flex w-full items-center justify-center gap-1 py-1.5 text-[11px] text-stone-400 hover:text-stone-600"
                    >
                      <X className="size-3" /> close
                    </button>
                  </div>
                ) : null}
              </div>

              {lines.length === 0 ? (
                <p className="rounded-lg border border-dashed border-stone-300 p-4 text-center text-sm text-stone-400">
                  No products added yet. Search above or add a custom line.
                </p>
              ) : (
                <div className="space-y-3">
                  {lines.map((l) => (
                    <div key={l.key} className="rounded-lg border border-stone-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        {l.productId ? (
                          <p className="min-w-0 flex-1 text-sm font-semibold text-stone-800">{l.title}</p>
                        ) : (
                          <Input
                            value={l.title}
                            onChange={(e) => updateLine(l.key, { title: e.target.value })}
                            placeholder="Describe the product / model…"
                            className="flex-1 text-sm"
                            aria-label="Product description"
                          />
                        )}
                        <div className="flex shrink-0 items-center gap-2">
                          {l.condition === 'REFURBISHED' ? (
                            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">♻ Refurb</span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => removeLine(l.key)}
                            aria-label={`Remove ${l.title || 'line'}`}
                            className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-end gap-3">
                        <div>
                          <Label className="text-[11px] text-stone-500">Quantity</Label>
                          <div className="mt-1 flex items-center rounded-lg border border-stone-300">
                            <button
                              type="button"
                              onClick={() => updateLine(l.key, { qty: Math.max(1, l.qty - 1) })}
                              className="p-2 text-stone-500 hover:text-stone-800"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <input
                              value={l.qty}
                              onChange={(e) => updateLine(l.key, { qty: Math.max(1, Math.min(100000, parseInt(e.target.value) || 1)) })}
                              className="w-14 border-x border-stone-200 py-1.5 text-center text-sm outline-none"
                              aria-label="Quantity"
                              inputMode="numeric"
                            />
                            <button
                              type="button"
                              onClick={() => updateLine(l.key, { qty: Math.min(100000, l.qty + 1) })}
                              className="p-2 text-stone-500 hover:text-stone-800"
                              aria-label="Increase quantity"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-[11px] text-stone-500">Target price / unit (optional)</Label>
                          <Input
                            value={l.targetPrice}
                            onChange={(e) => updateLine(l.key, { targetPrice: e.target.value.replace(/[^\d.]/g, '') })}
                            placeholder="₹ e.g. 9999"
                            className="mt-1 w-40 text-sm"
                            inputMode="decimal"
                            aria-label="Target price per unit"
                          />
                        </div>
                        {l.price > 0 ? (
                          <p className="pb-2 text-[11px] text-stone-400">
                            List: {formatINR(l.price)} · Est. line total: {formatINR((l.targetPrice ? Number(l.targetPrice) : l.price) * l.qty)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* contact */}
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-stone-800">Your details</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Full name *</Label>
                  <Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Rahul Kumar" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{isB2B ? 'Company *' : 'Company (optional)'}</Label>
                  <Input value={contact.company} onChange={(e) => setContact({ ...contact, company: e.target.value })} placeholder="Acme Traders Pvt Ltd" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="you@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone *</Label>
                  <Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
                {isB2B ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">GSTIN (for GST invoices)</Label>
                    <Input value={contact.gstin} onChange={(e) => setContact({ ...contact, gstin: e.target.value.toUpperCase() })} placeholder="27ABCDE1234F1Z5" className="uppercase" />
                  </div>
                ) : null}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">{isB2B ? 'Requirement details *' : 'Message (optional)'}</Label>
                  <Textarea
                    value={contact.message}
                    onChange={(e) => setContact({ ...contact, message: e.target.value })}
                    rows={4}
                    placeholder={
                      isB2B
                        ? 'e.g. We need 50 refurbished laptops for our Pune office by next month, with GST invoice and 1-year warranty…'
                        : 'Anything else we should know — delivery city, timeline, budget…'
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* side summary */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-stone-800">Request summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-stone-600">
                  <span>Products</span>
                  <span className="font-medium text-stone-900">{lines.length}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Total units</span>
                  <span className="font-medium text-stone-900">{lines.reduce((s, l) => s + l.qty, 0)}</span>
                </div>
                {estTotal > 0 ? (
                  <div className="flex justify-between text-stone-600">
                    <span>Est. value (list/target)</span>
                    <span className="font-medium text-stone-900">{formatINR(estTotal)}</span>
                  </div>
                ) : null}
              </div>
              <Button onClick={submit} disabled={busy} className="mt-4 w-full bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60">
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {busy ? 'Submitting…' : 'Submit quote request'}
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
                <ShieldCheck className="size-3.5 text-emerald-600" /> Response within 24 business hours
              </p>
            </CardContent>
          </Card>

          {isB2B ? (
            <Card className="rounded-xl border border-teal-200 bg-teal-50/60 shadow-sm">
              <CardContent className="p-4 text-xs leading-relaxed text-teal-900">
                <p className="mb-1 font-semibold">Volume discounts kick in fast</p>
                5+ units 3% · 20+ units 7% · 50+ units 12% · 100+ units custom pricing. GST invoice included on every B2B order.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function QuoteView() {
  const params = useAppStore((s) => s.params)
  const kind: 'CUSTOMER' | 'B2B' = params.kind === 'b2b' ? 'B2B' : 'CUSTOMER'
  /* remount when the entry params change so prefills apply cleanly */
  return <QuoteInner key={`${kind}:${params.productId ?? ''}`} kind={kind} />
}
