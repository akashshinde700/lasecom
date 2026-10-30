import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, requireAdmin, parsePage, HttpError } from '@/lib/api'

/**
 * GET /api/admin/quotes?status=OPEN|QUOTED|ACCEPTED|CLOSED&kind=B2B&page=1&q=…
 * Admin list of quote requests with items, newest first.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const sp = req.nextUrl.searchParams
    const { page, limit, skip } = parsePage(sp)

    const status = sp.get('status')
    if (status && !['OPEN', 'QUOTED', 'ACCEPTED', 'CLOSED'].includes(status)) {
      throw new HttpError('Invalid status filter', 400)
    }
    const kind = sp.get('kind')
    if (kind && !['CUSTOMER', 'B2B'].includes(kind)) {
      throw new HttpError('Invalid kind filter', 400)
    }
    const q = (sp.get('q') ?? '').trim()

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (kind) where.kind = kind
    if (q) {
      where.OR = [
        { quoteNumber: { contains: q } },
        { name: { contains: q } },
        { company: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ]
    }

    const [items, total] = await Promise.all([
      db.quoteRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: {
            select: { id: true, titleSnapshot: true, condition: true, qty: true, unitPrice: true, targetPrice: true },
          },
        },
      }),
      db.quoteRequest.count({ where }),
    ])

    return ok({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (err) {
    return handleError(err)
  }
}
