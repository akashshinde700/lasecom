import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, requirePlatformAdmin, round2, logAudit } from '@/lib/api'

// ---------------- GET: all plans ----------------
export async function GET() {
  try {
    await requireAdmin()
    const items = await db.subscriptionPlan.findMany({
      orderBy: { priceMonthly: 'asc' },
      include: { _count: { select: { vendors: true } } },
    })
    return ok({ items })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- POST: create plan (PLATFORM_ADMIN only) ----------------
export async function POST(req: NextRequest) {
  try {
    const user = await requirePlatformAdmin()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) throw new HttpError('Plan name is required', 400)

    const existing = await db.subscriptionPlan.findUnique({ where: { name } })
    if (existing) throw new HttpError('A plan with this name already exists', 400)

    const priceMonthly = Number(body.priceMonthly)
    if (!Number.isFinite(priceMonthly) || priceMonthly < 0) throw new HttpError('A valid monthly price is required', 400)
    const listingLimitRaw = Number(body.listingLimit)
    const listingLimit = Number.isFinite(listingLimitRaw) ? Math.trunc(listingLimitRaw) : 10
    const discountRaw = Number(body.commissionDiscountPercent)
    const commissionDiscountPercent = Number.isFinite(discountRaw) ? Math.min(100, Math.max(0, discountRaw)) : 0

    const plan = await db.subscriptionPlan.create({
      data: {
        name,
        priceMonthly: round2(priceMonthly),
        listingLimit,
        commissionDiscountPercent: round2(commissionDiscountPercent),
        features: Array.isArray(body.features)
          ? JSON.stringify(body.features.filter((f): f is string => typeof f === 'string'))
          : typeof body.features === 'string' && body.features
            ? body.features
            : '[]',
      },
    })

    await logAudit(user, 'plan.create', 'SubscriptionPlan', plan.id, name)
    return ok({ plan }, 201)
  } catch (err) {
    return handleError(err)
  }
}
