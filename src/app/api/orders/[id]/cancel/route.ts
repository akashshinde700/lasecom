import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  ok,
  handleError,
  HttpError,
  round2,
  notify,
  canAccessOrder,
  reverseSubOrderLedgerTx,
} from '@/lib/api'
import { getSessionUser } from '@/lib/auth'

/**
 * POST /api/orders/:id/cancel — customer (or authorized guest) cancels their own order.
 * Allowed while the order is CONFIRMED / PENDING_PAYMENT and no suborder is
 * SHIPPED or beyond. Transaction: restock (+StockMovement CANCEL_RESTOCK),
 * active suborders CANCELLED, order CANCELLED; if PAID / PARTIALLY_REFUNDED ->
 * remaining Refund row + paymentStatus REFUNDED + exact VendorLedger reversal.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getSessionUser()

    const order = await db.order.findUnique({
      where: { id },
      include: {
        subOrders: {
          include: {
            items: true,
            vendor: { select: { id: true, ownerId: true, name: true } },
          },
        },
        payments: { select: { id: true, status: true } },
      },
    })
    if (!order) throw new HttpError('Order not found', 404)
    if (!(await canAccessOrder(order, user))) {
      throw new HttpError('You are not authorized to cancel this order', 403)
    }
    if (!['CONFIRMED', 'PENDING_PAYMENT'].includes(order.status)) {
      throw new HttpError('This order can no longer be cancelled', 409)
    }
    const blockedStatuses = ['SHIPPED', 'DELIVERED']
    if (order.subOrders.some((s) => blockedStatuses.includes(s.status))) {
      throw new HttpError('This order contains shipped items and cannot be cancelled', 409)
    }

    const wasPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'PARTIALLY_REFUNDED'
    let refundedAmount = 0

    await db.$transaction(async (tx) => {
      // Restock + movements + suborder/item cancellation (skip already-cancelled suborders)
      for (const sub of order.subOrders) {
        if (sub.status === 'CANCELLED') continue
        for (const item of sub.items) {
          if (item.status === 'CANCELLED' || item.status === 'REFUNDED') continue
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.qty } },
          })
          if (wasPaid) {
            await tx.product.updateMany({
              where: { id: item.productId, soldCount: { gte: item.qty } },
              data: { soldCount: { decrement: item.qty } },
            })
          }
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.qty } },
            })
          }
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId,
              delta: item.qty,
              reason: 'CANCEL_RESTOCK',
              refId: order.orderNumber,
              actorName: user?.name ?? order.guestName ?? 'customer',
            },
          })
          await tx.orderItem.update({ where: { id: item.id }, data: { status: 'CANCELLED' } })
        }
        await tx.subOrder.update({ where: { id: sub.id }, data: { status: 'CANCELLED' } })
        await tx.shipmentEvent.create({
          data: {
            subOrderId: sub.id,
            status: 'CANCELLED',
            note: `Order ${order.orderNumber} cancelled by customer`,
          },
        })

        // Exact vendor ledger reversal (items net of commission + shipping - any prior debits)
        if (sub.vendorId && wasPaid) {
          await reverseSubOrderLedgerTx(
            tx,
            sub.vendorId,
            sub.id,
            `Refund for cancelled order ${order.orderNumber}`
          )
        }
      }

      // Refund remaining unrefunded balance if the order was paid
      if (wasPaid) {
        const successPayments = order.payments.filter((p) => p.status === 'SUCCESS')
        if (successPayments.length > 0) {
          const prev = await tx.refund.aggregate({
            where: { paymentId: { in: successPayments.map((p) => p.id) } },
            _sum: { amount: true },
          })
          const alreadyRefunded = prev._sum.amount ?? 0
          const remaining = round2(Math.max(0, order.grandTotal - alreadyRefunded))
          if (remaining > 0) {
            await tx.refund.create({
              data: {
                paymentId: successPayments[0].id,
                amount: remaining,
                reason: 'Order cancelled by customer',
                status: 'SUCCESS',
              },
            })
            refundedAmount = remaining
          }
        }
      }

      // Release coupon usage slot
      if (order.couponCode) {
        const candidates = await tx.coupon.findMany({
          where: { code: { contains: order.couponCode } },
        })
        const matched = candidates.find(
          (c) => c.code.toUpperCase() === order.couponCode!.toUpperCase()
        )
        if (matched) {
          await tx.coupon.updateMany({
            where: { id: matched.id, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          })
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: wasPaid ? 'REFUNDED' : order.paymentStatus,
        },
      })
    })

    // Notifications (after the transaction commits)
    if (order.userId) {
      await notify(
        order.userId,
        'Order cancelled',
        `Your order ${order.orderNumber} has been cancelled.${
          refundedAmount > 0
            ? ` A refund of ₹${refundedAmount.toFixed(2)} has been initiated to your original payment method.`
            : ''
        }`,
        'ORDER'
      )
    }
    const notifiedOwners = new Set<string>()
    for (const sub of order.subOrders) {
      const ownerId = sub.vendor?.ownerId
      if (sub.vendorId && ownerId && !notifiedOwners.has(ownerId)) {
        notifiedOwners.add(ownerId)
        await notify(
          ownerId,
          'Order cancelled',
          `Order ${order.orderNumber} containing your products was cancelled by the customer. Stock has been restored.`,
          'ORDER'
        )
      }
    }

    return ok({
      cancelled: true,
      refunded: refundedAmount > 0,
      refundAmount: refundedAmount,
      orderId: order.id,
      orderNumber: order.orderNumber,
    })
  } catch (err) {
    return handleError(err)
  }
}
