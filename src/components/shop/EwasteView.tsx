'use client'

//
// EwasteView — e-waste pickup request form for companies. We collect
// end-of-life IT and electrical equipment; the request lands in the admin
// panel (E-Waste tab) and every platform admin gets a notification.
//

import { useState } from 'react'
import { useAppStore, api } from '@/lib/store'
import { cn } from '@/lib/utils'
import { EWASTE_CATEGORIES } from '@/lib/ewaste'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, FileCheck2, Loader2, Recycle, ShieldCheck, Truck } from 'lucide-react'

const today = () => new Date().toISOString().slice(0, 10)

export default function EwasteView() {
  const navigate = useAppStore((s) => s.navigate)
  const user = useAppStore((s) => s.user)

  const [form, setForm] = useState({
    company: '',
    contactName: user?.name ?? '',
    email: user?.email ?? '',
    phone: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    quantity: '',
    unit: 'KG' as 'KG' | 'UNITS',
    pickupDate: '',
    needCertificate: true,
    message: '',
  })
  const [categories, setCategories] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ requestNumber: string } | null>(null)

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const toggleCategory = (key: string) =>
    setCategories((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]))

  const submit = async () => {
    if (!form.company.trim()) return toast.error('Company name is required')
    if (!form.contactName.trim()) return toast.error('Contact person name is required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return toast.error('Enter a valid email')
    if (form.phone.replace(/\D/g, '').length < 10) return toast.error('Enter a valid 10-digit phone number')
    if (!form.address.trim() || !form.city.trim()) return toast.error('Pickup address and city are required')
    if (!/^\d{6}$/.test(form.pincode.trim())) return toast.error('Enter a valid 6-digit pincode')
    if (categories.length === 0) return toast.error('Select at least one e-waste category')

    setBusy(true)
    const res = await api<{ requestNumber: string }>('/api/ewaste', {
      method: 'POST',
      json: { ...form, quantity: form.quantity ? Number(form.quantity) : 0, categories },
    })
    setBusy(false)
    if (!res.ok || !res.data) {
      toast.error(res.error ?? 'Could not submit your request')
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
            <h1 className="text-xl font-bold text-stone-900">Pickup request received</h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              Reference <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs font-semibold text-stone-700">{result.requestNumber}</span>
              {' '}— our team will call you within 24 business hours to confirm the pickup slot.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => navigate('home')} className="bg-orange-600 text-white hover:bg-orange-700">
                Back to home
              </Button>
              <Button variant="outline" onClick={() => navigate('b2b')}>
                For Business
              </Button>
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
        <Badge className="mb-2 gap-1 bg-emerald-600 hover:bg-emerald-700">
          <Recycle className="size-3" /> E-Waste Pickup
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Hand over your company e-waste</h1>
        <p className="mt-1 text-sm text-stone-500">
          Old laptops, servers, mobiles, printers, batteries and more — we collect from your premises and recycle
          responsibly. Tell us what you have and we will schedule a pickup.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* what */}
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-stone-800">What e-waste do you have? *</h2>
              <div className="flex flex-wrap gap-2">
                {EWASTE_CATEGORIES.map((c) => {
                  const active = categories.includes(c.key)
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => toggleCategory(c.key)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        active
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-stone-200 bg-white text-stone-600 hover:border-emerald-300 hover:bg-emerald-50'
                      )}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Approx. quantity</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.quantity}
                      onChange={(e) => set({ quantity: e.target.value.replace(/[^\d.]/g, '') })}
                      placeholder="e.g. 250"
                      inputMode="decimal"
                      className="min-w-0 flex-1"
                    />
                    <div className="flex shrink-0 rounded-md border border-stone-200 p-0.5">
                      {(['KG', 'UNITS'] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => set({ unit: u })}
                          className={cn(
                            'rounded px-2.5 text-xs font-medium',
                            form.unit === u ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-800'
                          )}
                        >
                          {u === 'KG' ? 'kg' : 'units'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Preferred pickup date</Label>
                  <Input type="date" min={today()} value={form.pickupDate} onChange={(e) => set({ pickupDate: e.target.value })} />
                </div>
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={form.needCertificate}
                  onChange={(e) => set({ needCertificate: e.target.checked })}
                  className="mt-0.5 size-4 accent-emerald-600"
                />
                <span>
                  I need a recycling / data-destruction certificate
                  <span className="block text-xs text-stone-400">For your compliance and audit records</span>
                </span>
              </label>
            </CardContent>
          </Card>

          {/* who + where */}
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-stone-800">Company & pickup details</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Company name *</Label>
                  <Input value={form.company} onChange={(e) => set({ company: e.target.value })} placeholder="Acme Technologies Pvt Ltd" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contact person *</Label>
                  <Input value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} placeholder="Rahul Kumar" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone *</Label>
                  <Input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">GSTIN (optional)</Label>
                  <Input value={form.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} placeholder="27ABCDE1234F1Z5" className="uppercase" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Pickup address *</Label>
                  <Textarea value={form.address} onChange={(e) => set({ address: e.target.value })} rows={2} placeholder="Building, street, area" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">City *</Label>
                  <Input value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="Pune" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">State</Label>
                    <Input value={form.state} onChange={(e) => set({ state: e.target.value })} placeholder="Maharashtra" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pincode *</Label>
                    <Input value={form.pincode} onChange={(e) => set({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="411001" inputMode="numeric" />
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Additional details (optional)</Label>
                  <Textarea
                    value={form.message}
                    onChange={(e) => set({ message: e.target.value })}
                    rows={3}
                    placeholder="e.g. 40 old desktops and 2 server racks on the 3rd floor, goods lift available, pickup after 6 pm…"
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
                  <span>Categories</span>
                  <span className="font-medium text-stone-900">{categories.length}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Quantity</span>
                  <span className="font-medium text-stone-900">
                    {form.quantity ? `~${form.quantity} ${form.unit === 'KG' ? 'kg' : 'units'}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Certificate</span>
                  <span className="font-medium text-stone-900">{form.needCertificate ? 'Yes' : 'No'}</span>
                </div>
              </div>
              <Button onClick={submit} disabled={busy} className="mt-4 w-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {busy ? 'Submitting…' : 'Request pickup'}
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
                <ShieldCheck className="size-3.5 text-emerald-600" /> We call back within 24 business hours
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-emerald-200 bg-emerald-50/60 shadow-sm">
            <CardContent className="space-y-2.5 p-4 text-xs leading-relaxed text-emerald-900">
              <p className="flex items-start gap-2"><Truck className="mt-0.5 size-3.5 shrink-0" /> Doorstep pickup from your office or warehouse</p>
              <p className="flex items-start gap-2"><Recycle className="mt-0.5 size-3.5 shrink-0" /> Responsible recycling of every item we collect</p>
              <p className="flex items-start gap-2"><FileCheck2 className="mt-0.5 size-3.5 shrink-0" /> Recycling & data-destruction certificate on request</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
