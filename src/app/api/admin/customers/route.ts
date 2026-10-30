import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, requireAdmin, round2, parsePage } from '@/lib/api'

// ---------------- GET: customer list with aggregates ----------------
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const sp = req.nextUrl.searchParams
    const { page, limit, skip } = parsePage(sp)

    const where: Prisma.UserWhereInput = { role: 'CUSTOMER' }
    const search = sp.get('search')
    if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }]

    const [rows, total, orderGroups] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true },
      }),
      db.user.count({ where }),
      db.order.groupBy({
        by: ['userId'],
        where: { userId: { not: null }, status: { not: 'CANCELLED' } },
        _count: true,
        _sum: { grandTotal: true },
      }),
    ])

    const aggMap = new Map(orderGroups.map((g) => [g.userId, { count: g._count, spent: g._sum.grandTotal ?? 0 }]))

    const items = rows.map((u) => {
      const agg = aggMap.get(u.id)
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        createdAt: u.createdAt,
        orderCount: agg?.count ?? 0,
        totalSpent: round2(agg?.spent ?? 0),
        status: u.status,
      }
    })

    return ok({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (err) {
    return handleError(err)
  }
}
