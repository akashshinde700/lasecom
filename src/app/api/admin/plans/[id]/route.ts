import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requirePlatformAdmin, round2, logAudit } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// ---------------- PATCH: update plan (PLATFORM_ADMIN only) ----------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requirePlatformAdmin()
    const { id } = await params
    const plan = await db.subscriptionPlan.findUnique({ where: { id } })
    if (!plan) throw new HttpError('Plan not found', 404)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const data: Record<string, unknown> = {}

    if (typeof body.active === 'boolean') data.active = body.active
    if (body.priceMonthly !== undefined) {
      const price = Number(body.priceMonthly)
      if (!Number.isFinite(price) || price < 0) throw new HttpError('Invalid monthly price', 400)
      data.priceMonthly = round2(price)
    }
    if (body.listingLimit !== undefined) {
      const limit = Math.trunc(Number(body.listingLimit))
      if (!Number.isFinite(limit)) throw new HttpError('Invalid listing limit', 400)
      data.listingLimit = limit // -1 = unlimited
    }
    if (body.commissionDiscountPercent !== undefined) {
      const d = Number(body.commissionDiscountPercent)
      if (!Number.isFinite(d) || d < 0 || d > 100) throw new HttpError('Commission discount must be 0-100', 400)
      data.commissionDiscountPercent = round2(d)
    }
    if (Array.isArray(body.features)) {
      data.features = JSON.stringify(body.features.filter((f): f is string => typeof f === 'string'))
    }
    if (Object.keys(data).length === 0) throw new HttpError('Nothing to update', 400)

    const updated = await db.subscriptionPlan.update({ where: { id }, data })
    await logAudit(user, 'plan.update', 'SubscriptionPlan', id, JSON.stringify(data))
    return ok({ plan: updated })
  } catch (err) {
    return handleError(err)
  }
}
