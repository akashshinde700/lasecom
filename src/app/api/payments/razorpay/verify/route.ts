import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, canAccessOrder } from '@/lib/api'
import { getSessionUser, getSigningSecret } from '@/lib/auth'
import { markOrderPaid, markLatestPaymentFailed, isMockPaymentAllowed } from '@/lib/order-payment'

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  try {
    return timingSafeEqual(ab, bb)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      orderId?: string
      verifyToken?: string
      razorpay_order_id?: string
      razorpay_payment_id?: string
      razorpay_signature?: string
    }
    const { orderId, verifyToken, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body
    if (!orderId || !razorpay_order_id || !razorpay_payment_id) {
      throw new HttpError('Missing payment verification fields', 400)
    }

    const user = await getSessionUser()
    const order = await db.order.findUnique({ where: { id: orderId } })
    if (!order) throw new HttpError('Order not found', 404)
    if (!(await canAccessOrder(order, user))) {
      throw new HttpError('You are not authorized to pay for this order', 403)
    }
    if (order.status === 'CANCELLED') throw new HttpError('This order has been cancelled', 409)

    const keyId = process.env.RAZORPAY_KEY_ID?.trim()
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim()
    const signingKey = keySecret || getSigningSecret()
    const isDemoPayment = razorpay_payment_id.startsWith('demo_')

    // ---- Server-side order binding (anti-replay across orders) ----
    if (!verifyToken) throw new HttpError('Missing payment verification token', 400)
    const expectedToken = createHmac('sha256', signingKey)
      .update(`${order.id}|${razorpay_order_id}|${Math.round(order.grandTotal * 100)}`)
      .digest('hex')
    if (!safeEqual(verifyToken, expectedToken)) {
      throw new HttpError('Payment verification failed: order mismatch', 400)
    }

    if (keyId && keySecret) {
      // ---- LIVE signature verification ----
      if (isDemoPayment || razorpay_order_id.startsWith('demo_')) {
        throw new HttpError('Demo payments are not accepted', 400)
      }
      const expected = createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex')
      if (!razorpay_signature || !safeEqual(razorpay_signature, expected)) {
        await markLatestPaymentFailed(order.id, 'RAZORPAY')
        throw new HttpError('Payment verification failed: signature mismatch', 400)
      }
    } else {
      // ---- DEMO acceptance (only while keys are unconfigured and mock payments are allowed) ----
      if (!isMockPaymentAllowed() || !isDemoPayment || !razorpay_order_id.startsWith('demo_order_')) {
        throw new HttpError('Payment gateway is not configured', 400)
      }
    }

    const result = await markOrderPaid(order.id, {
      gatewayRef: razorpay_payment_id,
      method: 'RAZORPAY',
      feePercent: 0.02,
    })
    return ok(result)
  } catch (err) {
    return handleError(err)
  }
}
