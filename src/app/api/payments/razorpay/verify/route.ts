import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'
import { markOrderPaid, markLatestPaymentFailed } from '@/lib/order-payment'

/**
 * POST /api/payments/razorpay/verify
 * Body: { orderId, verifyToken, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * BINDING: `verifyToken` is the HMAC (issued by /create) over
 * `${orderId}|${razorpayOrderId}|${amountPaise}` — it proves this Razorpay
 * order was issued by us FOR this internal order at this amount. Without it,
 * a valid (rp_order, rp_payment, sig) triple paid for order A could be
 * replayed to confirm expensive order B.
 *
 * LIVE mode: additionally verifies the standard Razorpay HMAC-SHA256
 *   hmac_sha256(RAZORPAY_KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`)
 * against razorpay_signature, using a timing-safe comparison.
 *
 * DEMO mode (no keys configured, non-production only): accepts `demo_*`
 * payment ids with a self-declared signature so the simulated checkout can
 * complete. Rejected automatically once real keys are configured.
 *
 * On success: shared payment state machine (order CONFIRMED + PAID,
 * suborders CONFIRMED, ledger entries, notifications).
 */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqualSafe(ab, bb)
}
function timingSafeEqualSafe(a: Buffer, b: Buffer): boolean {
  try {
    return timingSafeEqual(a, b)
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
    if (order.userId && (!user || user.id !== order.userId)) {
      throw new HttpError('You are not authorized to pay for this order', 403)
    }
    if (order.status === 'CANCELLED') throw new HttpError('This order has been cancelled', 409)

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    const isDemoPayment = razorpay_payment_id.startsWith('demo_')

    // ---- Server-side order binding (anti-replay across orders) ----
    if (!verifyToken) throw new HttpError('Missing payment verification token', 400)
    const expectedToken = createHmac('sha256', keySecret || 'lastrivon-demo-signing')
      .update(`${order.id}|${razorpay_order_id}|${Math.round(order.grandTotal * 100)}`)
      .digest('hex')
    if (!safeEqual(verifyToken, expectedToken)) {
      throw new HttpError('Payment verification failed: order mismatch', 400)
    }

    if (keyId && keySecret) {
      // ---- LIVE signature verification ----
      if (isDemoPayment) throw new HttpError('Demo payments are not accepted', 400)
      const expected = createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex')
      if (!razorpay_signature || !safeEqual(razorpay_signature, expected)) {
        await markLatestPaymentFailed(order.id, 'RAZORPAY')
        throw new HttpError('Payment verification failed: signature mismatch', 400)
      }
    } else {
      // ---- DEMO acceptance (only while keys are unconfigured, never in production) ----
      if (process.env.NODE_ENV === 'production') {
        throw new HttpError('Payment gateway is not configured', 400)
      }
      if (!isDemoPayment) {
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
