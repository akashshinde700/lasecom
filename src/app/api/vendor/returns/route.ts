import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, requireVendor } from '@/lib/api'

// ---------------- GET: vendor return requests ----------------
export async function GET(req: NextRequest) {
  try {
    const { vendor } = await requireVendor()
    const sp = req.nextUrl.searchParams

    const where: Prisma.ReturnRequestWhereInput = { orderItem: { subOrder: { vendorId: vendor.id } } }
    const status = sp.get('status')
    if (status) where.status = status

    const rows = await db.returnRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        orderItem: {
          select: {
            id: true,
            titleSnapshot: true,
            imageSnapshot: true,
            qty: true,
            effectiveTotal: true,
            status: true,
            subOrder: {
              select: {
                id: true,
                order: {
                  select: {
                    orderNumber: true,
                    userId: true,
                    guestName: true,
                    user: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    const items = rows.map((rr) => ({
      id: rr.id,
      status: rr.status,
      reason: rr.reason,
      comment: rr.comment,
      refundAmount: rr.refundAmount,
      createdAt: rr.createdAt,
      orderItem: {
        id: rr.orderItem.id,
        titleSnapshot: rr.orderItem.titleSnapshot,
        imageSnapshot: rr.orderItem.imageSnapshot,
        qty: rr.orderItem.qty,
        effectiveTotal: rr.orderItem.effectiveTotal,
        itemStatus: rr.orderItem.status,
        orderNumber: rr.orderItem.subOrder.order.orderNumber,
        customer:
          rr.orderItem.subOrder.order.user?.name ?? rr.orderItem.subOrder.order.guestName ?? 'Guest',
      },
    }))

    return ok({ items, total: items.length })
  } catch (err) {
    return handleError(err)
  }
}
