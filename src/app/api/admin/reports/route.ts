import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, requireAdmin, round2 } from '@/lib/api'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

type Row = (string | number)[]

// ---------------- GET: CSV-ready reports ----------------
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const sp = req.nextUrl.searchParams
    const type = sp.get('type') || 'sales'
    const fromParam = sp.get('from')
    const toParam = sp.get('to')

    let from = fromParam ? new Date(fromParam) : subDays(new Date(), 29)
    let to = toParam ? new Date(toParam) : new Date()
    if (Number.isNaN(from.getTime())) from = subDays(new Date(), 29)
    if (Number.isNaN(to.getTime())) to = new Date()
    from = startOfDay(from)
    to = endOfDay(to)

    if (type === 'vendors') {
      const [vendors, groups] = await Promise.all([
        db.vendor.findMany({ select: { id: true, name: true } }),
        db.subOrder.groupBy({
          by: ['vendorId'],
          where: { vendorId: { not: null }, status: { not: 'CANCELLED' }, createdAt: { gte: from, lte: to } },
          _sum: { itemsTotal: true, vendorEarning: true },
          _count: true,
        }),
      ])
      const nameMap = new Map(vendors.map((v) => [v.id, v.name]))
      const rows: Row[] = groups
        .sort((a, b) => (b._sum.itemsTotal ?? 0) - (a._sum.itemsTotal ?? 0))
        .map((g) => [
          nameMap.get(g.vendorId ?? '') ?? 'Vendor',
          g._count,
          round2(g._sum.itemsTotal ?? 0),
          round2(g._sum.vendorEarning ?? 0),
        ])
      return ok({ title: 'Vendor Sales Report', columns: ['Vendor', 'Orders', 'Sales', 'Net Earning'], rows })
    }

    if (type === 'settlements') {
      const items = await db.settlement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: { vendor: { select: { name: true } } },
      })
      const rows: Row[] = items.map((s) => [
        format(s.createdAt, 'dd MMM yyyy'),
        s.vendor.name,
        round2(s.amount),
        s.reference ?? '-',
        s.status,
      ])
      return ok({ title: 'Settlement History', columns: ['Date', 'Vendor', 'Amount', 'Reference', 'Status'], rows })
    }

    if (type === 'inventory') {
      const products = await db.product.findMany({
        where: { status: { not: 'ARCHIVED' } },
        orderBy: { stock: 'asc' },
        include: { vendor: { select: { name: true } } },
      })
      const rows: Row[] = products.map((p) => [
        p.title,
        p.vendor?.name ?? 'Platform',
        p.stock,
        round2(p.price),
        round2(p.stock * p.price),
      ])
      return ok({ title: 'Inventory Report', columns: ['Product', 'Seller', 'Stock', 'Price', 'Stock Value'], rows })
    }

    // default: sales report (per day)
    const orders = await db.order.findMany({
      where: { createdAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      select: { createdAt: true, itemsTotal: true, shippingTotal: true, discountTotal: true, grandTotal: true },
    })
    const buckets = new Map<string, { orders: number; items: number; shipping: number; discount: number; gmv: number }>()
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      buckets.set(format(d, 'yyyy-MM-dd'), { orders: 0, items: 0, shipping: 0, discount: 0, gmv: 0 })
    }
    for (const o of orders) {
      const key = format(o.createdAt, 'yyyy-MM-dd')
      const b = buckets.get(key)
      if (b) {
        b.orders += 1
        b.items = round2(b.items + o.itemsTotal)
        b.shipping = round2(b.shipping + o.shippingTotal)
        b.discount = round2(b.discount + o.discountTotal)
        b.gmv = round2(b.gmv + o.grandTotal)
      }
    }
    const rows: Row[] = [...buckets.entries()].map(([date, b]) => [
      format(new Date(date), 'dd MMM yyyy'),
      b.orders,
      b.items,
      b.shipping,
      b.discount,
      b.gmv,
    ])
    return ok({
      title: `Sales Report (${format(from, 'dd MMM yyyy')} - ${format(to, 'dd MMM yyyy')})`,
      columns: ['Date', 'Orders', 'Items Total', 'Shipping', 'Discount', 'GMV'],
      rows,
    })
  } catch (err) {
    return handleError(err)
  }
}
