import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, requireAdmin, parsePage } from '@/lib/api'

// ---------------- GET: paginated platform orders ----------------
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const sp = req.nextUrl.searchParams
    const { page, limit, skip } = parsePage(sp)

    const where: Prisma.OrderWhereInput = {}

    const status = sp.get('status')
    if (status) where.status = status

    const search = sp.get('search')
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { user: { name: { contains: search } } },
        { guestName: { contains: search } },
      ]
    }

    const createdAt: Record<string, Date> = {}
    const from = sp.get('from')
    if (from) {
      const d = new Date(from)
      if (!Number.isNaN(d.getTime())) createdAt.gte = d
    }
    const to = sp.get('to')
    if (to) {
      const d = new Date(to)
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999)
        createdAt.lte = d
      }
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt

    const vendor = sp.get('vendor')
    if (vendor) where.subOrders = { some: { vendorId: vendor } }

    const [rows, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { name: true } },
          subOrders: { include: { vendor: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
        },
      }),
      db.order.count({ where }),
    ])

    const items = rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customer: o.user?.name ?? o.guestName ?? 'Guest',
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      grandTotal: o.grandTotal,
      createdAt: o.createdAt,
      subOrders: o.subOrders.map((so) => ({
        id: so.id,
        vendorName: so.vendor?.name ?? null,
        status: so.status,
        itemsTotal: so.itemsTotal,
      })),
    }))

    return ok({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (err) {
    return handleError(err)
  }
}
