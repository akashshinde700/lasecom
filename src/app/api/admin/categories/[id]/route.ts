import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, round2, logAudit } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// ---------------- PATCH: update category ----------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const category = await db.category.findUnique({ where: { id } })
    if (!category) throw new HttpError('Category not found', 404)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const data: Record<string, unknown> = {}

    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if (typeof body.active === 'boolean') data.active = body.active
    if (body.sortOrder !== undefined) data.sortOrder = Math.trunc(Number(body.sortOrder) || 0)
    if (typeof body.icon === 'string') data.icon = body.icon || null
    if (body.commissionPercent !== undefined) {
      if (body.commissionPercent === null) data.commissionPercent = null
      else {
        const cp = Number(body.commissionPercent)
        if (!Number.isFinite(cp) || cp < 0 || cp > 100) throw new HttpError('Commission percent must be 0-100', 400)
        data.commissionPercent = round2(cp)
      }
    }
    if (Object.keys(data).length === 0) throw new HttpError('Nothing to update', 400)

    const updated = await db.category.update({ where: { id }, data })
    await logAudit(user, 'category.update', 'Category', id, JSON.stringify(data))
    return ok({ category: updated })
  } catch (err) {
    return handleError(err)
  }
}
