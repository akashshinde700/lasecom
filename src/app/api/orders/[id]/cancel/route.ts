import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireUser, round2 } from '@/lib/api'
import { notify } from '@/lib/api'

/**
 * POST /api/orders/:id/cancel — customer cancels their own order.
 * Allowed while the order is CONFIRMED / PENDING_PAYMENT and no suborder is
 * SHIPPED or beyond. Transaction: restock (+StockMovement CANCEL_RESTOCK),
 * suborders CANCELLED, order CANCELLED; if PAID -> Refund row + paymentStatus
 * REFUNDED + VendorLedger REFUND_DEBIT per vendor suborder.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requireUser()

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
    if (order.userId !== user.id) {
      throw new HttpError('You are not authorized to cancel this order', 403)
    }
    if (!['CONFIRMED', 'PENDING_PAYMENT'].includes(order.status)) {
      throw new HttpError('This order can no longer be cancelled', 409)
    }
    const blockedStatuses = ['SHIPPED', 'DELIVERED']
    if (order.subOrders.some((s) => blockedStatuses.includes(s.status))) {
      throw new HttpError('This order contains shipped items and cannot be cancelled', 409)
    }

    let refunded = false
    await db.$transaction(async (tx) => {
      // Restock + movements + suborder/item cancellation
      for (const sub of order.subOrders) {
        for (const item of sub.items) {
          if (item.status === 'CANCELLED') continue
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.qty } },
          })
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
      }

      // Refund if the order was paid
      if (order.paymentStatus === 'PAID') {
        const successPayment = order.payments.find((p) => p.status === 'SUCCESS')
        if (successPayment) {
          await tx.refund.create({
            data: {
              paymentId: successPayment.id,
              amount: round2(order.grandTotal),
              reason: 'Order cancelled by customer',
              status: 'SUCCESS',
            },
          })
          refunded = true
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED', paymentStatus: refunded ? 'REFUNDED' : order.paymentStatus },
      })

      // Vendor ledger REFUND_DEBIT per vendor suborder — only for PAID orders
      // (SALE_CREDIT is only written on payment; debiting an unpaid order
      // would push vendor balances negative).
      if (order.paymentStatus === 'PAID') {
        for (const sub of order.subOrders) {
          if (sub.vendorId) {
            await tx.vendorLedger.create({
              data: {
                vendorId: sub.vendorId,
                subOrderId: sub.id,
                type: 'REFUND_DEBIT',
                direction: 'DEBIT',
                amount: round2(sub.vendorEarning),
                notes: `Refund for cancelled order ${order.orderNumber}`,
              },
            })
          }
        }
      }
    })

    // Notifications (after the transaction commits)
    await notify(
      user.id,
      'Order cancelled',
      `Your order ${order.orderNumber} has been cancelled.${
        refunded ? ` A refund of ₹${order.grandTotal} has been initiated to your original payment method.` : ''
      }`,
      'ORDER'
    )
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

    return ok({ cancelled: true, refunded, orderId: order.id, orderNumber: order.orderNumber })
  } catch (err) {
    return handleError(err)
  }
}
