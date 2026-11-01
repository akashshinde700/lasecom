'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAppStore, api } from '@/lib/store'
import { cn } from '@/lib/utils'
import { openDocument } from '@/lib/documents'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Bell, Download, FileText, Heart, Loader2, LogOut, MapPin, Package, Plus, ShieldCheck, Star, Store, Trash2, UserRound, Wrench,
} from 'lucide-react'

type Address = {
  id: string
  fullName: string
  phone: string
  line1: string
  line2: string | null
  city: string
  state: string
  pincode: string
  type: string
  isDefault: boolean
}

type MyQuote = {
  id: string
  quoteNumber: string
  kind: string
  status: string
  quotedTotal: number | null
  quoteNote: string | null
  createdAt: string
  items: { id: string; titleSnapshot: string; qty: number; unitPrice: number; targetPrice: number | null }[]
}

const QUOTE_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Awaiting quote',
  QUOTED: 'Quoted — check it!',
  ACCEPTED: 'Accepted',
  CLOSED: 'Closed',
}

const QUOTE_STATUS_CLASS: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  QUOTED: 'bg-sky-100 text-sky-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-stone-200 text-stone-600',
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
]

const ROLE_LABEL: Record<string, string> = {
  CUSTOMER: 'Customer',
  VENDOR_ADMIN: 'Vendor Admin',
  VENDOR_STAFF: 'Vendor Staff',
  PLATFORM_ADMIN: 'Platform Admin',
  PLATFORM_STAFF: 'Platform Staff',
}

const emptyForm = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', type: 'HOME' }

export default function AccountView() {
  const user = useAppStore((s) => s.user)
  const authLoading = useAppStore((s) => s.authLoading)
  const navigate = useAppStore((s) => s.navigate)
  const params = useAppStore((s) => s.params)
  const logout = useAppStore((s) => s.logout)

  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formBusy, setFormBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [quotes, setQuotes] = useState<MyQuote[] | null>(null)

  /* Auth gate */
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Please login to view your account')
      navigate('auth', { redirect: params.redirect ?? 'account' })
    }
  }, [authLoading, user, navigate, params.redirect])

  const loadAddresses = useCallback(() => {
    api<{ items: Address[] }>('/api/addresses').then((res) => {
      if (res.ok && res.data) setAddresses(res.data.items)
      else setAddresses([])
    })
  }, [])

  useEffect(() => {
    if (user) loadAddresses()
  }, [user, loadAddresses])

  const loadQuotes = useCallback(() => {
    api<{ items: MyQuote[] }>('/api/quotes/mine').then((res) => {
      if (res.ok && res.data) setQuotes(res.data.items)
      else setQuotes([])
    })
  }, [])

  useEffect(() => {
    if (user) loadQuotes()
  }, [user, loadQuotes])

  useEffect(() => {
    if (!user || params.section !== 'quotes') return
    const t = setTimeout(() => {
      document.getElementById('my-quotes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => clearTimeout(t)
  }, [user, params.section])

  const saveAddress = async () => {
    if (!form.fullName.trim() || !form.phone.trim() || !form.line1.trim() || !form.city.trim() || !form.state || !form.pincode.trim()) {
      toast.error('Please fill all address fields (except landmark)')
      return
    }
    setFormBusy(true)
    const res = await api('/api/addresses', {
      method: 'POST',
      json: { ...form, isDefault: (addresses?.length ?? 0) === 0 },
    })
    setFormBusy(false)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not save address')
      return
    }
    toast.success('Address saved')
    setForm(emptyForm)
    setShowForm(false)
    loadAddresses()
  }

  const setDefault = async (id: string) => {
    const res = await api('/api/addresses', { method: 'PATCH', json: { id, isDefault: true } })
    if (!res.ok) {
      toast.error(res.error ?? 'Could not set default')
      return
    }
    toast.success('Default address updated')
    loadAddresses()
  }

  const deleteAddress = async (id: string) => {
    setDeletingId(id)
    const res = await api(`/api/addresses?id=${id}`, { method: 'DELETE' })
    setDeletingId(null)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not delete address')
      return
    }
    toast.success('Address deleted')
    loadAddresses()
  }

  const doLogout = async () => {
    await logout()
    navigate('home')
    toast.success('Logged out. See you soon!')
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    )
  }
  if (!user) return null

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const isVendor = user.role === 'VENDOR_ADMIN' || user.role === 'VENDOR_STAFF'
  const isAdmin = user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_STAFF'

  const quickLinks = [
    { label: 'My Orders', desc: 'Track & manage orders', icon: Package, view: 'orders' as const },
    { label: 'Wishlist', desc: 'Saved for later', icon: Heart, view: 'wishlist' as const },
    { label: 'My Quotes', desc: 'RFQ & B2B quotations', icon: FileText, view: 'account' as const, anchor: 'my-quotes' },
    { label: 'Notifications', desc: 'Order & payment updates', icon: Bell, view: 'notifications' as const },
    ...(isVendor
      ? [{ label: 'Vendor Panel', desc: 'Manage your store', icon: Store, view: 'vendor-panel' as const, accent: true }]
      : []),
    ...(isAdmin
      ? [{ label: 'Admin Panel', desc: 'Platform administration', icon: Wrench, view: 'admin-panel' as const, accent: true }]
      : []),
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-stone-900">My Account</h1>

      {/* Profile */}
      <Card className="mb-5 rounded-xl border shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-xl font-bold text-orange-700">
            {initials || <UserRound className="h-7 w-7" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-stone-900">{user.name}</h2>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
              {user.status === 'BLOCKED' ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">Blocked</span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-stone-500">{user.email}</p>
            {user.phone ? <p className="text-xs text-stone-400">{user.phone}</p> : null}
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {quickLinks.map((l) => (
          <button
            key={l.label}
            onClick={() => {
              if ('anchor' in l && l.anchor) {
                navigate('account')
                setTimeout(() => document.getElementById(l.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
              } else {
                navigate(l.view)
              }
            }}
            className={cn(
              'flex flex-col items-start gap-2 rounded-xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
              'accent' in l && l.accent
                ? 'border-orange-200 bg-orange-50/60 hover:border-orange-300'
                : 'border-stone-200 bg-white hover:border-stone-300'
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg',
                'accent' in l && l.accent ? 'bg-orange-600 text-white' : 'bg-stone-100 text-stone-600'
              )}
            >
              <l.icon className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-stone-900">{l.label}</span>
            <span className="-mt-1.5 text-[11px] text-stone-400">{l.desc}</span>
          </button>
        ))}
      </div>

      {/* My Quotes (RFQ + B2B) */}
      <Card id="my-quotes" className="mb-5 scroll-mt-24 rounded-xl border shadow-sm">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-800">
              <FileText className="h-4 w-4 text-teal-600" /> My Quotes
            </h3>
            <Button size="sm" variant="outline" className="border-teal-600 text-teal-700 hover:bg-teal-50 hover:text-teal-800" onClick={() => navigate('quote')}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New request
            </Button>
          </div>

          {quotes === null ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : quotes.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-400">
              No quote requests yet — need bulk quantities or GST invoicing? {""}
              <button className="font-medium text-teal-700 underline-offset-2 hover:underline" onClick={() => navigate('b2b')}>
                Try B2B bulk buying
              </button>
            </p>
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {quotes.map((q) => (
                <div key={q.id} className="rounded-lg border border-stone-200 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-stone-700">{q.quoteNumber}</span>
                    {q.kind === 'B2B' ? (
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">B2B</span>
                    ) : null}
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', QUOTE_STATUS_CLASS[q.status] ?? 'bg-stone-100 text-stone-600')}>
                      {QUOTE_STATUS_LABEL[q.status] ?? q.status}
                    </span>
                    <span className="ml-auto text-[11px] text-stone-400">
                      {new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {q.items.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {q.items.slice(0, 3).map((it) => (
                        <li key={it.id} className="truncate text-xs text-stone-600">
                          • {it.titleSnapshot} × {it.qty}
                        </li>
                      ))}
                      {q.items.length > 3 ? (
                        <li className="text-[11px] text-stone-400">+ {q.items.length - 3} more item(s)</li>
                      ) : null}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-stone-500">General inquiry</p>
                  )}
                  {q.quotedTotal !== null ? (
                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                      Quoted total: ₹{q.quotedTotal.toLocaleString('en-IN')}
                      {q.quoteNote ? <span className="ml-2 font-normal text-stone-500">{q.quoteNote}</span> : null}
                    </p>
                  ) : null}
                  {q.quotedTotal !== null && q.quotedTotal > 0 && ['QUOTED', 'ACCEPTED'].includes(q.status) ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {([
                        ['quotation', 'Quotation'],
                        ['quote-proforma', 'Proforma Invoice'],
                        ['customer-po', 'Purchase Order'],
                      ] as const).map(([kind, label]) => (
                        <Button
                          key={kind}
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-[11px]"
                          onClick={async () => {
                            const res = await openDocument(kind, q.id)
                            if (!res.ok) toast.error(res.error ?? 'Could not generate the document')
                          }}
                        >
                          <Download className="h-3 w-3" /> {label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Addresses */}
      <Card className="mb-5 rounded-xl border shadow-sm">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-800">
              <MapPin className="h-4 w-4 text-orange-600" /> Saved addresses
            </h3>
            <Collapsible open={showForm} onOpenChange={setShowForm}>
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="outline" className="border-orange-600 text-orange-600 hover:bg-orange-50 hover:text-orange-700">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add address
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>

          {addresses === null ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : addresses.length === 0 && !showForm ? (
            <p className="py-4 text-center text-sm text-stone-400">
              No saved addresses yet — add one for faster checkout.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {addresses.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    'rounded-lg border p-3.5',
                    a.isDefault ? 'border-orange-200 bg-orange-50/40' : 'border-stone-200 bg-white'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900">{a.fullName}</span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">{a.type}</span>
                    {a.isDefault ? (
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Default
                      </span>
                    ) : null}
                    <div className="ml-auto flex items-center gap-1">
                      {!a.isDefault ? (
                        <button
                          onClick={() => setDefault(a.id)}
                          className="rounded px-1.5 py-1 text-[11px] font-medium text-orange-600 hover:bg-orange-50"
                        >
                          Set default
                        </button>
                      ) : null}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            aria-label="Delete address"
                            className="rounded p-1 text-stone-300 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this address?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {a.fullName} — {a.line1}, {a.city} {a.pincode}. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={deletingId === a.id}
                              onClick={(e) => { e.preventDefault(); deleteAddress(a.id) }}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {deletingId === a.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} — {a.pincode}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-400">Phone: {a.phone}</p>
                </div>
              ))}
            </div>
          )}

          <Collapsible open={showForm} onOpenChange={setShowForm}>
            <CollapsibleContent className="mt-4 space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Full name</Label>
                  <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Rahul Kumar" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address line 1 (house no, street)</Label>
                <Input value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} placeholder="Flat 402, Green Residency" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address line 2 (landmark, area) — optional</Label>
                <Input value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} placeholder="Near Metro Station" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Pune" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">State</Label>
                  <Select value={form.state || undefined} onValueChange={(v) => setForm({ ...form, state: v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pincode</Label>
                  <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="411001" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOME">Home</SelectItem>
                    <SelectItem value="WORK">Work</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={saveAddress} disabled={formBusy} className="bg-orange-600 text-white hover:bg-orange-700">
                  {formBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save address
                </Button>
                <Button variant="ghost" onClick={() => { setShowForm(false); setForm(emptyForm) }}>Cancel</Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Logout */}
      <Separator className="mb-5" />
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={doLogout}
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </div>
    </div>
  )
}
