import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, logAudit } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// ---------------- PATCH: update banner ----------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const banner = await db.banner.findUnique({ where: { id } })
    if (!banner) throw new HttpError('Banner not found', 404)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (typeof body.active === 'boolean') data.active = body.active
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
    if (typeof body.imageUrl === 'string' && body.imageUrl.trim()) data.imageUrl = body.imageUrl.trim()
    if (typeof body.link === 'string') data.link = body.link || null
    if (typeof body.position === 'string' && ['HERO', 'PROMO'].includes(body.position)) data.position = body.position
    if (body.sortOrder !== undefined) data.sortOrder = Math.trunc(Number(body.sortOrder) || 0)
    if (Object.keys(data).length === 0) throw new HttpError('Nothing to update', 400)

    const updated = await db.banner.update({ where: { id }, data })
    await logAudit(user, 'banner.update', 'Banner', id, JSON.stringify(data))
    return ok({ banner: updated })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- DELETE ----------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const banner = await db.banner.findUnique({ where: { id } })
    if (!banner) throw new HttpError('Banner not found', 404)

    await db.banner.delete({ where: { id } })
    await logAudit(user, 'banner.delete', 'Banner', id, banner.title)
    return ok({ deleted: true })
  } catch (err) {
    return handleError(err)
  }
}
