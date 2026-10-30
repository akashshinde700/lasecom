import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'

/**
 * POST /api/payments/razorpay/create
 * Body: { orderId }
 *
 * Creates a Razorpay Order via the official REST API and returns checkout
 * params for the browser Razorpay Checkout widget.
 *
 * When RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are NOT configured, the route
 * runs in DEMO mode: it returns { mode: 'demo' } with a fake order id so the
 * UI can simulate the Razorpay checkout window. Verification of demo orders
 * is accepted only while keys remain unconfigured (see verify route).
 *
 * Response (live):  { mode: 'live', keyId, razorpayOrderId, verifyToken, amount, currency, orderNumber }
 * Response (demo):  { mode: 'demo', razorpayOrderId, verifyToken, amount, currency, orderNumber }
 *
 * `verifyToken` = HMAC(orderId|razorpayOrderId|amountPaise) — the browser must
 * return it to /verify so the server can bind the gateway order to this
 * internal order + amount (anti-replay across orders).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { orderId?: string }
    if (!body.orderId) throw new HttpError('orderId is required', 400)
    const user = await getSessionUser()

    const order = await db.order.findUnique({
      where: { id: body.orderId },
      include: { payments: { select: { id: true, status: true } } },
    })
    if (!order) throw new HttpError('Order not found', 404)

    // Auth: registered owner only; guest orders are payable with the order id.
    if (order.userId && (!user || user.id !== order.userId)) {
      throw new HttpError('You are not authorized to pay for this order', 403)
    }
    if (order.paymentMethod === 'COD') {
      throw new HttpError('This is a Cash on Delivery order. No online payment is required.', 400)
    }
    if (order.status === 'CANCELLED') throw new HttpError('This order has been cancelled', 409)
    if (order.payments.some((p) => p.status === 'SUCCESS') || order.paymentStatus === 'PAID') {
      return ok({ mode: 'already_paid', orderNumber: order.orderNumber, orderId: order.id })
    }

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    const amountPaise = Math.round(order.grandTotal * 100)
    const signFor = (rpOrderId: string) =>
      createHmac('sha256', keySecret || 'lastrivon-demo-signing')
        .update(`${order.id}|${rpOrderId}|${amountPaise}`)
        .digest('hex')

    const base = {
      amount: amountPaise,
      currency: 'INR',
      orderId: order.id,
      orderNumber: order.orderNumber,
      prefill: {
        name: order.guestName ?? '',
        email: order.guestEmail ?? '',
        contact: order.guestPhone ?? '',
      },
    }

    if (keyId && keySecret) {
      // ---- LIVE mode: call Razorpay Orders API ----
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
      const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt: order.orderNumber,
          notes: { orderId: order.id, orderNumber: order.orderNumber },
        }),
      })
      const rpJson = (await rpRes.json().catch(() => ({}))) as {
        id?: string
        error?: { description?: string }
      }
      if (!rpRes.ok || !rpJson.id) {
        throw new HttpError(
          `Razorpay order creation failed: ${rpJson.error?.description ?? 'unknown error'}`,
          502
        )
      }
      return ok({ mode: 'live', keyId, razorpayOrderId: rpJson.id, verifyToken: signFor(rpJson.id), ...base })
    }

    // ---- DEMO mode (no keys configured) ----
    const demoId = 'demo_order_' + order.id.slice(-10) + '_' + Date.now().toString(36)
    return ok({
      mode: 'demo',
      razorpayOrderId: demoId,
      verifyToken: signFor(demoId),
      ...base,
    })
  } catch (err) {
    return handleError(err)
  }
}
