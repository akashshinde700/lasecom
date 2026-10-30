'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAppStore, api } from '@/lib/store'
import { startRazorpayPayment } from '@/lib/razorpay-client'
import { formatINR, formatDate, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, statusColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/shop/EmptyState'
import {
  ChevronLeft, ChevronRight, Package, PackageOpen, CreditCard,
  RefreshCcw, Eye, Loader2, Wallet,
} from 'lucide-react'

type OrderListItem = {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string | null
  grandTotal: number
  createdAt: string
  itemCount: number
  items: { id: string; titleSnapshot: string; imageSnapshot: string | null; qty: number; unitPrice: number }[]
  vendorCount: number
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  RAZORPAY: 'Razorpay', UPI: 'UPI', CARD: 'Card', NETBANKING: 'NetBanking', COD: 'COD',
}

const IN_PROGRESS = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'PARTIALLY_SHIPPED']
const DELIVERED = ['DELIVERED', 'COMPLETED']
const CANCELLED = ['CANCELLED']

export default function OrdersView() {
  const user = useAppStore((s) => s.user)
  const authLoading = useAppStore((s) => s.authLoading)
  const navigate = useAppStore((s) => s.navigate)
  const params = useAppStore((s) => s.params)

  const [orders, setOrders] = useState<OrderListItem[] | null>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [tab, setTab] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)

  /* Auth gate */
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Please login to view your orders')
      navigate('auth', { redirect: params.redirect ?? 'orders' })
    }
  }, [authLoading, user, navigate, params.redirect])

  const fetchOrders = useCallback((p: number) => {
    api<{ items: OrderListItem[]; total: number; page: number; pages: number }>(
      `/api/orders?page=${p}`
    ).then((res) => {
      if (!res.ok || !res.data) {
        setError(res.error ?? 'Could not load orders')
        setOrders([])
        return
      }
      setOrders(res.data.items)
      setPages(res.data.pages)
      setPage(res.data.page)
    })
  }, [])

  useEffect(() => {
    if (user) fetchOrders(1)
  }, [user, fetchOrders])

  const filtered = (orders ?? []).filter((o) => {
    if (tab === 'progress') return IN_PROGRESS.includes(o.status)
    if (tab === 'delivered') return DELIVERED.includes(o.status)
    if (tab === 'cancelled') return CANCELLED.includes(o.status)
    return true
  })

  const cancelOrder = async (id: string) => {
    setCancelling(true)
    const res = await api(`/api/orders/${id}/cancel`, { method: 'POST' })
    setCancelling(false)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not cancel order')
      return
    }
    toast.success('Order cancelled')
    fetchOrders(page)
  }

  const retryPayment = async (order: OrderListItem) => {
    setPayingId(order.id)
    if (order.paymentMethod === 'RAZORPAY') {
      void startRazorpayPayment({
        orderId: order.id,
        orderNumber: order.orderNumber,
        onSuccess: (id) => {
          setPayingId(null)
          toast.success('Payment successful!')
          navigate('order-detail', { id })
        },
        onDismiss: () => setPayingId(null),
        onError: (msg) => {
          setPayingId(null)
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
    setPayingId(null)
    if (success) {
      toast.success('Payment successful!')
      navigate('order-detail', { id: order.id })
    } else {
      toast.error('Payment failed, try again')
    }
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-40" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-stone-900">My Orders</h1>

      <Tabs value={tab} onValueChange={setTab} className="mb-5">
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
          <TabsTrigger value="progress" className="text-xs sm:text-sm">In Progress</TabsTrigger>
          <TabsTrigger value="delivered" className="text-xs sm:text-sm">Delivered</TabsTrigger>
          <TabsTrigger value="cancelled" className="text-xs sm:text-sm">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-stone-600">{error}</p>
            <Button onClick={() => fetchOrders(page)} variant="outline" size="sm">Retry</Button>
          </CardContent>
        </Card>
      ) : orders === null ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={
            tab === 'cancelled' ? (
              <PackageOpen className="h-7 w-7" />
            ) : (
              <Package className="h-7 w-7" />
            )
          }
          title={
            tab === 'all'
              ? 'No orders yet'
              : tab === 'progress'
                ? 'No orders in progress'
                : tab === 'delivered'
                  ? 'No delivered orders yet'
                  : 'No cancelled orders'
          }
          description={
            tab === 'all'
              ? 'When you place an order it will show up here with live tracking.'
              : 'Try a different filter to see your orders.'
          }
          actionLabel={tab === 'all' ? 'Start Shopping' : undefined}
          onAction={tab === 'all' ? () => navigate('home') : undefined}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((o) => (
            <Card key={o.id} className="rounded-xl border shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                {/* header */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-mono text-sm font-bold text-stone-900">{o.orderNumber}</span>
                  <span className="text-xs text-stone-400">{formatDate(o.createdAt)}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusColor(o.paymentStatus))}>
                    {PAYMENT_STATUS_LABEL[o.paymentStatus] ?? o.paymentStatus}
                  </span>
                  {o.paymentMethod ? (
                    <span className="flex items-center gap-1 text-xs text-stone-500">
                      {o.paymentMethod === 'COD' ? <Wallet className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                      {PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod}
                    </span>
                  ) : null}
                  <span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs font-medium', statusColor(o.status))}>
                    {ORDER_STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>

                {/* thumbnails */}
                <div className="mt-3 flex items-center gap-2.5">
                  {o.items.map((it) => (
                    <div key={it.id} className="aspect-square w-14 shrink-0 overflow-hidden rounded-md bg-stone-100">
                      {it.imageSnapshot ? (
                        <img
                          src={it.imageSnapshot}
                          alt={it.titleSnapshot}
                          className="h-full w-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-stone-300">
                          <Package className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  ))}
                  {o.itemCount > 3 ? (
                    <span className="flex h-14 w-14 items-center justify-center rounded-md bg-stone-100 text-xs font-semibold text-stone-500">
                      +{o.itemCount - 3}
                    </span>
                  ) : null}
                  <div className="ml-auto text-right">
                    <p className="text-[11px] text-stone-400">
                      {o.itemCount} item{o.itemCount !== 1 ? 's' : ''}
                      {o.vendorCount > 1 ? ` · ${o.vendorCount} sellers` : ''}
                    </p>
                    <p className="text-base font-bold text-stone-900">{formatINR(o.grandTotal)}</p>
                  </div>
                </div>

                {/* actions */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('order-detail', { id: o.id })}
                    className="h-8"
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" /> View details
                  </Button>
                  {o.status === 'PENDING_PAYMENT' ? (
                    <Button
                      size="sm"
                      disabled={payingId === o.id}
                      onClick={() => retryPayment(o)}
                      className="h-8 bg-orange-600 text-white hover:bg-orange-700"
                    >
                      {payingId === o.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
                      Retry Payment
                    </Button>
                  ) : null}
                  {(o.status === 'PENDING_PAYMENT' || o.status === 'CONFIRMED') ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700">
                          Cancel Order
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel order {o.orderNumber}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will cancel all items in this order and restore stock.
                            {o.paymentStatus === 'PAID' ? ' Any paid amount will be refunded to your original payment method.' : ''}
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep order</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={cancelling}
                            onClick={(e) => { e.preventDefault(); cancelOrder(o.id) }}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Yes, cancel order
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* pagination */}
          {pages > 1 ? (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline" size="sm" disabled={page <= 1}
                onClick={() => fetchOrders(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-sm text-stone-500">Page {page} of {pages}</span>
              <Button
                variant="outline" size="sm" disabled={page >= pages}
                onClick={() => fetchOrders(page + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
