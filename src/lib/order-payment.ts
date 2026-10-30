import { db } from '@/lib/db'
import { round2, notify } from '@/lib/api'

/**
 * Shared "payment success" state machine — used by BOTH the legacy mock
 * gateway (/api/payments/:orderId/pay) and the Razorpay verify route.
 *
 * Runs inside a transaction:
 *  - marks the latest PENDING payment row SUCCESS (or creates one) with the
 *    gateway reference + fee
 *  - order -> CONFIRMED + PAID
 *  - every SubOrder -> CONFIRMED + CONFIRMED ShipmentEvent
 *  - VendorLedger entries (SALE_CREDIT items, COMMISSION_DEBIT, SALE_CREDIT
 *    shipping) for VENDOR suborders only (platform 1P excluded)
 *
 * Notifications to the customer + vendor owners are sent after commit.
 * Idempotent: if a SUCCESS payment already exists, returns early.
 */
export async function markOrderPaid(
  orderId: string,
  opts: { gatewayRef: string; method?: string; feePercent?: number }
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      subOrders: { include: { vendor: { select: { id: true, ownerId: true } } } },
      payments: { select: { id: true, status: true } },
    },
  })
  if (!order) throw new Error('Order not found')

  // Idempotency — already paid
  if (order.payments.some((p) => p.status === 'SUCCESS') || order.paymentStatus === 'PAID') {
    return { status: 'SUCCESS' as const, orderId: order.id, orderNumber: order.orderNumber }
  }

  const result = await db.$transaction(async (tx) => {
    const alreadyPaid = await tx.payment.findFirst({
      where: { orderId: order.id, status: 'SUCCESS' },
    })
    if (alreadyPaid) {
      return { status: 'SUCCESS' as const, orderId: order.id, orderNumber: order.orderNumber }
    }

    const feeAmount = round2(order.grandTotal * (opts.feePercent ?? 0.02))

    const pendingPayment = await tx.payment.findFirst({
      where: { orderId: order.id, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    })
    if (pendingPayment) {
      await tx.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: 'SUCCESS',
          gatewayRef: opts.gatewayRef,
          feeAmount,
          ...(opts.method ? { method: opts.method } : {}),
        },
      })
    } else {
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: opts.method ?? order.paymentMethod ?? 'UPI',
          amount: order.grandTotal,
          status: 'SUCCESS',
          gatewayRef: opts.gatewayRef,
          feeAmount,
        },
      })
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
    })

    for (const sub of order.subOrders) {
      await tx.subOrder.update({ where: { id: sub.id }, data: { status: 'CONFIRMED' } })
      await tx.shipmentEvent.create({
        data: {
          subOrderId: sub.id,
          status: 'CONFIRMED',
          note: 'Payment received. Order confirmed for fulfillment.',
        },
      })
      // Ledger entries for VENDOR suborders only (platform 1P excluded)
      if (sub.vendorId) {
        await tx.vendorLedger.create({
          data: {
            vendorId: sub.vendorId,
            subOrderId: sub.id,
            type: 'SALE_CREDIT',
            direction: 'CREDIT',
            amount: round2(sub.itemsTotal),
            notes: `Sale credit for order ${order.orderNumber}`,
          },
        })
        if (sub.commissionTotal > 0) {
          await tx.vendorLedger.create({
            data: {
              vendorId: sub.vendorId,
              subOrderId: sub.id,
              type: 'COMMISSION_DEBIT',
              direction: 'DEBIT',
              amount: round2(sub.commissionTotal),
              notes: `Platform commission for order ${order.orderNumber}`,
            },
          })
        }
        if (sub.shippingFee > 0) {
          await tx.vendorLedger.create({
            data: {
              vendorId: sub.vendorId,
              subOrderId: sub.id,
              type: 'SALE_CREDIT',
              direction: 'CREDIT',
              amount: round2(sub.shippingFee),
              notes: `Shipping fee collected for order ${order.orderNumber}`,
            },
          })
        }
      }
    }

    return { status: 'SUCCESS' as const, orderId: order.id, orderNumber: order.orderNumber }
  })

  // Notifications after commit
  if (order.userId) {
    await notify(
      order.userId,
      'Payment successful',
      `Your payment for order ${order.orderNumber} was successful. The order is now confirmed.`,
      'PAYMENT'
    )
  }
  const notifiedOwners = new Set<string>()
  for (const sub of order.subOrders) {
    const ownerId = sub.vendor?.ownerId
    if (sub.vendorId && ownerId && !notifiedOwners.has(ownerId)) {
      notifiedOwners.add(ownerId)
      await notify(
        ownerId,
        'New order received',
        `You have a new confirmed order ${order.orderNumber}. Please start processing it.`,
        'ORDER'
      )
    }
  }

  return result
}

/** Marks the latest PENDING payment of an order as FAILED (no-op if none). */
export async function markLatestPaymentFailed(orderId: string, method?: string) {
  const pending = await db.payment.findFirst({
    where: { orderId, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  })
  if (pending) {
    await db.payment.update({ where: { id: pending.id }, data: { status: 'FAILED' } })
  } else {
    await db.payment.create({
      data: {
        orderId,
        method: method ?? 'UPI',
        amount: 0,
        status: 'FAILED',
      },
    })
  }
}
