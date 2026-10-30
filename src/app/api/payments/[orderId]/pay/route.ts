import { randomBytes } from 'crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'
import { markOrderPaid, markLatestPaymentFailed } from '@/lib/order-payment'

/**
 * POST /api/payments/:orderId/pay — legacy mock payment gateway.
 * - Idempotent: a SUCCESS payment (or PAID order) returns immediately.
 * - Simulates ~90% success.
 * - SUCCESS state machine lives in lib/order-payment.ts (shared with Razorpay
 *   verify route): payment SUCCESS (fee 2%), order CONFIRMED + PAID, suborders
 *   CONFIRMED, ShipmentEvent CONFIRMED, VendorLedger entries, notifications.
 * - FAILED: payment row FAILED, order stays PENDING_PAYMENT (retry allowed).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params
    const user = await getSessionUser()

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        subOrders: { include: { vendor: { select: { id: true, ownerId: true } } } },
        payments: { select: { id: true, status: true } },
      },
    })
    if (!order) throw new HttpError('Order not found', 404)

    // Auth: registered owner only; guest orders are payable with the order id.
    if (order.userId && (!user || user.id !== order.userId)) {
      throw new HttpError('You are not authorized to pay for this order', 403)
    }
    if (order.paymentMethod === 'COD') {
      throw new HttpError('This is a Cash on Delivery order. No online payment is required.', 400)
    }
    if (order.status === 'CANCELLED') {
      throw new HttpError('This order has been cancelled', 409)
    }

    // Idempotency — already paid
    const existingSuccess = order.payments.find((p) => p.status === 'SUCCESS')
    if (existingSuccess || order.paymentStatus === 'PAID') {
      return ok({ status: 'SUCCESS', orderId: order.id, orderNumber: order.orderNumber })
    }

    const success = Math.random() < 0.9

    if (success) {
      const result = await markOrderPaid(order.id, {
        gatewayRef: 'pay_' + randomBytes(12).toString('hex'),
        method: order.paymentMethod ?? 'UPI',
        feePercent: 0.02,
      })
      return ok(result)
    }

    // FAILED — keep the order PENDING_PAYMENT so the customer can retry
    await markLatestPaymentFailed(order.id, order.paymentMethod ?? 'UPI')

    return ok({ status: 'FAILED', orderId: order.id, orderNumber: order.orderNumber })
  } catch (err) {
    return handleError(err)
  }
}
