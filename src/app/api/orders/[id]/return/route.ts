import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireUser, notify } from '@/lib/api'

type ReturnBody = { orderItemId?: string; reason?: string; comment?: string }

/**
 * POST /api/orders/:id/return — body { orderItemId, reason, comment? }
 * Only DELIVERED items, within `returns.windowDays` (default 7) days of the
 * DELIVERED ShipmentEvent. Creates ReturnRequest (PENDING) and marks the item RETURN_REQUESTED.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requireUser()
    const body = (await req.json()) as ReturnBody

    const orderItemId = body.orderItemId ?? ''
    const reason = (body.reason ?? '').trim()
    if (!orderItemId) throw new HttpError('orderItemId is required')
    if (!reason) throw new HttpError('Return reason is required')

    const order = await db.order.findUnique({
      where: { id },
      include: {
        subOrders: {
          include: {
            items: true,
            vendor: { select: { id: true, ownerId: true } },
          },
        },
      },
    })
    if (!order) throw new HttpError('Order not found', 404)
    if (order.userId !== user.id) {
      throw new HttpError('You are not authorized to return items from this order', 403)
    }

    const sub = order.subOrders.find((s) => s.items.some((i) => i.id === orderItemId))
    if (!sub) throw new HttpError('Order item not found in this order', 404)
    const item = sub.items.find((i) => i.id === orderItemId)
    if (!item) throw new HttpError('Order item not found', 404)

    if (sub.status !== 'DELIVERED') {
      throw new HttpError('Only items from a delivered order can be returned', 409)
    }
    if (item.status !== 'ACTIVE') {
      throw new HttpError('This item can no longer be returned', 409)
    }

    const windowSetting = await db.setting.findUnique({ where: { key: 'returns.windowDays' } })
    const parsedWindow = parseInt(windowSetting?.value ?? '7', 10)
    const windowDays = Number.isFinite(parsedWindow) && parsedWindow > 0 ? parsedWindow : 7

    const deliveredEvent = await db.shipmentEvent.findFirst({
      where: { subOrderId: sub.id, status: 'DELIVERED' },
      orderBy: { createdAt: 'desc' },
    })
    if (!deliveredEvent) throw new HttpError('Delivery record not found for this item', 409)
    const daysSinceDelivery = (Date.now() - deliveredEvent.createdAt.getTime()) / 86400000
    if (daysSinceDelivery > windowDays) {
      throw new HttpError(`The ${windowDays}-day return window for this item has expired`, 409)
    }

    const existingRequest = await db.returnRequest.findUnique({ where: { orderItemId } })
    if (existingRequest) throw new HttpError('A return request already exists for this item', 409)

    const returnRequest = await db.$transaction(async (tx) => {
      const rr = await tx.returnRequest.create({
        data: {
          orderItemId,
          userId: user.id,
          reason,
          comment: body.comment?.trim() || null,
          status: 'PENDING',
        },
      })
      await tx.orderItem.update({ where: { id: orderItemId }, data: { status: 'RETURN_REQUESTED' } })
      return rr
    })

    if (sub.vendorId && sub.vendor) {
      await notify(
        sub.vendor.ownerId,
        'New return request',
        `A customer requested a return for "${item.titleSnapshot}" (order ${order.orderNumber}). Reason: ${reason}`,
        'ORDER'
      )
    }

    return ok({ returnRequest })
  } catch (err) {
    return handleError(err)
  }
}
