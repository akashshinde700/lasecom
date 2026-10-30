'use client'

//
// Razorpay client helper — single entry point to start a Razorpay payment.
//
// LIVE mode (RAZORPAY_KEY_ID configured on the server):
//   loads checkout.razorpay.com/v1/checkout.js once and opens the official
//   Razorpay Checkout; on success the signature is verified server-side via
//   POST /api/payments/razorpay/verify.
//
// DEMO mode (keys not configured):
//   renders a simulated Razorpay-style checkout overlay so the full flow
//   (create order -> pay -> verify -> order confirmed) can be experienced
//   end-to-end without real keys.
//

import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import RazorpayDemoModal, { type DemoResult } from '@/components/shop/RazorpayDemoModal'

type RazorpayHandlerResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  order_id: string
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  modal?: { ondismiss?: () => void }
  handler: (response: RazorpayHandlerResponse) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void }
  }
}

let scriptLoading: Promise<boolean> | null = null

function loadCheckoutJs(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)
  if (scriptLoading) return scriptLoading
  scriptLoading = new Promise<boolean>((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => {
      scriptLoading = null
      resolve(false)
    }
    document.body.appendChild(script)
  })
  return scriptLoading
}

export type RazorpayStartResult = 'success' | 'dismissed' | 'failed'

export type StartRazorpayArgs = {
  orderId: string
  orderNumber: string
  description?: string
  prefill?: { name?: string; email?: string; contact?: string }
  /** Called once the payment is verified and the order is confirmed. */
  onSuccess?: (orderId: string, orderNumber: string) => void
  /** Called when the user dismisses the checkout or verification fails. */
  onDismiss?: () => void
  onError?: (message: string) => void
}

/**
 * Starts the Razorpay payment flow for an existing PENDING_PAYMENT order.
 * Returns 'success' when verified, 'dismissed' when the user closed the
 * window, or 'failed' on errors. Also fires the optional callbacks.
 */
export async function startRazorpayPayment(args: StartRazorpayArgs): Promise<RazorpayStartResult> {
  const { orderId, orderNumber } = args

  let createRes: {
    ok: boolean
    error?: string
    data?: {
      mode: 'live' | 'demo' | 'already_paid'
      keyId?: string
      razorpayOrderId?: string
      verifyToken?: string
      amount: number
      currency: string
      orderNumber: string
      prefill?: { name?: string; email?: string; contact?: string }
    }
  }
  try {
    const res = await fetch('/api/payments/razorpay/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ orderId }),
    })
    createRes = await res.json()
  } catch {
    args.onError?.('Network error while starting the payment. Please try again.')
    return 'failed'
  }

  if (!createRes.ok || !createRes.data) {
    args.onError?.(createRes.error ?? 'Could not start the payment. Please try again.')
    return 'failed'
  }
  if (createRes.data.mode === 'already_paid') {
    args.onSuccess?.(orderId, orderNumber)
    return 'success'
  }

  const { mode, amount, currency, razorpayOrderId, prefill } = createRes.data

  // ---------------- LIVE: official Razorpay Checkout ----------------
  if (mode === 'live' && createRes.data.keyId && razorpayOrderId) {
    const loaded = await loadCheckoutJs()
    if (!loaded || !window.Razorpay) {
      args.onError?.('Could not load the payment gateway. Check your connection and retry.')
      return 'failed'
    }
    return new Promise<RazorpayStartResult>((resolve) => {
      let settled = false
      const finish = (result: RazorpayStartResult) => {
        if (settled) return
        settled = true
        resolve(result)
      }
      const rzp = new window.Razorpay!({
        key: createRes.data!.keyId!,
        amount,
        currency,
        name: 'Lastrivon Kart India',
        description: args.description ?? `Order ${orderNumber}`,
        order_id: razorpayOrderId,
        prefill: prefill ?? args.prefill,
        theme: { color: '#ea580c' },
        modal: {
          ondismiss: () => {
            args.onDismiss?.()
            finish('dismissed')
          },
        },
        handler: async (response) => {
          try {
            const verifyRes = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ orderId, verifyToken: createRes.data!.verifyToken, ...response }),
            })
            const verifyJson = await verifyRes.json()
            if (verifyJson.ok) {
              args.onSuccess?.(orderId, orderNumber)
              finish('success')
            } else {
              args.onError?.(verifyJson.error ?? 'Payment verification failed.')
              args.onDismiss?.()
              finish('failed')
            }
          } catch {
            args.onError?.('Payment verification failed due to a network error.')
            args.onDismiss?.()
            finish('failed')
          }
        },
      })
      rzp.open()
    })
  }

  // ---------------- DEMO: simulated Razorpay checkout ----------------
  if (mode === 'demo' && razorpayOrderId) {
    const container = document.createElement('div')
    container.setAttribute('data-razorpay-demo-root', '')
    document.body.appendChild(container)
    const root: Root = createRoot(container)

    return new Promise<RazorpayStartResult>((resolve) => {
      let settled = false
      const cleanup = (result: RazorpayStartResult) => {
        if (settled) return
        settled = true
        setTimeout(() => {
          root.unmount()
          container.remove()
        }, result === 'success' ? 350 : 0)
        resolve(result)
      }
      const el = createElement(RazorpayDemoModal, {
        amount,
        orderNumber,
        prefill: prefill ?? args.prefill,
        onDone: async (result: DemoResult) => {
          if (result === 'cancel') {
            args.onDismiss?.()
            cleanup('dismissed')
            return
          }
          // simulate the gateway verification round-trip
          try {
            const verifyRes = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                orderId,
                verifyToken: createRes.data!.verifyToken,
                razorpay_order_id: razorpayOrderId,
                razorpay_payment_id: `demo_pay_${Date.now().toString(36)}`,
                razorpay_signature: 'demo',
              }),
            })
            const verifyJson = await verifyRes.json()
            if (verifyJson.ok) {
              args.onSuccess?.(orderId, orderNumber)
              cleanup('success')
            } else {
              args.onError?.(verifyJson.error ?? 'Payment verification failed.')
              args.onDismiss?.()
              cleanup('failed')
            }
          } catch {
            args.onError?.('Payment verification failed due to a network error.')
            args.onDismiss?.()
            cleanup('failed')
          }
        },
      })
      root.render(el)
    })
  }

  args.onError?.('Unexpected payment gateway response.')
  return 'failed'
}
