import { db } from '@/lib/db'
import { ok, handleError, requireVendor, round2 } from '@/lib/api'
import { format, subDays, startOfDay } from 'date-fns'

type ItemRow = { productId: string; titleSnapshot: string; qty: number; effectiveTotal: number }

function buildSalesByDay(rows: { itemsTotal: number; createdAt: Date }[]): { date: string; sales: number }[] {
  const buckets = new Map<string, number>()
  const days: { date: string; sales: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = subDays(new Date(), i)
    buckets.set(format(d, 'yyyy-MM-dd'), 0)
    days.push({ date: format(d, 'dd MMM'), sales: 0 })
  }
  for (const r of rows) {
    const key = format(r.createdAt, 'yyyy-MM-dd')
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + r.itemsTotal)
  }
  let idx = 0
  for (let i = 13; i >= 0; i--) {
    days[idx].sales = round2(buckets.get(format(subDays(new Date(), i), 'yyyy-MM-dd')) ?? 0)
    idx++
  }
  return days
}

function buildTopProducts(rows: ItemRow[]): { title: string; soldCount: number; revenue: number }[] {
  const map = new Map<string, { title: string; soldCount: number; revenue: number }>()
  for (const r of rows) {
    const cur = map.get(r.productId) ?? { title: r.titleSnapshot, soldCount: 0, revenue: 0 }
    cur.soldCount += r.qty
    cur.revenue = round2(cur.revenue + r.effectiveTotal)
    map.set(r.productId, cur)
  }
  return [...map.values()].sort((a, b) => b.soldCount - a.soldCount).slice(0, 5)
}

export async function GET() {
  try {
    const { vendor } = await requireVendor()
    const vendorId = vendor.id
    const dayStart = startOfDay(subDays(new Date(), 13))

    const [plan, subAgg, statusGroups, ledgerUnsettled, productCount, activeProducts, recentSubs, itemRows] =
      await Promise.all([
        db.subscriptionPlan.findUnique({ where: { id: vendor.planId ?? '' } }),
        db.subOrder.aggregate({
          where: { vendorId, status: { not: 'CANCELLED' } },
          _sum: { itemsTotal: true, vendorEarning: true, commissionTotal: true },
        }),
        db.subOrder.groupBy({ by: ['status'], where: { vendorId }, _count: true }),
        db.vendorLedger.groupBy({ by: ['direction'], where: { vendorId, settled: false }, _sum: { amount: true } }),
        db.product.count({ where: { vendorId, status: { not: 'ARCHIVED' } } }),
        db.product.findMany({
          where: { vendorId, status: 'ACTIVE' },
          select: { id: true, title: true, stock: true, lowStockThreshold: true },
        }),
        db.subOrder.findMany({
          where: { vendorId, status: { not: 'CANCELLED' }, createdAt: { gte: dayStart } },
          select: { itemsTotal: true, createdAt: true },
        }),
        db.orderItem.findMany({
          where: { subOrder: { vendorId, status: { not: 'CANCELLED' } } },
          select: { productId: true, titleSnapshot: true, qty: true, effectiveTotal: true },
        }),
      ])

    const statusMap: Record<string, number> = {}
    for (const g of statusGroups) statusMap[g.status] = g._count
    const totalOrders = Object.values(statusMap).reduce((s, n) => s + n, 0)

    let credit = 0
    let debit = 0
    for (const g of ledgerUnsettled) {
      if (g.direction === 'CREDIT') credit = g._sum.amount ?? 0
      if (g.direction === 'DEBIT') debit = g._sum.amount ?? 0
    }
    const pendingSettlement = round2(credit - debit)

    const lowStock = activeProducts
      .filter((p) => p.stock <= p.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 5)
      .map((p) => ({ id: p.id, title: p.title, stock: p.stock }))

    return ok({
      vendor: {
        name: vendor.name,
        status: vendor.status,
        slug: vendor.slug,
        rating: vendor.rating,
        plan: plan
          ? { id: plan.id, name: plan.name, priceMonthly: plan.priceMonthly, listingLimit: plan.listingLimit }
          : null,
      },
      stats: {
        totalSales: round2(subAgg._sum.itemsTotal ?? 0),
        totalOrders,
        pendingOrders: statusMap['CONFIRMED'] ?? 0,
        processingOrders: (statusMap['PROCESSING'] ?? 0) + (statusMap['PACKED'] ?? 0),
        shippedOrders: statusMap['SHIPPED'] ?? 0,
        deliveredOrders: statusMap['DELIVERED'] ?? 0,
        cancelledOrders: statusMap['CANCELLED'] ?? 0,
        netEarnings: round2(subAgg._sum.vendorEarning ?? 0),
        commissionPaid: round2(subAgg._sum.commissionTotal ?? 0),
        pendingSettlement,
        totalProducts: productCount,
        lowStock,
        rating: vendor.rating,
      },
      salesByDay: buildSalesByDay(recentSubs),
      topProducts: buildTopProducts(itemRows),
    })
  } catch (err) {
    return handleError(err)
  }
}
