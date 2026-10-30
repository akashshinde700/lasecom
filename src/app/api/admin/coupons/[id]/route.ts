import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, logAudit } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// ---------------- PATCH: toggle active ----------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const coupon = await db.coupon.findUnique({ where: { id } })
    if (!coupon) throw new HttpError('Coupon not found', 404)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (typeof body.active === 'boolean') data.active = body.active
    if (Object.keys(data).length === 0) throw new HttpError('Nothing to update', 400)

    const updated = await db.coupon.update({ where: { id }, data })
    await logAudit(user, 'coupon.update', 'Coupon', id, `${coupon.code} active=${updated.active}`)
    return ok({ coupon: updated })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- DELETE ----------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const coupon = await db.coupon.findUnique({ where: { id } })
    if (!coupon) throw new HttpError('Coupon not found', 404)

    await db.coupon.delete({ where: { id } })
    await logAudit(user, 'coupon.delete', 'Coupon', id, coupon.code)
    return ok({ deleted: true })
  } catch (err) {
    return handleError(err)
  }
}
