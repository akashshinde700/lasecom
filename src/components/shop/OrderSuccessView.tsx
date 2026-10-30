'use client'

import { useAppStore } from '@/lib/store'
import { etaText } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Package, ArrowRight, ShoppingBag } from 'lucide-react'

export default function OrderSuccessView() {
  const params = useAppStore((s) => s.params)
  const navigate = useAppStore((s) => s.navigate)

  const orderNumber = params.orderNumber ?? '—'

  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-20 w-20 text-emerald-500" strokeWidth={1.6} />
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Order Confirmed!</h1>
          <div className="mt-3 flex justify-center">
            <span className="rounded-full bg-orange-100 px-3 py-1 font-mono text-sm font-semibold text-orange-700">
              {orderNumber}
            </span>
          </div>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-stone-500">
            Thank you for shopping with Lastrivon Kart. You will receive updates about your order
            via notifications and email at every step — packing, shipping and delivery.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
            <Package className="h-4 w-4" />
            {etaText(2, 5)}
          </div>

          <div className="mt-8 flex flex-col gap-2.5">
            <Button
              onClick={() => navigate('order-detail', { id: params.id ?? '' })}
              className="w-full bg-orange-600 text-white hover:bg-orange-700"
            >
              <Package className="mr-2 h-4 w-4" /> Track Order
            </Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="outline" onClick={() => navigate('orders')} className="w-full">
                View My Orders
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('home')}
                className="w-full border-orange-600 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
              >
                Continue Shopping <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="mt-5 text-center text-xs text-stone-400">
        <ShoppingBag className="mr-1 inline h-3.5 w-3.5" />
        Need help? Contact support@lastrivon.in — we reply within 24 hours.
      </p>
    </div>
  )
}
