import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  ok,
  handleError,
  HttpError,
  requireAdmin,
  round2,
  logAudit,
  notify,
  reverseSubOrderLedgerTx,
} from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// ---------------- POST: admin force cancel ----------------
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin()
    const { id } = await params

    const order = await db.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
        subOrders: { include: { items: true, vendor: { select: { id: true, name: true, ownerId: true } } } },
        payments: true,
      },
    })
    if (!order) throw new HttpError('Order not found', 404)
    if (order.status === 'CANCELLED') throw new HttpError('Order is already cancelled', 400)
    if (order.status !== 'CONFIRMED' && order.status !== 'PENDING_PAYMENT') {
      throw new HttpError('Only confirmed or pending-payment orders can be cancelled', 400)
    }
    const shipped = order.subOrders.some((so) => so.status === 'SHIPPED' || so.status === 'DELIVERED')
    if (shipped) throw new HttpError('Cannot cancel — one or more items have already shipped', 400)

    const wasPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'PARTIALLY_REFUNDED'
    let refundedAmount = 0

    await db.$transaction(async (tx) => {
      // restock + cancel sub-orders and their items
      for (const so of order.subOrders) {
        if (so.status === 'CANCELLED') continue
        for (const item of so.items) {
          if (item.status === 'REFUNDED' || item.status === 'CANCELLED') continue
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
              refId: order.id,
              actorName: user.name,
            },
          })
          await tx.orderItem.update({ where: { id: item.id }, data: { status: 'CANCELLED' } })
        }
        await tx.subOrder.update({ where: { id: so.id }, data: { status: 'CANCELLED' } })
        await tx.shipmentEvent.create({
          data: { subOrderId: so.id, status: 'CANCELLED', note: 'Order cancelled by platform admin' },
        })
        if (so.vendorId && wasPaid) {
          await reverseSubOrderLedgerTx(
            tx,
            so.vendorId,
            so.id,
            `Earning reversal — order ${order.orderNumber} cancelled by admin`
          )
        }
      }

      // refund remaining balance if paid
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
                reason: `Order ${order.orderNumber} cancelled by admin`,
                status: 'SUCCESS',
              },
            })
            refundedAmount = remaining
          }
        }
      }

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

    // notifications
    if (order.userId) {
      await notify(
        order.userId,
        `Order ${order.orderNumber} cancelled`,
        `Your order has been cancelled by the platform.${
          refundedAmount > 0 ? ` A refund of ₹${refundedAmount.toFixed(2)} has been initiated.` : ''
        }`,
        'ORDER'
      )
    }
    const notifiedOwners = new Set<string>()
    for (const so of order.subOrders) {
      if (so.vendor?.ownerId && !notifiedOwners.has(so.vendor.ownerId)) {
        notifiedOwners.add(so.vendor.ownerId)
        await notify(
          so.vendor.ownerId,
          `Order ${order.orderNumber} cancelled`,
          `Platform admin cancelled the sub-order for "${so.vendor.name}".`,
          'ORDER'
        )
      }
    }

    await logAudit(user, 'order.cancel', 'Order', order.id, `Force cancelled order ${order.orderNumber}`)
    return ok({ cancelled: true, orderId: order.id, refundAmount: refundedAmount })
  } catch (err) {
    return handleError(err)
  }
}
