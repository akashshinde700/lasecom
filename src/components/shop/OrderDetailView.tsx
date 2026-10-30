'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAppStore, api } from '@/lib/store'
import { startRazorpayPayment } from '@/lib/razorpay-client'
import {
  formatINR, formatINR2, formatDate, formatDateTime, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL,
  SUBORDER_FLOW, statusColor, etaText,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { openDocument, type DocRequestKind } from '@/lib/documents'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Banknote, Check, CheckCircle2, Copy, CreditCard, Download, FileText, Loader2,
  MapPin, Package, RefreshCcw, Store, Truck, Wallet, XCircle,
} from 'lucide-react'

type OrderItemDetail = {
  id: string
  productId: string
  titleSnapshot: string
  variantName: string | null
  imageSnapshot: string | null
  unitPrice: number
  qty: number
  lineTotal: number
  status: string
  product: { slug: string } | null
}

type SubOrderDetail = {
  id: string
  vendor: { name: string; slug: string } | null
  status: string
  itemsTotal: number
  shippingFee: number
  trackingNumber: string | null
  courierName: string | null
  items: OrderItemDetail[]
  events: { id?: string; status: string; note: string | null; createdAt: string }[]
}

type PaymentRow = { method: string; amount: number; status: string; createdAt: string }

type OrderDetail = {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string | null
  itemsTotal: number
  discountTotal: number
  shippingTotal: number
  grandTotal: number
  couponCode: string | null
  couponDiscount: number
  createdAt: string
  shippingAddress: { fullName?: string; phone?: string; line1?: string; line2?: string | null; city?: string; state?: string; pincode?: string } | null
  subOrders: SubOrderDetail[]
  payments: PaymentRow[]
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  RAZORPAY: 'Razorpay', UPI: 'UPI', CARD: 'Card', NETBANKING: 'Net Banking', COD: 'Cash on Delivery',
}

const RETURN_REASONS = [
  'Damaged / Defective',
  'Wrong item received',
  'Missing parts or accessories',
  'Not as described',
  'Size or fit issue',
  'Changed my mind',
]

const EVENT_LABEL: Record<string, string> = {
  CONFIRMED: 'Order Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export default function OrderDetailView() {
  const user = useAppStore((s) => s.user)
  const authLoading = useAppStore((s) => s.authLoading)
  const navigate = useAppStore((s) => s.navigate)
  const params = useAppStore((s) => s.params)

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  /* return dialog */
  const [returnItem, setReturnItem] = useState<OrderItemDetail | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [returnComment, setReturnComment] = useState('')
  const [returnBusy, setReturnBusy] = useState(false)

  /* Auth gate */
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Please login to view your order')
      navigate('auth', { redirect: 'order-detail' })
    }
  }, [authLoading, user, navigate])

  const fetchOrder = useCallback(() => {
    const id = params.id
    if (!id) return
    api<{ order: OrderDetail }>(`/api/orders/${id}`).then((res) => {
      if (!res.ok || !res.data) {
        setError(res.error ?? 'Could not load order')
        return
      }
      setOrder(res.data.order)
    })
  }, [params.id])

  useEffect(() => {
    if (user) fetchOrder()
  }, [user, fetchOrder])

  const retryPayment = async () => {
    if (!order) return
    setPaying(true)
    if (order.paymentMethod === 'RAZORPAY') {
      void startRazorpayPayment({
        orderId: order.id,
        orderNumber: order.orderNumber,
        onSuccess: () => {
          setPaying(false)
          toast.success('Payment successful!')
          fetchOrder()
        },
        onDismiss: () => setPaying(false),
        onError: (msg) => {
          setPaying(false)
          toast.error(msg)
        },
      })
      return
    }
    let success = false
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await api<{ status: 'SUCCESS' | 'FAILED' }>(`/api/payments/${order.id}/pay`, {
        method: 'POST', json: {},
      })
      if (res.ok && res.data?.status === 'SUCCESS') {
        success = true
        break
      }
    }
    setPaying(false)
    if (success) {
      toast.success('Payment successful!')
      fetchOrder()
    } else {
      toast.error('Payment failed, please try again')
    }
  }

  const cancelOrder = async () => {
    if (!order) return
    setCancelling(true)
    const res = await api(`/api/orders/${order.id}/cancel`, { method: 'POST' })
    setCancelling(false)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not cancel order')
      fetchOrder()
      return
    }
    toast.success('Order cancelled')
    fetchOrder()
  }

  const submitReturn = async () => {
    if (!order || !returnItem) return
    if (!returnReason) {
      toast.error('Please select a return reason')
      return
    }
    setReturnBusy(true)
    const res = await api(`/api/orders/${order.id}/return`, {
      method: 'POST',
      json: { orderItemId: returnItem.id, reason: returnReason, comment: returnComment.trim() || undefined },
    })
    setReturnBusy(false)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not create return request')
      return
    }
    toast.success('Return request submitted. The seller will review it shortly.')
    setReturnItem(null)
    setReturnReason('')
    setReturnComment('')
    fetchOrder()
  }

  const copyTracking = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Tracking number copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  const downloadDoc = async (kind: DocRequestKind) => {
    if (!order) return
    const res = await openDocument(kind, order.id)
    if (!res.ok) toast.error(res.error ?? 'Could not generate the document')
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-56" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
      </div>
    )
  }
  if (!user) return null

  if (!params.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <XCircle className="mx-auto mb-3 h-12 w-12 text-red-400" />
        <p className="font-medium text-stone-800">Order not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Orders
        </Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <XCircle className="mx-auto mb-3 h-12 w-12 text-red-400" />
        <p className="font-medium text-stone-800">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Orders
        </Button>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-56" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
      </div>
    )
  }

  const addr = order.shippingAddress
  const canCancel =
    (order.status === 'CONFIRMED' || order.status === 'PENDING_PAYMENT') &&
    !order.subOrders.some((s) => ['SHIPPED', 'DELIVERED'].includes(s.status))
  // mirrors the server rule in /api/documents: tax invoice once paid, proforma before
  const isPaid =
    order.paymentStatus === 'PAID' ||
    (order.paymentMethod === 'COD' && ['DELIVERED', 'COMPLETED'].includes(order.status))
  const hasReturns = order.subOrders.some((s) =>
    s.items.some((i) => ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURNED', 'REFUNDED'].includes(i.status))
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <button
        onClick={() => navigate('orders')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800"
      >
        <ArrowLeft className="h-4 w-4" /> My Orders
      </button>

      {/* ------------------------- HEADER ------------------------- */}
      <Card className="mb-5 rounded-xl border shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-mono text-xl font-bold text-stone-900">{order.orderNumber}</h1>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusColor(order.status))}>
              {ORDER_STATUS_LABEL[order.status] ?? order.status}
            </span>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusColor(order.paymentStatus))}>
              {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-sm text-stone-500">
              {order.paymentMethod === 'COD' ? <Wallet className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              {PAYMENT_METHOD_LABEL[order.paymentMethod ?? ''] ?? order.paymentMethod}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-400">
            <span>Placed on {formatDateTime(order.createdAt)}</span>
            {order.status !== 'CANCELLED' ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <Truck className="h-3.5 w-3.5" /> {etaText(2, 5)}
              </span>
            ) : null}
          </div>

          {/* retry payment banner */}
          {order.status === 'PENDING_PAYMENT' ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
              <div className="flex items-center gap-2.5">
                <Banknote className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Payment pending</p>
                  <p className="text-xs text-amber-700">
                    Complete your payment of {formatINR(order.grandTotal)} to confirm this order.
                  </p>
                </div>
              </div>
              <Button
                size="sm" onClick={retryPayment} disabled={paying}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                {paying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
                Pay Now
              </Button>
            </div>
          ) : null}

          {canCancel ? (
            <div className="mt-4 flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700">
                    Cancel Order
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel order {order.orderNumber}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All items in this order will be cancelled and stock restored.
                      {order.paymentStatus === 'PAID' ? ' Any paid amount will be refunded to your original payment method.' : ''}
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep order</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={cancelling}
                      onClick={(e) => { e.preventDefault(); cancelOrder() }}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Yes, cancel order
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ------------------------- SUBORDERS ------------------------- */}
      <div className="space-y-5">
        {order.subOrders.map((sub) => {
          const flowIdx = SUBORDER_FLOW.indexOf(sub.status)
          return (
            <Card key={sub.id} className="rounded-xl border shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Store className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-semibold text-stone-900">
                    Sold by {sub.vendor?.name ?? 'Lastrivon Retail'}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusColor(sub.status))}>
                    {ORDER_STATUS_LABEL[sub.status] ?? sub.status}
                  </span>
                  {sub.status !== 'CANCELLED' ? (
                    <span className="ml-auto text-xs text-stone-400">{etaText(2, 5)}</span>
                  ) : null}
                </div>

                {/* progress tracker */}
                {sub.status !== 'CANCELLED' ? (
                  <div className="mt-5 px-1">
                    <div className="flex items-center">
                      {SUBORDER_FLOW.map((step, idx) => {
                        const done = flowIdx >= idx && flowIdx !== -1
                        return (
                          <div key={step} className={cn('flex items-center', idx < SUBORDER_FLOW.length - 1 && 'flex-1')}>
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  'flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors',
                                  done
                                    ? 'border-orange-600 bg-orange-600 text-white'
                                    : 'border-stone-300 bg-white text-stone-400'
                                )}
                              >
                                {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                              </div>
                              <span className={cn('mt-1 w-16 text-center text-[10px] leading-tight', done ? 'font-medium text-stone-700' : 'text-stone-400')}>
                                {ORDER_STATUS_LABEL[step] ?? step}
                              </span>
                            </div>
                            {idx < SUBORDER_FLOW.length - 1 ? (
                              <div className={cn('mb-4 h-0.5 flex-1', flowIdx > idx ? 'bg-orange-600' : 'bg-stone-200')} />
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {/* tracking */}
                {sub.trackingNumber ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 p-3">
                    <Truck className="h-4 w-4 text-violet-600" />
                    <span className="text-xs text-stone-600">
                      <span className="font-medium text-stone-800">{sub.courierName ?? 'Courier'}</span>
                    </span>
                    <span className="font-mono text-xs font-semibold text-stone-800">{sub.trackingNumber}</span>
                    <button
                      onClick={() => copyTracking(sub.trackingNumber ?? '')}
                      className="ml-auto flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-100"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                ) : null}

                {/* timeline + items */}
                <div className="mt-4 grid gap-5 md:grid-cols-[220px_1fr]">
                  {sub.events.length > 0 ? (
                    <div>
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Shipment timeline</p>
                      <div className="space-y-0">
                        {[...sub.events].reverse().map((ev, idx, arr) => (
                          <div key={ev.id ?? idx} className="relative flex gap-3 pb-4">
                            {idx < arr.length - 1 ? (
                              <div className="absolute left-[5px] top-4 h-full w-0.5 bg-stone-200" />
                            ) : null}
                            <div
                              className={cn(
                                'relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                                idx === 0 ? 'bg-orange-600 ring-4 ring-orange-100' : 'bg-stone-300'
                              )}
                            />
                            <div className="min-w-0">
                              <p className={cn('text-xs font-medium', idx === 0 ? 'text-stone-900' : 'text-stone-600')}>
                                {EVENT_LABEL[ev.status] ?? ev.status}
                              </p>
                              <p className="text-[11px] text-stone-400">{formatDateTime(ev.createdAt)}</p>
                              {ev.note ? <p className="mt-0.5 text-[11px] leading-snug text-stone-500">{ev.note}</p> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className={cn(sub.events.length === 0 && 'md:col-span-2')}>
                    <div className="divide-y divide-stone-100 rounded-lg border border-stone-100">
                      {sub.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-3">
                          <button
                            onClick={() => item.product?.slug && navigate('product', { slug: item.product.slug })}
                            className="aspect-square w-14 shrink-0 overflow-hidden rounded-md bg-stone-100"
                            aria-label={item.titleSnapshot}
                          >
                            {item.imageSnapshot ? (
                              <img
                                src={item.imageSnapshot}
                                alt={item.titleSnapshot}
                                className="h-full w-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-stone-300">
                                <Package className="h-5 w-5" />
                              </div>
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <button
                              onClick={() => item.product?.slug && navigate('product', { slug: item.product.slug })}
                              className="line-clamp-1 text-left text-xs font-medium text-stone-900 hover:text-orange-700"
                            >
                              {item.titleSnapshot}
                            </button>
                            <p className="text-[11px] text-stone-400">
                              {item.variantName ? `${item.variantName} · ` : ''}{item.qty} × {formatINR(item.unitPrice)}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs font-semibold text-stone-900">{formatINR(item.lineTotal)}</span>
                              {item.status !== 'ACTIVE' ? (
                                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusColor(item.status))}>
                                  {item.status === 'RETURN_REQUESTED' ? 'Return Requested' : ORDER_STATUS_LABEL[item.status] ?? item.status}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {sub.status === 'DELIVERED' && item.status === 'ACTIVE' ? (
                            <Button
                              size="sm" variant="outline" className="h-7 shrink-0 text-xs"
                              onClick={() => setReturnItem(item)}
                            >
                              Return
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-end gap-4 text-[11px] text-stone-400">
                      <span>Items: {formatINR(sub.itemsTotal)}</span>
                      <span>Delivery: {sub.shippingFee === 0 ? 'FREE' : formatINR(sub.shippingFee)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ------------------------- ADDRESS + BILL ------------------------- */}
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-800">
              <MapPin className="h-4 w-4 text-orange-600" /> Delivery address
            </h3>
            {addr ? (
              <div className="text-sm leading-relaxed text-stone-600">
                <p className="font-medium text-stone-900">{addr.fullName}</p>
                <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                <p>{addr.city}, {addr.state} — {addr.pincode}</p>
                <p className="mt-1 text-xs text-stone-400">Phone: {addr.phone}</p>
              </div>
            ) : (
              <p className="text-sm text-stone-400">Address unavailable</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-stone-800">Bill summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>Items total</span>
                <span className="font-medium text-stone-900">{formatINR2(order.itemsTotal)}</span>
              </div>
              {order.couponDiscount > 0 ? (
                <div className="flex justify-between text-emerald-600">
                  <span>Coupon discount ({order.couponCode})</span>
                  <span className="font-medium">−{formatINR2(order.couponDiscount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-stone-600">
                <span>Delivery</span>
                <span className={cn('font-medium', order.shippingTotal === 0 ? 'text-emerald-600' : 'text-stone-900')}>
                  {order.shippingTotal === 0 ? 'FREE' : formatINR2(order.shippingTotal)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold text-stone-900">
                <span>Grand Total</span>
                <span>{formatINR2(order.grandTotal)}</span>
              </div>
            </div>

            {order.payments.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Payments</p>
                <div className="space-y-1.5">
                  {order.payments.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {p.method === 'COD' ? <Wallet className="h-3.5 w-3.5 text-stone-400" /> : <CreditCard className="h-3.5 w-3.5 text-stone-400" />}
                      <span className="text-stone-600">{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</span>
                      <span className="font-medium text-stone-800">{formatINR2(p.amount)}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusColor(p.status))}>
                        {PAYMENT_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                      <span className="ml-auto text-stone-400">{formatDateTime(p.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <Button
              variant="outline" onClick={() => downloadDoc('invoice')}
              className="mt-4 w-full border-stone-300 text-stone-700 hover:bg-stone-50"
            >
              <Download className="mr-2 h-4 w-4" />
              {isPaid ? 'Tax Invoice' : 'Proforma Invoice'} <FileText className="ml-1 h-3 w-3 opacity-50" />
            </Button>
            {hasReturns ? (
              <Button
                variant="outline" onClick={() => downloadDoc('purchase-return')}
                className="mt-2 w-full border-stone-300 text-stone-700 hover:bg-stone-50"
              >
                <Download className="mr-2 h-4 w-4" />
                Purchase Return <FileText className="ml-1 h-3 w-3 opacity-50" />
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* ------------------------- RETURN DIALOG ------------------------- */}
      <Dialog open={returnItem !== null} onOpenChange={(open) => !open && setReturnItem(null)}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>Return item</DialogTitle>
          </DialogHeader>
          {returnItem ? (
            <div className="flex items-center gap-3 rounded-lg bg-stone-50 p-3">
              <div className="aspect-square w-12 shrink-0 overflow-hidden rounded-md bg-stone-100">
                {returnItem.imageSnapshot ? (
                  <img src={returnItem.imageSnapshot} alt={returnItem.titleSnapshot} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="line-clamp-1 text-xs font-medium text-stone-900">{returnItem.titleSnapshot}</p>
                <p className="text-[11px] text-stone-400">{formatINR(returnItem.lineTotal)}</p>
              </div>
            </div>
          ) : null}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Reason for return</Label>
              <Select value={returnReason || undefined} onValueChange={setReturnReason}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Additional comments <span className="font-normal text-stone-400">(optional)</span>
              </Label>
              <Textarea
                rows={3}
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                placeholder="Tell us more about the issue…"
              />
            </div>
            <p className="flex items-start gap-1.5 rounded-lg bg-orange-50 p-2.5 text-[11px] leading-relaxed text-orange-800">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              7-day easy returns. Once the seller approves, a pickup is scheduled and your refund is processed to the original payment method.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReturnItem(null)}>Cancel</Button>
            <Button onClick={submitReturn} disabled={returnBusy} className="bg-orange-600 text-white hover:bg-orange-700">
              {returnBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
