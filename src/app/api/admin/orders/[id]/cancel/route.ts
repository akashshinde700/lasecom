import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, round2, logAudit, notify } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// ---------------- POST: admin force cancel (customer-cancel logic, no vendor isolation) ----------------
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

    const wasPaid = order.paymentStatus === 'PAID'

    await db.$transaction(async (tx) => {
      // restock + cancel sub-orders and their items
      for (const so of order.subOrders) {
        if (so.status === 'CANCELLED') continue
        for (const item of so.items) {
          if (item.status === 'REFUNDED' || item.status === 'CANCELLED') continue
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.qty } } })
          if (item.variantId) {
            await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.qty } } })
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
        // reverse vendor earning for paid orders
        if (so.vendorId && wasPaid && so.vendorEarning > 0) {
          await tx.vendorLedger.create({
            data: {
              vendorId: so.vendorId,
              subOrderId: so.id,
              type: 'REFUND_DEBIT',
              direction: 'DEBIT',
              amount: round2(so.vendorEarning),
              notes: `Earning reversal — order ${order.orderNumber} cancelled by admin`,
            },
          })
        }
      }

      await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })

      // refund if paid
      if (wasPaid) {
        const payment = order.payments.find((p) => p.status === 'SUCCESS')
        if (payment) {
          await tx.refund.create({
            data: {
              paymentId: payment.id,
              amount: round2(order.grandTotal),
              reason: `Order ${order.orderNumber} cancelled by admin`,
              status: 'SUCCESS',
            },
          })
          await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'REFUNDED' } })
        }
      }
    })

    // notifications
    if (order.userId) {
      await notify(
        order.userId,
        `Order ${order.orderNumber} cancelled`,
        `Your order has been cancelled by the platform.${wasPaid ? ' A full refund has been initiated.' : ''}`,
        'ORDER'
      )
    }
    for (const so of order.subOrders) {
      if (so.vendor?.ownerId) {
        await notify(
          so.vendor.ownerId,
          `Order ${order.orderNumber} cancelled`,
          `Platform admin cancelled the sub-order for "${so.vendor.name}".`,
          'ORDER'
        )
      }
    }

    await logAudit(user, 'order.cancel', 'Order', order.id, `Force cancelled order ${order.orderNumber}`)
    return ok({ cancelled: true, orderId: order.id })
  } catch (err) {
    return handleError(err)
  }
}
