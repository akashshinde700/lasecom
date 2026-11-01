import { db } from '@/lib/db'
import { ok, handleError, requireVendorPermission, round2 } from '@/lib/api'

// ---------------- GET: vendor finance (balance, ledger, settlements — owner or ACCOUNTANT) ----------------
export async function GET() {
  try {
    const { vendor } = await requireVendorPermission('finance', { readOnly: true })
    const vendorId = vendor.id

    const [unsettledGroups, earningAgg, commissionAgg, settlements, ledger] = await Promise.all([
      db.vendorLedger.groupBy({ by: ['direction'], where: { vendorId, settled: false }, _sum: { amount: true } }),
      db.subOrder.aggregate({
        where: { vendorId, status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } },
        _sum: { vendorEarning: true },
      }),
      db.vendorLedger.aggregate({
        where: { vendorId, type: 'COMMISSION_DEBIT' },
        _sum: { amount: true },
      }),
      db.settlement.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      db.vendorLedger.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ])

    let credit = 0
    let debit = 0
    for (const g of unsettledGroups) {
      if (g.direction === 'CREDIT') credit = g._sum.amount ?? 0
      if (g.direction === 'DEBIT') debit = g._sum.amount ?? 0
    }

    return ok({
      balance: round2(credit - debit),
      lifetimeEarnings: round2(earningAgg._sum.vendorEarning ?? 0),
      commissionPaid: round2(commissionAgg._sum.amount ?? 0),
      settlements: settlements.map((s) => ({
        id: s.id,
        amount: s.amount,
        status: s.status,
        reference: s.reference,
        createdAt: s.createdAt,
      })),
      ledger: ledger.map((l) => ({
        id: l.id,
        type: l.type,
        direction: l.direction,
        amount: l.amount,
        notes: l.notes,
        settled: l.settled,
        createdAt: l.createdAt,
      })),
    })
  } catch (err) {
    return handleError(err)
  }
}
