// ============================================================
// Shared sub-order lifecycle logic (used by vendor + admin APIs)
// - updateSubOrderStatus: forward-only flow transitions, cancel w/ restock+refund,
//   auto tracking, shipment events, COD delivery settlement, parent order rollup
// - resolveReturnRequest: approve (restock + refund + ledger) / reject flows
// ============================================================
import { randomInt } from 'crypto'
import { db } from '@/lib/db'
import { HttpError, notify, logAudit, round2, reverseSubOrderLedgerTx } from '@/lib/api'
import type { SessionUser } from '@/lib/auth'

export const SUBORDER_FLOW = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']

const STATUS_NOTE: Record<string, string> = {
  CONFIRMED: 'Order confirmed and queued for processing',
  PROCESSING: 'Seller is preparing your items',
  PACKED: 'Package packed and ready for dispatch',
  SHIPPED: 'Package handed over to the courier',
  DELIVERED: 'Package delivered successfully',
  CANCELLED: 'Sub-order cancelled',
}

function randomDigits(n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) s += String(randomInt(0, 10))
  return s
}

export type SubOrderUpdateResult = {
  subOrderId: string
  status: string
  courierName: string | null
  trackingNumber: string | null
  orderStatus: string
  paymentStatus: string
  refundAmount: number
}

/**
 * Validate + apply a sub-order status change.
 * Pass opts.vendorId for vendor isolation (sub-order must belong to that vendor, else 404).
 */
export async function updateSubOrderStatus(
  subOrderId: string,
  input: { status: string; courierName?: string | null; trackingNumber?: string | null },
  opts: { vendorId?: string; actor: SessionUser | null }
): Promise<SubOrderUpdateResult> {
  const { status } = input
  if (!status || (!SUBORDER_FLOW.includes(status) && status !== 'CANCELLED')) {
    throw new HttpError('Invalid status', 400)
  }

  const subOrder = await db.subOrder.findUnique({
    where: { id: subOrderId },
    include: {
      vendor: { select: { id: true, name: true } },
      order: { include: { user: { select: { id: true, name: true } } } },
      items: true,
    },
  })
  if (!subOrder) throw new HttpError('Sub-order not found', 404)
  if (opts.vendorId && subOrder.vendorId !== opts.vendorId) throw new HttpError('Sub-order not found', 404)
  if (subOrder.status === 'CANCELLED') throw new HttpError('This sub-order has already been cancelled', 400)

  const isPendingPayment =
    subOrder.status === 'PENDING_PAYMENT' ||
    (subOrder.order.paymentMethod !== 'COD' && subOrder.order.paymentStatus === 'PENDING')

  if (isPendingPayment && status !== 'CANCELLED') {
    throw new HttpError('Cannot fulfil an order before payment is completed', 400)
  }

  const curIdx = SUBORDER_FLOW.indexOf(subOrder.status)
  if (!isPendingPayment && curIdx < 0) {
    throw new HttpError('Sub-order is in an invalid state', 400)
  }

  if (status === 'CANCELLED') {
    if (curIdx >= SUBORDER_FLOW.indexOf('SHIPPED')) {
      throw new HttpError('Shipment already dispatched — cancellation not allowed', 400)
    }
  } else {
    const newIdx = SUBORDER_FLOW.indexOf(status)
    if (newIdx === curIdx) throw new HttpError('Sub-order is already in this status', 400)
    if (newIdx < curIdx) throw new HttpError('Status cannot move backwards', 400)
  }

  const wasPaid =
    subOrder.order.paymentStatus === 'PAID' || subOrder.order.paymentStatus === 'PARTIALLY_REFUNDED'
  const isCOD = subOrder.order.paymentMethod === 'COD'
  let refundAmount = 0

  const updated = await db.$transaction(async (tx) => {
    if (status === 'CANCELLED') {
      // restock live items + mark them cancelled
      for (const item of subOrder.items) {
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
            refId: subOrder.id,
            actorName: opts.actor?.name ?? 'system',
          },
        })
        await tx.orderItem.update({ where: { id: item.id }, data: { status: 'CANCELLED' } })
      }

      // refund the customer's paid share of this sub-order (active items after coupon share + shipping),
      // capped by remaining unrefunded balance on the order.
      const subShare = round2(
        subOrder.items
          .filter((i) => i.status !== 'REFUNDED' && i.status !== 'CANCELLED')
          .reduce((s, i) => s + i.effectiveTotal, 0) + subOrder.shippingFee
      )
      if (wasPaid && subShare > 0) {
        const payments = await tx.payment.findMany({
          where: { orderId: subOrder.orderId, status: 'SUCCESS' },
          orderBy: { createdAt: 'desc' },
        })
        if (payments.length > 0) {
          const prevRefunds = await tx.refund.aggregate({
            where: { paymentId: { in: payments.map((p) => p.id) } },
            _sum: { amount: true },
          })
          const alreadyRefunded = prevRefunds._sum.amount ?? 0
          const remaining = round2(Math.max(0, subOrder.order.grandTotal - alreadyRefunded))
          refundAmount = Math.min(subShare, remaining)
          if (refundAmount > 0) {
            await tx.refund.create({
              data: {
                paymentId: payments[0].id,
                amount: refundAmount,
                reason: `Sub-order cancelled (${subOrder.order.orderNumber})`,
                status: 'SUCCESS',
              },
            })
          }
        }
      }

      // reverse exact net vendor ledger credit (items net of commission + shipping - any prior debits)
      if (subOrder.vendorId && wasPaid) {
        await reverseSubOrderLedgerTx(
          tx,
          subOrder.vendorId,
          subOrder.id,
          `Earning reversal — cancelled sub-order (${subOrder.order.orderNumber})`
        )
      }
    }

    const data: { status: string; courierName?: string; trackingNumber?: string } = { status }
    if (status === 'SHIPPED') {
      data.courierName = input.courierName?.trim() || 'Lastrivon Express'
      data.trackingNumber = input.trackingNumber?.trim() || 'SBX' + randomDigits(9)
    }
    const so = await tx.subOrder.update({ where: { id: subOrderId }, data })
    await tx.shipmentEvent.create({
      data: {
        subOrderId,
        status,
        note:
          status === 'SHIPPED'
            ? `Shipped via ${so.courierName} — Tracking: ${so.trackingNumber}`
            : STATUS_NOTE[status] ?? null,
      },
    })

    // ---- COD settlement on delivery ----
    if (status === 'DELIVERED' && isCOD) {
      const activeItems = subOrder.items.filter((i) => i.status !== 'CANCELLED' && i.status !== 'REFUNDED')
      for (const item of activeItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { soldCount: { increment: item.qty } },
        })
      }
      if (subOrder.vendorId) {
        const existingSale = await tx.vendorLedger.findFirst({
          where: { vendorId: subOrder.vendorId, subOrderId: subOrder.id, type: 'SALE_CREDIT' },
          select: { id: true },
        })
        if (!existingSale) {
          const effectiveItemsTotal = round2(
            activeItems.reduce((sum, item) => sum + item.effectiveTotal, 0)
          )
          if (effectiveItemsTotal > 0) {
            await tx.vendorLedger.create({
              data: {
                vendorId: subOrder.vendorId,
                subOrderId: subOrder.id,
                type: 'SALE_CREDIT',
                direction: 'CREDIT',
                amount: effectiveItemsTotal,
                notes: `COD sale credit for order ${subOrder.order.orderNumber}`,
              },
            })
          }
          if (subOrder.commissionTotal > 0) {
            await tx.vendorLedger.create({
              data: {
                vendorId: subOrder.vendorId,
                subOrderId: subOrder.id,
                type: 'COMMISSION_DEBIT',
                direction: 'DEBIT',
                amount: round2(subOrder.commissionTotal),
                notes: `Platform commission for COD order ${subOrder.order.orderNumber}`,
              },
            })
          }
          if (subOrder.shippingFee > 0) {
            await tx.vendorLedger.create({
              data: {
                vendorId: subOrder.vendorId,
                subOrderId: subOrder.id,
                type: 'SALE_CREDIT',
                direction: 'CREDIT',
                amount: round2(subOrder.shippingFee),
                notes: `Shipping fee collected for COD order ${subOrder.order.orderNumber}`,
              },
            })
          }
        }
      }
    }

    return so
  })

  // ---- rollup parent order status + payment status ----
  const allSubs = await db.subOrder.findMany({ where: { orderId: subOrder.orderId } })
  const active = allSubs.filter((s) => s.status !== 'CANCELLED')
  let orderStatus: string
  if (active.length === 0) orderStatus = 'CANCELLED'
  else if (active.every((s) => s.status === 'DELIVERED')) orderStatus = 'DELIVERED'
  else if (active.every((s) => s.status === 'SHIPPED' || s.status === 'DELIVERED')) orderStatus = 'SHIPPED'
  else if (active.some((s) => s.status === 'SHIPPED' || s.status === 'DELIVERED')) orderStatus = 'PARTIALLY_SHIPPED'
  else if (active.every((s) => s.status === 'PENDING_PAYMENT')) orderStatus = 'PENDING_PAYMENT'
  else orderStatus = 'CONFIRMED'

  // Release coupon usage slot if the entire order is now cancelled
  if (orderStatus === 'CANCELLED' && subOrder.order.couponCode) {
    const candidates = await db.coupon.findMany({
      where: { code: { contains: subOrder.order.couponCode } },
    })
    const matched = candidates.find(
      (c) => c.code.toUpperCase() === subOrder.order.couponCode!.toUpperCase()
    )
    if (matched) {
      await db.coupon.updateMany({
        where: { id: matched.id, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      })
    }
  }

  let paymentStatus = subOrder.order.paymentStatus
  if (isCOD && orderStatus === 'DELIVERED' && paymentStatus === 'COD_PENDING') {
    const codPayment = await db.payment.findFirst({
      where: { orderId: subOrder.orderId, status: 'COD_PENDING' },
      orderBy: { createdAt: 'desc' },
    })
    if (codPayment) {
      await db.payment.update({
        where: { id: codPayment.id },
        data: { status: 'SUCCESS', gatewayRef: `cod_${subOrder.order.orderNumber}` },
      })
    }
    paymentStatus = 'PAID'
  } else if (wasPaid && status === 'CANCELLED') {
    const pays = await db.payment.findMany({
      where: { orderId: subOrder.orderId, status: 'SUCCESS' },
      select: { id: true },
    })
    if (pays.length > 0) {
      const agg = await db.refund.aggregate({
        where: { paymentId: { in: pays.map((p) => p.id) } },
        _sum: { amount: true },
      })
      const refunded = agg._sum.amount ?? 0
      if (orderStatus === 'CANCELLED' || refunded >= subOrder.order.grandTotal - 0.01) {
        paymentStatus = 'REFUNDED'
      } else if (refunded > 0) {
        paymentStatus = 'PARTIALLY_REFUNDED'
      }
    }
  }

  await db.order.update({
    where: { id: subOrder.orderId },
    data: { status: orderStatus, paymentStatus },
  })

  // ---- notify customer ----
  if (subOrder.order.userId) {
    const vendorLabel = subOrder.vendor?.name ?? 'Lastrivon Kart'
    if (status === 'CANCELLED') {
      await notify(
        subOrder.order.userId,
        `Order ${subOrder.order.orderNumber} — item cancelled`,
        `${vendorLabel} cancelled part of your order${refundAmount > 0 ? `. A refund of ₹${refundAmount.toFixed(2)} has been initiated.` : '.'}`,
        'ORDER'
      )
    } else if (status === 'SHIPPED') {
      await notify(
        subOrder.order.userId,
        `Order ${subOrder.order.orderNumber} shipped`,
        `Your package from ${vendorLabel} has shipped via ${updated.courierName}. Tracking: ${updated.trackingNumber}`,
        'ORDER'
      )
    } else if (status === 'DELIVERED') {
      await notify(
        subOrder.order.userId,
        `Order ${subOrder.order.orderNumber} delivered`,
        `Your package from ${vendorLabel} has been delivered. We hope you love it!`,
        'ORDER'
      )
    } else {
      await notify(
        subOrder.order.userId,
        `Order ${subOrder.order.orderNumber} update`,
        STATUS_NOTE[status] ?? `Status updated to ${status}`,
        'ORDER'
      )
    }
  }

  await logAudit(
    opts.actor,
    'suborder.status',
    'SubOrder',
    subOrderId,
    `${subOrder.status} → ${status} (order ${subOrder.order.orderNumber})`
  )

  return {
    subOrderId: updated.id,
    status: updated.status,
    courierName: updated.courierName,
    trackingNumber: updated.trackingNumber,
    orderStatus,
    paymentStatus,
    refundAmount,
  }
}

export type ReturnResolveResult = {
  id: string
  status: 'REFUNDED' | 'REJECTED'
  refundAmount?: number
}

/**
 * Resolve a return request. Pass opts.vendorId for vendor isolation.
 * APPROVED → REFUNDED: restocks inventory (+StockMovement RETURN_RESTOCK),
 * creates refund row on SUCCESS/COD payment, marks item REFUNDED, updates order
 * paymentStatus, writes vendor ledger REFUND_DEBIT (vendorEarning), increments
 * subOrder.refundTotal, and records shipment note.
 * REJECTED → marks item RETURN_REJECTED.
 */
export async function resolveReturnRequest(
  returnRequestId: string,
  action: 'APPROVED' | 'REJECTED',
  opts: { vendorId?: string; actor: SessionUser | null }
): Promise<ReturnResolveResult> {
  const rr = await db.returnRequest.findUnique({
    where: { id: returnRequestId },
    include: {
      orderItem: {
        include: {
          subOrder: {
            include: { order: { include: { user: { select: { id: true, name: true } } } } },
          },
        },
      },
    },
  })
  if (!rr) throw new HttpError('Return request not found', 404)
  const item = rr.orderItem
  if (opts.vendorId && item.subOrder.vendorId !== opts.vendorId) throw new HttpError('Return request not found', 404)
  if (rr.status !== 'PENDING') throw new HttpError('This return request has already been resolved', 400)

  const order = item.subOrder.order

  if (action === 'REJECTED') {
    await db.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: rr.id },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      })
      await tx.orderItem.update({ where: { id: item.id }, data: { status: 'RETURN_REJECTED' } })
    })
    if (order.userId) {
      await notify(
        order.userId,
        'Return request rejected',
        `Your return for "${item.titleSnapshot}" on order ${order.orderNumber} was rejected. The item remains delivered.`,
        'ORDER'
      )
    }
    await logAudit(opts.actor, 'return.reject', 'ReturnRequest', rr.id, `Order ${order.orderNumber}`)
    return { id: rr.id, status: 'REJECTED' }
  }

  // ---- APPROVED → restock + refund flow ----
  const refundAmt = round2(item.effectiveTotal)
  await db.$transaction(async (tx) => {
    await tx.returnRequest.update({
      where: { id: rr.id },
      data: { status: 'REFUNDED', refundAmount: refundAmt, resolvedAt: new Date() },
    })
    await tx.orderItem.update({ where: { id: item.id }, data: { status: 'REFUNDED' } })

    // Restock returned item inventory & decrement soldCount
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.qty } },
    })
    await tx.product.updateMany({
      where: { id: item.productId, soldCount: { gte: item.qty } },
      data: { soldCount: { decrement: item.qty } },
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
        reason: 'RETURN_RESTOCK',
        refId: order.orderNumber,
        actorName: opts.actor?.name ?? 'system',
      },
    })

    const payment = await tx.payment.findFirst({
      where: { orderId: order.id, status: { in: ['SUCCESS', 'COD_PENDING'] } },
      orderBy: { createdAt: 'desc' },
    })
    if (payment) {
      await tx.refund.create({
        data: {
          paymentId: payment.id,
          amount: refundAmt,
          reason: `Return approved: ${rr.reason}`,
          status: 'SUCCESS',
          returnRequestId: rr.id,
        },
      })
    }

    // order paymentStatus: REFUNDED only if every item on the order is refunded/cancelled
    const orderItems = await tx.orderItem.findMany({
      where: { subOrder: { orderId: order.id } },
      select: { status: true },
    })
    const allResolved =
      orderItems.length > 0 && orderItems.every((i) => i.status === 'REFUNDED' || i.status === 'CANCELLED')
    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: allResolved ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
    })

    if (item.subOrder.vendorId && item.vendorEarning > 0) {
      const hasSaleCredit = await tx.vendorLedger.findFirst({
        where: {
          vendorId: item.subOrder.vendorId,
          subOrderId: item.subOrder.id,
          type: 'SALE_CREDIT',
        },
        select: { id: true },
      })
      if (hasSaleCredit) {
        await tx.vendorLedger.create({
          data: {
            vendorId: item.subOrder.vendorId,
            subOrderId: item.subOrder.id,
            type: 'REFUND_DEBIT',
            direction: 'DEBIT',
            amount: round2(item.vendorEarning),
            notes: `Refund for return — ${order.orderNumber} (${item.titleSnapshot})`,
          },
        })
      }
    }

    await tx.subOrder.update({
      where: { id: item.subOrder.id },
      data: { refundTotal: { increment: refundAmt } },
    })

    await tx.shipmentEvent.create({
      data: {
        subOrderId: item.subOrder.id,
        status: 'REFUNDED',
        note: `Return approved — refund of ₹${refundAmt.toFixed(2)} for "${item.titleSnapshot}"`,
      },
    })
  })

  if (order.userId) {
    await notify(
      order.userId,
      'Return approved — refund initiated',
      `Your return for "${item.titleSnapshot}" on order ${order.orderNumber} was approved. A refund of ₹${refundAmt.toFixed(2)} has been processed.`,
      'ORDER'
    )
  }
  await logAudit(opts.actor, 'return.approve', 'ReturnRequest', rr.id, `Refund ₹${refundAmt} — order ${order.orderNumber}`)

  return { id: rr.id, status: 'REFUNDED', refundAmount: refundAmt }
}
