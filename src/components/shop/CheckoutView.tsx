'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore, api } from '@/lib/store'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Smartphone,
  Star,
  Store,
  Tag,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react'
import { groupShippingFees, itemImage, type AppliedCoupon, type UnifiedCartItem } from './CartView'
import { startRazorpayPayment } from '@/lib/razorpay-client'

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

type ApiCartItem = {
  id: string
  productId: string
  variantId: string | null
  qty: number
  product: {
    id: string; title: string; slug: string; price: number; mrp: number; images: string
    stock: number; freeShipping: boolean; vendor: { name: string; slug: string } | null
  }
  variant: { id: string; name: string; price: number; stock: number } | null
}

type PayStage = 'processing' | 'success' | 'failed'

const PAYMENT_LABEL: Record<string, string> = {
  RAZORPAY: 'Razorpay (UPI · Card · Wallet)',
  UPI: 'UPI',
  CARD: 'Credit / Debit Card',
  NETBANKING: 'Net Banking',
  COD: 'Cash on Delivery',
}

const PAYMENT_BRAND: Record<string, string> = {
  RAZORPAY: 'GPay · PhonePe · Paytm · Cards · NetBanking — via Razorpay',
  UPI: 'UPI · BHIM / GPay / PhonePe / Paytm',
  CARD: 'Visa · Mastercard · RuPay · Amex',
  NETBANKING: 'All major Indian banks',
  COD: '',
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
]

export default function CheckoutView() {
  const user = useAppStore((s) => s.user)
  const guestCart = useAppStore((s) => s.guestCart)
  const settings = useAppStore((s) => s.settings)
  const navigate = useAppStore((s) => s.navigate)
  const clearGuestCart = useAppStore((s) => s.clearGuestCart)
  const refreshCartCount = useAppStore((s) => s.refreshCartCount)

  const [serverItems, setServerItems] = useState<UnifiedCartItem[] | null>(null)
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)

  /* addresses (logged-in) */
  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [selectedAddr, setSelectedAddr] = useState<string>('')
  const [showAddrForm, setShowAddrForm] = useState(false)
  const [addrBusy, setAddrBusy] = useState(false)
  const [form, setForm] = useState({
    fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', type: 'HOME',
  })

  /* guest address + contact */
  const [guest, setGuest] = useState({
    fullName: '', phone: '', email: '', line1: '', line2: '', city: '', state: '', pincode: '',
  })

  /* payment */
  const [paymentMethod, setPaymentMethod] = useState<'RAZORPAY' | 'UPI' | 'CARD' | 'NETBANKING' | 'COD'>('RAZORPAY')
  const [placing, setPlacing] = useState(false)
  const [pay, setPay] = useState<{ stage: PayStage; orderId: string; orderNumber: string } | null>(null)
  /* set once an order POST succeeds — stops the empty-cart guard from yanking
     the user back to /cart while the guest cart is being cleared */
  const orderPlacedRef = useRef(false)

  const threshold = settings?.freeShipThreshold ?? 499
  const baseFee = settings?.baseShipFee ?? 49
  const codFee = settings?.codFee ?? 25

  /* Guest cart is derived directly from the persisted store — no fetch needed. */
  const guestItems = useMemo<UnifiedCartItem[]>(
    () =>
      guestCart.map((i) => ({
        key: `${i.productId}:${i.variantId ?? ''}`,
        productId: i.productId,
        variantId: i.variantId ?? null,
        qty: i.qty,
        title: i.title,
        slug: i.slug,
        image: i.image,
        price: i.price,
        mrp: i.mrp,
        stock: i.stock,
        variantName: i.variantName ?? null,
        vendorName: i.vendorName || 'Lastrivon Retail',
        vendorSlug: i.vendorSlug ?? null,
        freeShipping: i.freeShipping,
      })),
    [guestCart]
  )

  const items = user ? serverItems : guestItems

  const load = useCallback(() => {
    if (!user) return
    Promise.all([
      api<{ items: ApiCartItem[]; couponCode: string | null }>('/api/cart'),
      api<{ items: Address[] }>('/api/addresses'),
    ]).then(([cartRes, addrRes]) => {
      if (cartRes.ok && cartRes.data) {
        setServerItems(
          cartRes.data.items.map((i) => {
            const price = i.variant?.price ?? i.product.price
            return {
              key: `${i.productId}:${i.variantId ?? ''}`,
              productId: i.productId,
              variantId: i.variantId,
              qty: i.qty,
              title: i.product.title,
              slug: i.product.slug,
              image: itemImage(i.product.images),
              price,
              mrp: i.product.mrp,
              stock: i.variant?.stock ?? i.product.stock,
              variantName: i.variant?.name ?? null,
              vendorName: i.product.vendor?.name ?? 'Lastrivon Retail',
              vendorSlug: i.product.vendor?.slug ?? null,
              freeShipping: i.product.freeShipping,
            }
          })
        )
        const total = cartRes.data.items.reduce((s, i) => s + (i.variant?.price ?? i.product.price) * i.qty, 0)
        if (cartRes.data.couponCode) {
          api<{ code: string; discount: number; description: string | null }>(
            '/api/coupons/validate', { method: 'POST', json: { code: cartRes.data.couponCode, itemsTotal: total } }
          ).then((v) => {
            if (v.ok && v.data) setCoupon({ code: v.data.code, discount: v.data.discount, description: v.data.description })
            else setCoupon({ code: cartRes.data!.couponCode!, discount: 0 })
          })
        }
      } else {
        setServerItems([])
      }
      if (addrRes.ok && addrRes.data) {
        setAddresses(addrRes.data.items)
        const def = addrRes.data.items.find((a) => a.isDefault) ?? addrRes.data.items[0]
        if (def) setSelectedAddr(def.id)
      } else {
        setAddresses([])
      }
    })
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  // Empty cart → back to cart view (only before an order has been placed)
  useEffect(() => {
    if (!orderPlacedRef.current && items && items.length === 0) {
      toast.error('Your cart is empty')
      navigate('cart')
    }
  }, [items, navigate])

  const itemsTotal = useMemo(() => (items ?? []).reduce((s, i) => s + i.price * i.qty, 0), [items])

  const groups = useMemo(() => {
    const map = new Map<string, { vendorName: string; subtotal: number; anyFreeShipping: boolean; items: UnifiedCartItem[] }>()
    for (const i of items ?? []) {
      const g = map.get(i.vendorName) ?? { vendorName: i.vendorName, subtotal: 0, anyFreeShipping: false, items: [] }
      g.subtotal += i.price * i.qty
      if (i.freeShipping) g.anyFreeShipping = true
      g.items.push(i)
      map.set(i.vendorName, g)
    }
    return [...map.values()]
  }, [items])

  const shipping = useMemo(() => groupShippingFees(groups, threshold, baseFee), [groups, threshold, baseFee])
  const discount = coupon ? Math.min(coupon.discount, itemsTotal) : 0
  const grandTotal = Math.max(0, itemsTotal - discount + shipping.total + (paymentMethod === 'COD' ? codFee : 0))

  const saveAddress = async () => {
    if (!form.fullName.trim() || !form.phone.trim() || !form.line1.trim() || !form.city.trim() || !form.state || !form.pincode.trim()) {
      toast.error('Please fill all address fields (except landmark)')
      return
    }
    setAddrBusy(true)
    const res = await api<{ address: Address }>('/api/addresses', {
      method: 'POST',
      json: { ...form, isDefault: (addresses?.length ?? 0) === 0 },
    })
    setAddrBusy(false)
    if (!res.ok || !res.data) {
      toast.error(res.error ?? 'Could not save address')
      return
    }
    const list = await api<{ items: Address[] }>('/api/addresses')
    if (list.ok && list.data) setAddresses(list.data.items)
    setSelectedAddr(res.data.address.id)
    setShowAddrForm(false)
    setForm({ fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', type: 'HOME' })
    toast.success('Address saved')
  }

  const selectedAddressObj = addresses?.find((a) => a.id === selectedAddr) ?? null

  const shippingPayload = () => {
    if (user) {
      if (!selectedAddressObj) return null
      return {
        fullName: selectedAddressObj.fullName,
        phone: selectedAddressObj.phone,
        line1: selectedAddressObj.line1,
        line2: selectedAddressObj.line2 ?? undefined,
        city: selectedAddressObj.city,
        state: selectedAddressObj.state,
        pincode: selectedAddressObj.pincode,
      }
    }
    const g = guest
    if (!g.fullName.trim() || !g.phone.trim() || !g.email.trim() || !g.line1.trim() || !g.city.trim() || !g.state || !g.pincode.trim()) {
      return null
    }
    return {
      fullName: g.fullName.trim(), phone: g.phone.trim(), line1: g.line1.trim(),
      line2: g.line2.trim() || undefined, city: g.city.trim(), state: g.state, pincode: g.pincode.trim(),
    }
  }

  const doPay = async (orderId: string, orderNumber: string) => {
    setPay({ stage: 'processing', orderId, orderNumber })
    const res = await api<{ status: 'SUCCESS' | 'FAILED'; orderId: string; orderNumber: string }>(
      `/api/payments/${orderId}/pay`, { method: 'POST', json: {} }
    )
    if (!res.ok || !res.data) {
      setPay({ stage: 'failed', orderId, orderNumber })
      toast.error(res.error ?? 'Payment error')
      return
    }
    if (res.data.status === 'SUCCESS') {
      setPay({ stage: 'success', orderId, orderNumber })
      if (!user) clearGuestCart()
      refreshCartCount()
      setTimeout(() => {
        setPay(null)
        navigate('order-success', { id: res.data!.orderId, orderNumber: res.data!.orderNumber })
      }, 1000)
    } else {
      setPay({ stage: 'failed', orderId, orderNumber })
    }
  }

  const doRazorpayPay = (orderId: string, orderNumber: string) => {
    setPay({ stage: 'processing', orderId, orderNumber })
    void startRazorpayPayment({
      orderId,
      orderNumber,
      description: `Lastrivon Kart order ${orderNumber}`,
      prefill: user
        ? { name: user.name, email: user.email, contact: user.phone ?? undefined }
        : { name: guest.fullName.trim() || undefined, email: guest.email.trim() || undefined, contact: guest.phone.trim() || undefined },
      onSuccess: (id, num) => {
        setPay({ stage: 'success', orderId: id, orderNumber: num })
        if (!user) clearGuestCart()
        refreshCartCount()
        setTimeout(() => {
          setPay(null)
          navigate('order-success', { id, orderNumber: num })
        }, 900)
      },
      onDismiss: () => setPay({ stage: 'failed', orderId, orderNumber }),
      onError: (msg) => {
        toast.error(msg)
        setPay({ stage: 'failed', orderId, orderNumber })
      },
    })
  }

  const placeOrder = async () => {
    const addr = shippingPayload()
    if (!addr) {
      toast.error(user ? 'Please select a delivery address' : 'Please complete your address and contact details')
      return
    }
    setPlacing(true)
    orderPlacedRef.current = true
    const payload: Record<string, unknown> = {
      idempotencyKey: crypto.randomUUID(),
      shippingAddress: addr,
      paymentMethod,
      ...(coupon ? { couponCode: coupon.code } : {}),
    }
    if (user) {
      // No `items` — server uses (and clears) the cart.
    } else {
      payload.items = (items ?? []).map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty }))
      payload.guest = { name: guest.fullName.trim(), email: guest.email.trim(), phone: guest.phone.trim() }
    }
    const res = await api<{ orderId: string; orderNumber: string; grandTotal: number; paymentRequired: boolean }>(
      '/api/orders', { method: 'POST', json: payload }
    )
    if (!res.ok || !res.data) {
      setPlacing(false)
      orderPlacedRef.current = false
      toast.error(res.error ?? 'Could not place order')
      if ((res.error ?? '').toLowerCase().includes('stock') || (res.error ?? '').toLowerCase().includes('cart')) {
        load()
      }
      return
    }
    const { orderId, orderNumber, paymentRequired } = res.data
    if (!paymentRequired) {
      // COD — order is already CONFIRMED
      if (!user) clearGuestCart()
      refreshCartCount()
      setPlacing(false)
      navigate('order-success', { id: orderId, orderNumber })
      return
    }
    setPlacing(false)
    if (paymentMethod === 'RAZORPAY') {
      setPay({ stage: 'processing', orderId, orderNumber })
      setTimeout(() => doRazorpayPay(orderId, orderNumber), 300)
    } else {
      setTimeout(() => doPay(orderId, orderNumber), 1200)
      setPay({ stage: 'processing', orderId, orderNumber })
    }
  }

  if (items === null) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  const guestAddrValid =
    !user &&
    !!(guest.fullName.trim() && guest.phone.trim() && guest.email.trim() && guest.line1.trim() && guest.city.trim() && guest.state && guest.pincode.trim())
  const canPlace = user ? !!selectedAddressObj : guestAddrValid

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-stone-900">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* ------------------------- ADDRESS ------------------------- */}
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-800">
                <MapPin className="h-4 w-4 text-orange-600" /> Delivery address
              </h2>

              {user ? (
                <>
                  {addresses === null ? (
                    <div className="space-y-2">
                      <Skeleton className="h-20 w-full rounded-lg" />
                      <Skeleton className="h-20 w-full rounded-lg" />
                    </div>
                  ) : addresses.length === 0 ? (
                    <p className="mb-3 text-sm text-stone-500">No saved addresses yet. Add one below to continue.</p>
                  ) : (
                    <RadioGroup value={selectedAddr} onValueChange={setSelectedAddr} className="gap-3">
                      {addresses.map((a) => (
                        <Label
                          key={a.id}
                          htmlFor={`addr-${a.id}`}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors',
                            selectedAddr === a.id ? 'border-orange-600 bg-orange-50/60' : 'border-stone-200 hover:border-stone-300'
                          )}
                        >
                          <RadioGroupItem value={a.id} id={`addr-${a.id}`} className="mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-stone-900">{a.fullName}</span>
                              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">{a.type}</span>
                              {a.isDefault ? (
                                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Default
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-stone-500">
                              {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} — {a.pincode}
                            </p>
                            <p className="mt-0.5 text-xs text-stone-500">Phone: {a.phone}</p>
                          </div>
                        </Label>
                      ))}
                    </RadioGroup>
                  )}

                  <Collapsible open={showAddrForm} onOpenChange={setShowAddrForm} className="mt-4">
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="border-orange-600 text-orange-600 hover:bg-orange-50 hover:text-orange-700">
                        <Plus className="mr-1.5 h-4 w-4" /> Add new address
                      </Button>
                    </CollapsibleTrigger>
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
                        <Button onClick={saveAddress} disabled={addrBusy} className="bg-orange-600 text-white hover:bg-orange-700">
                          {addrBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save address
                        </Button>
                        <Button variant="ghost" onClick={() => setShowAddrForm(false)}>Cancel</Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </>
              ) : (
                /* Guest address + contact form */
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Full name *</Label>
                      <Input value={guest.fullName} onChange={(e) => setGuest({ ...guest, fullName: e.target.value })} placeholder="Your name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Phone *</Label>
                      <Input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} placeholder="+91 98765 43210" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email *</Label>
                      <Input type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} placeholder="you@example.com" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Address line 1 (house no, street) *</Label>
                    <Input value={guest.line1} onChange={(e) => setGuest({ ...guest, line1: e.target.value })} placeholder="Flat 402, Green Residency" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Address line 2 (landmark, area)</Label>
                    <Input value={guest.line2} onChange={(e) => setGuest({ ...guest, line2: e.target.value })} placeholder="Near Metro Station" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">City *</Label>
                      <Input value={guest.city} onChange={(e) => setGuest({ ...guest, city: e.target.value })} placeholder="Pune" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">State *</Label>
                      <Select value={guest.state || undefined} onValueChange={(v) => setGuest({ ...guest, state: v })}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Pincode *</Label>
                      <Input value={guest.pincode} onChange={(e) => setGuest({ ...guest, pincode: e.target.value })} placeholder="411001" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ------------------------- PAYMENT ------------------------- */}
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-stone-800">Payment method</h2>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)} className="gap-3">
                {([
                  { id: 'RAZORPAY', icon: Wallet, desc: PAYMENT_BRAND.RAZORPAY, badge: 'Recommended' },
                  { id: 'UPI', icon: Smartphone, desc: PAYMENT_BRAND.UPI, badge: '' },
                  { id: 'CARD', icon: CreditCard, desc: PAYMENT_BRAND.CARD, badge: '' },
                  { id: 'NETBANKING', icon: Landmark, desc: PAYMENT_BRAND.NETBANKING, badge: '' },
                  { id: 'COD', icon: Banknote, desc: `Pay in cash on delivery · +${formatINR(codFee)} handling fee`, badge: '' },
                ] as const).map((m) => (
                  <Label
                    key={m.id}
                    htmlFor={`pay-${m.id}`}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 transition-colors',
                      paymentMethod === m.id ? 'border-orange-600 bg-orange-50/60' : 'border-stone-200 hover:border-stone-300'
                    )}
                  >
                    <RadioGroupItem value={m.id} id={`pay-${m.id}`} />
                    <m.icon className={cn('h-5 w-5', paymentMethod === m.id ? 'text-orange-600' : 'text-stone-400')} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-stone-900">{PAYMENT_LABEL[m.id]}</p>
                      {m.desc ? <p className="text-xs text-stone-500">{m.desc}</p> : null}
                    </div>
                    {m.badge ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{m.badge}</span>
                    ) : null}
                    {m.id === 'COD' ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        +{formatINR(codFee)}
                      </span>
                    ) : null}
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* ------------------------- ORDER SUMMARY ------------------------- */}
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-stone-800">Order summary</h2>
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.vendorName}>
                    <div className="mb-2 flex items-center gap-2">
                      <Store className="h-3.5 w-3.5 text-orange-600" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Sold by {g.vendorName}</span>
                    </div>
                    <div className="space-y-2.5">
                      {g.items.map((i) => (
                        <div key={i.key} className="flex items-center gap-3">
                          <div className="aspect-square w-12 shrink-0 overflow-hidden rounded-md bg-stone-100">
                            {i.image ? (
                              <img src={i.image} alt={i.title} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-stone-800">{i.title}</p>
                            <p className="text-[11px] text-stone-400">
                              {i.variantName ? `${i.variantName} · ` : ''}Qty {i.qty}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-stone-700">{formatINR(i.price * i.qty)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------- TOTALS ------------------------- */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-stone-800">Price Details</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-stone-600">
                  <span>Items total</span>
                  <span className="font-medium text-stone-900">{formatINR(itemsTotal)}</span>
                </div>
                {discount > 0 ? (
                  <div className="flex justify-between text-emerald-600">
                    <span>Coupon ({coupon?.code})</span>
                    <span className="font-medium">−{formatINR(discount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-stone-600">
                  <span>Delivery</span>
                  <span className={cn('font-medium', shipping.total === 0 ? 'text-emerald-600' : 'text-stone-900')}>
                    {shipping.total === 0 ? 'FREE' : formatINR(shipping.total)}
                  </span>
                </div>
                {paymentMethod === 'COD' ? (
                  <div className="flex justify-between text-stone-600">
                    <span>COD handling fee</span>
                    <span className="font-medium text-stone-900">{formatINR(codFee)}</span>
                  </div>
                ) : null}
                <Separator />
                <div className="flex justify-between text-base font-bold text-stone-900">
                  <span>Grand Total</span>
                  <span>{formatINR(grandTotal)}</span>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                <Truck className="h-3.5 w-3.5" /> Free delivery on orders over {formatINR(threshold)}
              </p>
              <Button
                onClick={placeOrder}
                disabled={placing || !canPlace || (items?.length ?? 0) === 0}
                className="mt-4 w-full bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {placing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {placing ? 'Placing order…' : `Place Order · ${formatINR(grandTotal)}`}
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 256-bit SSL secure checkout
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ------------------------- PAYMENT GATEWAY DIALOG ------------------------- */}
      <Dialog
        open={pay !== null}
        onOpenChange={(open) => {
          if (!open) return // never auto-close; explicit buttons only
        }}
      >
        <DialogContent
          className="max-w-sm rounded-xl"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          showCloseButton={false}
        >
          {pay ? (
            <div className="flex flex-col items-center py-4 text-center">
              {pay.stage === 'processing' ? (
                <>
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
                  </div>
                  <DialogTitle className="text-base font-semibold text-stone-900">
                    {PAYMENT_BRAND[paymentMethod] || PAYMENT_LABEL[paymentMethod]}
                  </DialogTitle>
                  <p className="mt-1 text-sm text-stone-500">Processing payment securely…</p>
                  <p className="mt-4 font-mono text-xs text-stone-400">Order {pay.orderNumber}</p>
                </>
              ) : pay.stage === 'success' ? (
                <>
                  <CheckCircle2 className="mb-3 h-16 w-16 text-emerald-500" />
                  <DialogTitle className="text-base font-semibold text-emerald-700">Payment successful</DialogTitle>
                  <p className="mt-1 text-sm text-stone-500">Confirming your order…</p>
                </>
              ) : (
                <>
                  <XCircle className="mb-3 h-16 w-16 text-red-500" />
                  <DialogTitle className="text-base font-semibold text-red-600">Payment failed</DialogTitle>
                  <p className="mt-1 text-sm text-stone-500">
                    Your order is saved. Retry the payment to confirm {pay.orderNumber}.
                  </p>
                  <div className="mt-5 flex w-full flex-col gap-2">
                    <Button
                      onClick={() =>
                        paymentMethod === 'RAZORPAY'
                          ? doRazorpayPay(pay.orderId, pay.orderNumber)
                          : doPay(pay.orderId, pay.orderNumber)
                      }
                      className="w-full bg-orange-600 text-white hover:bg-orange-700"
                    >
                      Retry Payment
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setPay(null)
                        navigate('orders')
                      }}
                    >
                      Pay later — view My Orders
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
