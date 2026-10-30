import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, requireAdmin, HttpError } from '@/lib/api'
import { notify } from '@/lib/api'

const STATUSES = ['OPEN', 'QUOTED', 'ACCEPTED', 'CLOSED']

/**
 * PATCH /api/admin/quotes/:id
 * Body: { status?, quotedTotal?, quoteNote? }
 * Moves a quote through OPEN -> QUOTED -> ACCEPTED/CLOSED and records the
 * quoted amount + note. If the requester is a registered user they get an
 * in-app notification when the quote is sent (status -> QUOTED).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as {
      status?: string
      quotedTotal?: number
      quoteNote?: string
    }

    const quote = await db.quoteRequest.findUnique({ where: { id } })
    if (!quote) throw new HttpError('Quote request not found', 404)

    if (body.status && !STATUSES.includes(body.status)) {
      throw new HttpError('Invalid status', 400)
    }
    if (body.quotedTotal !== undefined && (Number.isNaN(Number(body.quotedTotal)) || Number(body.quotedTotal) < 0)) {
      throw new HttpError('Invalid quoted total', 400)
    }

    const nextStatus = body.status ?? quote.status
    const willQuote = nextStatus === 'QUOTED' && quote.status !== 'QUOTED'

    const updated = await db.quoteRequest.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.quotedTotal !== undefined ? { quotedTotal: Number(body.quotedTotal) } : {}),
        ...(body.quoteNote !== undefined ? { quoteNote: String(body.quoteNote).slice(0, 1000) } : {}),
      },
      include: { items: true },
    })

    if (willQuote && updated.userId) {
      await notify(
        updated.userId,
        'Your quote is ready',
        `Quotation ${updated.quoteNumber} is ready${updated.quotedTotal ? ` — total ₹${updated.quotedTotal}` : ''}. Check My Quotes in your account.`,
        'SYSTEM'
      )
    }

    return ok({ quote: updated })
  } catch (err) {
    return handleError(err)
  }
}
