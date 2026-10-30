import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, requireAdmin, parsePage, HttpError } from '@/lib/api'
import { EWASTE_STATUSES } from '@/lib/ewaste'

/**
 * GET /api/admin/ewaste?status=NEW|SCHEDULED|COLLECTED|CLOSED|REJECTED&page=1&q=…
 * Admin list of e-waste pickup requests, newest first.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const sp = req.nextUrl.searchParams
    const { page, limit, skip } = parsePage(sp)

    const status = sp.get('status')
    if (status && !EWASTE_STATUSES.includes(status)) {
      throw new HttpError('Invalid status filter', 400)
    }
    const q = (sp.get('q') ?? '').trim()

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (q) {
      where.OR = [
        { requestNumber: { contains: q } },
        { company: { contains: q } },
        { contactName: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { city: { contains: q } },
      ]
    }

    const [items, total] = await Promise.all([
      db.ewasteRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.ewasteRequest.count({ where }),
    ])

    return ok({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (err) {
    return handleError(err)
  }
}
