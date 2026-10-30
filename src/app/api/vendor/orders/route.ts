import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, requireVendor, parsePage } from '@/lib/api'
import { parseJson } from '@/lib/format'

// ---------------- GET: paginated vendor sub-orders ----------------
export async function GET(req: NextRequest) {
  try {
    const { vendor } = await requireVendor()
    const sp = req.nextUrl.searchParams
    const { page, limit, skip } = parsePage(sp)

    const where: Prisma.SubOrderWhereInput = { vendorId: vendor.id }
    const status = sp.get('status')
    if (status) where.status = status

    const [rows, total] = await Promise.all([
      db.subOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              userId: true,
              guestName: true,
              shippingAddress: true,
              user: { select: { name: true } },
            },
          },
          items: true,
        },
      }),
      db.subOrder.count({ where }),
    ])

    const items = rows.map((so) => {
      const addr = parseJson<{ city?: string; state?: string; fullName?: string }>(so.order.shippingAddress, {})
      return {
        subOrderId: so.id,
        orderNumber: so.order.orderNumber,
        orderId: so.order.id,
        status: so.status,
        itemsTotal: so.itemsTotal,
        shippingFee: so.shippingFee,
        vendorEarning: so.vendorEarning,
        courierName: so.courierName,
        trackingNumber: so.trackingNumber,
        createdAt: so.createdAt,
        customer: {
          name: so.order.user?.name ?? so.order.guestName ?? addr.fullName ?? 'Guest',
          city: addr.city ?? '',
          state: addr.state ?? '',
        },
        items: so.items.map((i) => ({
          id: i.id,
          titleSnapshot: i.titleSnapshot,
          imageSnapshot: i.imageSnapshot,
          variantName: i.variantName,
          qty: i.qty,
          unitPrice: i.unitPrice,
          status: i.status,
        })),
      }
    })

    return ok({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (err) {
    return handleError(err)
  }
}
