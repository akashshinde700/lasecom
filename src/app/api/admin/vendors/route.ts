import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, requireAdmin, round2 } from '@/lib/api'

// ---------------- GET: vendor list with aggregates ----------------
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const sp = req.nextUrl.searchParams

    const where: Prisma.VendorWhereInput = {}
    const status = sp.get('status')
    if (status) where.status = status
    const search = sp.get('search')
    if (search) {
      where.OR = [{ name: { contains: search } }, { email: { contains: search } }, { slug: { contains: search } }]
    }

    const [rows, salesGroups] = await Promise.all([
      db.vendor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: { select: { name: true, priceMonthly: true } },
          owner: { select: { name: true, email: true } },
          _count: {
            select: {
              products: true,
              subOrders: { where: { status: { not: 'CANCELLED' } } },
            },
          },
        },
      }),
      db.subOrder.groupBy({
        by: ['vendorId'],
        where: { vendorId: { not: null }, status: { not: 'CANCELLED' } },
        _sum: { itemsTotal: true },
      }),
    ])
    const salesMap = new Map(salesGroups.map((g) => [g.vendorId, g._sum.itemsTotal ?? 0]))

    const items = rows.map((v) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      email: v.email,
      status: v.status,
      commissionPercent: v.commissionPercent,
      city: v.city,
      state: v.state,
      gstin: v.gstin,
      rating: v.rating,
      plan: v.plan ? { name: v.plan.name, priceMonthly: v.plan.priceMonthly } : null,
      productCount: v._count.products,
      orderCount: v._count.subOrders,
      totalSales: round2(salesMap.get(v.id) ?? 0),
      createdAt: v.createdAt,
      owner: { name: v.owner.name, email: v.owner.email },
    }))

    return ok({ items, total: items.length })
  } catch (err) {
    return handleError(err)
  }
}
