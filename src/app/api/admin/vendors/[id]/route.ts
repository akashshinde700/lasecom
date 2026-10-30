import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requirePlatformAdmin, round2, logAudit, notify } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

const VENDOR_STATUSES = ['ACTIVE', 'SUSPENDED', 'REJECTED', 'PENDING']

// ---------------- POST: change vendor status (PLATFORM_ADMIN only) ----------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requirePlatformAdmin()
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const status = typeof body.status === 'string' ? body.status : ''
    if (!VENDOR_STATUSES.includes(status)) {
      throw new HttpError('Invalid status', 400)
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

    const vendor = await db.vendor.findUnique({ where: { id }, select: { id: true, name: true, ownerId: true, status: true } })
    if (!vendor) throw new HttpError('Vendor not found', 404)

    const data: Record<string, unknown> = { status }
    if (status === 'REJECTED' || status === 'SUSPENDED') data.rejectionReason = reason || null
    if (status === 'ACTIVE') data.rejectionReason = null

    await db.vendor.update({ where: { id }, data })

    const statusText =
      status === 'ACTIVE'
        ? 'approved and is now live on the marketplace'
        : status === 'SUSPENDED'
          ? 'been suspended'
          : status === 'REJECTED'
            ? 'been rejected'
            : 'been moved to review'
    await notify(
      vendor.ownerId,
      `Vendor account ${status}`,
      `Your store "${vendor.name}" has ${statusText}.${reason ? ` Reason: ${reason}` : ''}`,
      'VENDOR'
    )

    await logAudit(user, 'vendor.status', 'Vendor', id, `${vendor.status} → ${status}${reason ? ` (${reason})` : ''}`)
    return ok({ id, status })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- PATCH: commission / plan (PLATFORM_ADMIN only) ----------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requirePlatformAdmin()
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const vendor = await db.vendor.findUnique({ where: { id }, select: { id: true, name: true, commissionPercent: true, planId: true } })
    if (!vendor) throw new HttpError('Vendor not found', 404)

    const data: Record<string, unknown> = {}
    if (body.commissionPercent !== undefined) {
      const cp = Number(body.commissionPercent)
      if (!Number.isFinite(cp) || cp < 0 || cp > 100) throw new HttpError('Commission percent must be 0-100', 400)
      data.commissionPercent = round2(cp)
    }
    if (body.planId !== undefined) {
      if (body.planId === null) data.planId = null
      else {
        const planId = typeof body.planId === 'string' ? body.planId : ''
        const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } })
        if (!plan) throw new HttpError('Plan not found', 404)
        data.planId = plan.id
      }
    }
    if (Object.keys(data).length === 0) throw new HttpError('Nothing to update', 400)

    await db.vendor.update({ where: { id }, data })
    await logAudit(user, 'vendor.update', 'Vendor', id, JSON.stringify(data))
    return ok({ id, ...data })
  } catch (err) {
    return handleError(err)
  }
}
