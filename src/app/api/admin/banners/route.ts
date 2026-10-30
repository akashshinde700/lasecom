import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, logAudit } from '@/lib/api'

// ---------------- GET: all banners ----------------
export async function GET() {
  try {
    await requireAdmin()
    const items = await db.banner.findMany({ orderBy: { sortOrder: 'asc' } })
    return ok({ items })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- POST: create banner ----------------
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
    if (!title || !imageUrl) throw new HttpError('Title and image URL are required', 400)
    const position = typeof body.position === 'string' && ['HERO', 'PROMO'].includes(body.position) ? body.position : 'HERO'

    const banner = await db.banner.create({
      data: {
        title,
        imageUrl,
        link: typeof body.link === 'string' && body.link ? body.link : null,
        position,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
      },
    })
    await logAudit(user, 'banner.create', 'Banner', banner.id, title)
    return ok({ banner }, 201)
  } catch (err) {
    return handleError(err)
  }
}
