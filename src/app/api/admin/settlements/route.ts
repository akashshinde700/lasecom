import { randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, requirePlatformAdmin, round2, logAudit, notify } from '@/lib/api'

// ---------------- GET: settlements + per-vendor balances ----------------
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const sp = req.nextUrl.searchParams
    const vendorId = sp.get('vendorId')

    const [items, vendors, ledgerGroups] = await Promise.all([
      db.settlement.findMany({
        where: vendorId ? { vendorId } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { vendor: { select: { name: true } } },
      }),
      db.vendor.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      db.vendorLedger.groupBy({
        by: ['vendorId', 'direction'],
        where: { settled: false },
        _sum: { amount: true },
      }),
    ])

    const balanceMap = new Map<string, number>()
    for (const g of ledgerGroups) {
      if (!g.vendorId) continue
      const sum = g._sum?.amount ?? 0
      const delta = g.direction === 'CREDIT' ? sum : -sum
      balanceMap.set(g.vendorId, (balanceMap.get(g.vendorId) ?? 0) + delta)
    }

    return ok({
      items: items.map((s) => ({
        id: s.id,
        vendorId: s.vendorId,
        vendorName: s.vendor.name,
        amount: s.amount,
        status: s.status,
        reference: s.reference,
        createdAt: s.createdAt,
      })),
      byVendor: vendors.map((v) => ({
        vendorId: v.id,
        vendorName: v.name,
        balance: round2(balanceMap.get(v.id) ?? 0),
      })),
    })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- POST: payout a vendor's pending balance (PLATFORM_ADMIN only) ----------------
export async function POST(req: NextRequest) {
  try {
    const user = await requirePlatformAdmin()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const vendorId = typeof body.vendorId === 'string' ? body.vendorId : ''
    if (!vendorId) throw new HttpError('vendorId is required', 400)

    const vendor = await db.vendor.findUnique({ where: { id: vendorId }, select: { id: true, name: true, ownerId: true } })
    if (!vendor) throw new HttpError('Vendor not found', 404)

    const notes = typeof body.notes === 'string' ? body.notes.trim() : null

    const settlement = await db.$transaction(async (tx) => {
      const groups = await tx.vendorLedger.groupBy({
        by: ['direction'],
        where: { vendorId, settled: false },
        _sum: { amount: true },
      })
      let credit = 0
      let debit = 0
      for (const g of groups) {
        if (g.direction === 'CREDIT') credit = g._sum.amount ?? 0
        if (g.direction === 'DEBIT') debit = g._sum.amount ?? 0
      }
      const balance = round2(credit - debit)
      if (balance <= 0) throw new HttpError('No pending balance to settle', 400)

      const created = await tx.settlement.create({
        data: {
          vendorId,
          amount: balance,
          status: 'PROCESSED',
          reference: 'PAYOUT-' + randomBytes(4).toString('hex').toUpperCase(),
          notes,
          processedAt: new Date(),
        },
      })

      // mark all unsettled entries as settled under this payout
      await tx.vendorLedger.updateMany({
        where: { vendorId, settled: false },
        data: { settled: true, settlementId: created.id },
      })

      // payout debit row (already settled so it never counts toward future balances)
      await tx.vendorLedger.create({
        data: {
          vendorId,
          type: 'SETTLEMENT_PAYOUT',
          direction: 'DEBIT',
          amount: balance,
          settled: true,
          settlementId: created.id,
          notes: `Payout ${created.reference}${notes ? ` — ${notes}` : ''}`,
        },
      })

      return created
    })

    await notify(
      vendor.ownerId,
      'Settlement processed',
      `A payout of ₹${settlement.amount.toFixed(2)} has been processed. Reference: ${settlement.reference}`,
      'PAYMENT'
    )
    await logAudit(user, 'settlement.create', 'Settlement', settlement.id, `${vendor.name} — ₹${settlement.amount}`)

    return ok({
      settlement: {
        id: settlement.id,
        vendorId: settlement.vendorId,
        amount: settlement.amount,
        status: settlement.status,
        reference: settlement.reference,
        createdAt: settlement.createdAt,
      },
    })
  } catch (err) {
    return handleError(err)
  }
}
