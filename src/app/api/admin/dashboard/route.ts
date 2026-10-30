import { db } from '@/lib/db'
import { ok, handleError, requireAdmin, round2 } from '@/lib/api'
import { format, subDays, startOfDay } from 'date-fns'

// ---------------- GET: platform dashboard ----------------
export async function GET() {
  try {
    await requireAdmin()
    const now = new Date()
    const dayStart = startOfDay(subDays(now, 13))
    const notCancelledSub = { status: { not: 'CANCELLED' } } as const

    const [
      orderAgg,
      orderGroups,
      platformSalesAgg,
      vendorSalesAgg,
      commissionAgg,
      onePItems,
      refundsAgg,
      feesAgg,
      ledgerUnsettled,
      customerCount,
      newCustomers,
      vendorTotal,
      vendorActive,
      vendorPending,
      activeProducts,
      topProductGroups,
      orderItemGroups,
      topVendorGroups,
      recentOrderRows,
      recentOrdersAll,
      activeVendors,
    ] = await Promise.all([
      db.order.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { grandTotal: true }, _count: true }),
      db.order.groupBy({ by: ['status'], _count: true }),
      db.orderItem.aggregate({ where: { isPlatformOwned: true, subOrder: notCancelledSub }, _sum: { effectiveTotal: true } }),
      db.orderItem.aggregate({ where: { isPlatformOwned: false, subOrder: notCancelledSub }, _sum: { effectiveTotal: true } }),
      db.orderItem.aggregate({ where: { subOrder: notCancelledSub }, _sum: { commissionAmount: true } }),
      db.orderItem.findMany({
        where: { isPlatformOwned: true, subOrder: notCancelledSub, costSnapshot: { not: null } },
        select: { effectiveTotal: true, costSnapshot: true },
      }),
      db.refund.aggregate({ _sum: { amount: true } }),
      db.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { feeAmount: true } }),
      db.vendorLedger.groupBy({ by: ['direction'], where: { settled: false }, _sum: { amount: true } }),
      db.user.count({ where: { role: 'CUSTOMER' } }),
      db.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: subDays(now, 7) } } }),
      db.vendor.count(),
      db.vendor.count({ where: { status: 'ACTIVE' } }),
      db.vendor.count({ where: { status: 'PENDING' } }),
      db.product.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, title: true, stock: true, lowStockThreshold: true, vendor: { select: { name: true } } },
      }),
      db.orderItem.groupBy({
        by: ['productId'],
        where: { subOrder: notCancelledSub },
        _sum: { qty: true, effectiveTotal: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: 5,
      }),
      db.orderItem.groupBy({
        by: ['productId'],
        where: { subOrder: notCancelledSub },
        _sum: { effectiveTotal: true },
      }),
      db.subOrder.groupBy({
        by: ['vendorId'],
        where: { vendorId: { not: null }, ...notCancelledSub },
        _sum: { itemsTotal: true },
        _count: true,
        orderBy: { _sum: { itemsTotal: 'desc' } },
        take: 5,
      }),
      db.order.findMany({
        where: { createdAt: { gte: dayStart }, status: { not: 'CANCELLED' } },
        select: { grandTotal: true, createdAt: true },
      }),
      db.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          orderNumber: true,
          status: true,
          paymentStatus: true,
          grandTotal: true,
          createdAt: true,
          guestName: true,
          user: { select: { name: true } },
        },
      }),
      db.vendor.findMany({ where: { status: 'ACTIVE' }, select: { plan: { select: { priceMonthly: true, active: true } } } }),
    ])

    // ---- money aggregates ----
    const gmv = round2(orderAgg._sum.grandTotal ?? 0)
    const orderCount = orderAgg._count || 0
    const platformSales = round2(platformSalesAgg._sum.effectiveTotal ?? 0)
    const vendorSales = round2(vendorSalesAgg._sum.effectiveTotal ?? 0)
    const commissionEarned = round2(commissionAgg._sum.commissionAmount ?? 0)
    const platformProductMargin = round2(
      onePItems.reduce((s, i) => s + (i.effectiveTotal - (i.costSnapshot ?? 0)), 0)
    )
    const refundsTotal = round2(refundsAgg._sum.amount ?? 0)
    const paymentFees = round2(feesAgg._sum.feeAmount ?? 0)
    const netRevenue = round2(commissionEarned + platformProductMargin - refundsTotal)

    let credit = 0
    let debit = 0
    for (const g of ledgerUnsettled) {
      if (g.direction === 'CREDIT') credit = g._sum.amount ?? 0
      if (g.direction === 'DEBIT') debit = g._sum.amount ?? 0
    }
    const pendingSettlements = round2(credit - debit)

    // ---- orders rollup ----
    const statusMap: Record<string, number> = {}
    for (const g of orderGroups) statusMap[g.status] = g._count
    const ordersTotal = Object.values(statusMap).reduce((s, n) => s + n, 0)

    // ---- low stock ----
    const lowStock = activeProducts
      .filter((p) => p.stock <= p.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8)
      .map((p) => ({ id: p.id, title: p.title, stock: p.stock, vendor: p.vendor?.name ?? null }))

    // ---- top products ----
    const topProductIds = topProductGroups.map((g) => g.productId)
    const topProductRows = topProductIds.length
      ? await db.product.findMany({ where: { id: { in: topProductIds } }, select: { id: true, title: true } })
      : []
    const titleMap = new Map(topProductRows.map((p) => [p.id, p.title]))
    const topProducts = topProductGroups.map((g) => ({
      title: titleMap.get(g.productId) ?? 'Product',
      soldCount: g._sum.qty ?? 0,
      revenue: round2(g._sum.effectiveTotal ?? 0),
    }))

    // ---- top categories ----
    const catMap = new Map<string, number>()
    if (orderItemGroups.length > 0) {
      const prods = await db.product.findMany({
        where: { id: { in: orderItemGroups.map((g) => g.productId) } },
        select: { id: true, category: { select: { name: true } } },
      })
      const pm = new Map(prods.map((p) => [p.id, p.category.name]))
      for (const g of orderItemGroups) {
        const name = pm.get(g.productId)
        if (!name) continue
        catMap.set(name, round2((catMap.get(name) ?? 0) + (g._sum.effectiveTotal ?? 0)))
      }
    }
    const topCategories = [...catMap.entries()]
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // ---- top vendors ----
    const topVendorIds = topVendorGroups.map((g) => g.vendorId).filter((v): v is string => !!v)
    const topVendorRows = topVendorIds.length
      ? await db.vendor.findMany({ where: { id: { in: topVendorIds } }, select: { id: true, name: true } })
      : []
    const vendorNameMap = new Map(topVendorRows.map((v) => [v.id, v.name]))
    const topVendors = topVendorGroups.map((g) => ({
      name: vendorNameMap.get(g.vendorId ?? '') ?? 'Vendor',
      revenue: round2(g._sum.itemsTotal ?? 0),
      orders: g._count,
    }))

    // ---- sales by day (14d) ----
    const buckets = new Map<string, { gmv: number; orders: number }>()
    const salesByDay: { date: string; gmv: number; orders: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = subDays(now, i)
      buckets.set(format(d, 'yyyy-MM-dd'), { gmv: 0, orders: 0 })
      salesByDay.push({ date: format(d, 'dd MMM'), gmv: 0, orders: 0 })
    }
    for (const o of recentOrderRows) {
      const key = format(o.createdAt, 'yyyy-MM-dd')
      const b = buckets.get(key)
      if (b) {
        b.gmv = round2(b.gmv + o.grandTotal)
        b.orders += 1
      }
    }
    let idx = 0
    for (let i = 13; i >= 0; i--) {
      const b = buckets.get(format(subDays(now, i), 'yyyy-MM-dd'))
      salesByDay[idx].gmv = b?.gmv ?? 0
      salesByDay[idx].orders = b?.orders ?? 0
      idx++
    }

    // ---- subscription revenue ----
    const subscriptionRevenue = round2(
      activeVendors.reduce((s, v) => s + (v.plan?.active ? v.plan.priceMonthly : 0), 0)
    )

    return ok({
      gmv,
      platformSales,
      vendorSales,
      commissionEarned,
      platformProductMargin,
      paymentFees,
      refundsTotal,
      netRevenue, // estimate: commission + 1P product margin - refunds (excludes fees & subscriptions)
      pendingSettlements,
      orders: {
        total: ordersTotal,
        pendingPayment: statusMap['PENDING_PAYMENT'] ?? 0,
        confirmed: statusMap['CONFIRMED'] ?? 0,
        shipped: (statusMap['SHIPPED'] ?? 0) + (statusMap['PARTIALLY_SHIPPED'] ?? 0),
        delivered: (statusMap['DELIVERED'] ?? 0) + (statusMap['COMPLETED'] ?? 0),
        cancelled: statusMap['CANCELLED'] ?? 0,
        aov: round2(orderCount > 0 ? gmv / orderCount : 0),
      },
      customers: { total: customerCount, newThisWeek: newCustomers },
      vendors: { total: vendorTotal, active: vendorActive, pending: vendorPending },
      lowStock,
      topProducts,
      topCategories,
      topVendors,
      salesByDay,
      recentOrders: recentOrdersAll.map((o) => ({
        orderNumber: o.orderNumber,
        customer: o.user?.name ?? o.guestName ?? 'Guest',
        total: o.grandTotal,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      })),
      subscriptionRevenue,
    })
  } catch (err) {
    return handleError(err)
  }
}
