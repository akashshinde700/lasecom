'use client'

//
// RazorpayDemoModal — pixel-inspired simulation of the Razorpay Checkout
// window used when no real RAZORPAY_KEY_ID is configured. Fully self-contained
// (rendered via createRoot from lib/razorpay-client.ts) with focus trap,
// Escape handling and a realistic pay -> processing -> verified flow.
//

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock, ShieldCheck, Smartphone, CreditCard, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DemoResult = 'paid' | 'cancel'

type Props = {
  amount: number // paise
  orderNumber: string
  prefill?: { name?: string; email?: string; contact?: string }
  onDone: (result: DemoResult) => void
}

type Method = 'upi' | 'card' | 'netbanking'

export default function RazorpayDemoModal({ amount, orderNumber, prefill, onDone }: Props) {
  const [method, setMethod] = useState<Method>('upi')
  const [stage, setStage] = useState<'select' | 'processing' | 'done'>('select')
  const [vpa, setVpa] = useState(() => {
    const digits = (prefill?.contact ?? '').replace(/\D/g, '')
    return digits.length === 10 ? `${digits}@upi` : ''
  })

  const inr = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })

  const handlePay = useCallback(() => {
    if (method === 'upi' && !/^[^\s@]+@[^\s@]+$/.test(vpa.trim())) return
    setStage('processing')
    setTimeout(() => {
      setStage('done')
      setTimeout(() => onDone('paid'), 900)
    }, 1400)
  }, [method, vpa, onDone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stage === 'select') onDone('cancel')
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [stage, onDone])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Razorpay checkout"
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#0b2559] px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-lg font-black tracking-tight">R</span>
            <div>
              <p className="text-sm font-semibold leading-tight">Lastrivon Kart India</p>
              <p className="text-[11px] leading-tight text-white/60">Order {orderNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold">{inr(amount)}</span>
            {stage === 'select' ? (
              <button
                type="button"
                aria-label="Close checkout"
                onClick={() => onDone('cancel')}
                className="rounded-full p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        {stage === 'select' ? (
          <div className="max-h-[70vh] overflow-y-auto p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Choose payment method</p>

            {/* UPI */}
            <button
              type="button"
              onClick={() => setMethod('upi')}
              className={cn(
                'mb-3 w-full rounded-xl border-2 p-3.5 text-left transition-colors',
                method === 'upi' ? 'border-[#0b2559] bg-[#0b2559]/5' : 'border-stone-200 hover:border-stone-300'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Smartphone className={cn('size-4', method === 'upi' ? 'text-[#0b2559]' : 'text-stone-400')} />
                <span className="text-sm font-semibold text-stone-800">UPI</span>
                <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Recommended</span>
              </div>
              {method === 'upi' ? (
                <div className="mt-3">
                  <input
                    value={vpa}
                    onChange={(e) => setVpa(e.target.value)}
                    placeholder="yourname@upi"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#0b2559]"
                    aria-label="UPI ID"
                  />
                  <div className="mt-2 flex gap-2 text-[11px] font-medium text-stone-400">
                    <span className="rounded border border-stone-200 px-1.5 py-0.5">GPay</span>
                    <span className="rounded border border-stone-200 px-1.5 py-0.5">PhonePe</span>
                    <span className="rounded border border-stone-200 px-1.5 py-0.5">Paytm</span>
                    <span className="rounded border border-stone-200 px-1.5 py-0.5">BHIM</span>
                  </div>
                </div>
              ) : null}
            </button>

            {/* Card */}
            <button
              type="button"
              onClick={() => setMethod('card')}
              className={cn(
                'mb-3 w-full rounded-xl border-2 p-3.5 text-left transition-colors',
                method === 'card' ? 'border-[#0b2559] bg-[#0b2559]/5' : 'border-stone-200 hover:border-stone-300'
              )}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className={cn('size-4', method === 'card' ? 'text-[#0b2559]' : 'text-stone-400')} />
                <span className="text-sm font-semibold text-stone-800">Credit / Debit Card</span>
              </div>
              {method === 'card' ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input
                    defaultValue="4111 1111 1111 1111"
                    className="col-span-2 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#0b2559]"
                    aria-label="Card number"
                  />
                  <input defaultValue="12/28" className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#0b2559]" aria-label="Expiry" />
                  <input defaultValue="123" type="password" className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#0b2559]" aria-label="CVV" />
                </div>
              ) : null}
            </button>

            {/* Netbanking */}
            <button
              type="button"
              onClick={() => setMethod('netbanking')}
              className={cn(
                'w-full rounded-xl border-2 p-3.5 text-left transition-colors',
                method === 'netbanking' ? 'border-[#0b2559] bg-[#0b2559]/5' : 'border-stone-200 hover:border-stone-300'
              )}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className={cn('size-4', method === 'netbanking' ? 'text-[#0b2559]' : 'text-stone-400')} />
                <span className="text-sm font-semibold text-stone-800">Net Banking</span>
              </div>
              {method === 'netbanking' ? (
                <div className="mt-3 flex gap-2 text-[11px] font-medium text-stone-400">
                  <span className="rounded border border-stone-200 px-1.5 py-0.5">HDFC</span>
                  <span className="rounded border border-stone-200 px-1.5 py-0.5">ICICI</span>
                  <span className="rounded border border-stone-200 px-1.5 py-0.5">SBI</span>
                  <span className="rounded border border-stone-200 px-1.5 py-0.5">Axis</span>
                </div>
              ) : null}
            </button>

            <button
              type="button"
              onClick={handlePay}
              disabled={method === 'upi' && !/^[^\s@]+@[^\s@]+$/.test(vpa.trim())}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b2559] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#12336f] disabled:opacity-50"
            >
              <Lock className="size-3.5" /> Pay {inr(amount)}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-stone-400">
              <ShieldCheck className="size-3" /> Demo checkout — no real money moves. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env for live payments.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            {stage === 'processing' ? (
              <>
                <Loader2 className="mb-4 size-10 animate-spin text-[#0b2559]" />
                <p className="text-sm font-semibold text-stone-800">Processing your payment…</p>
                <p className="mt-1 text-xs text-stone-500">Do not close this window</p>
              </>
            ) : (
              <>
                <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-100">
                  <ShieldCheck className="size-7 text-emerald-600" />
                </span>
                <p className="text-sm font-semibold text-emerald-700">Payment verified</p>
                <p className="mt-1 text-xs text-stone-500">Confirming your order…</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
