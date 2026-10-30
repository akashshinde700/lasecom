import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError } from '@/lib/api'
import { requireUser } from '@/lib/api'

/**
 * GET /api/quotes/mine — logged-in customer's quote requests ( newest first),
 * including quoted totals + admin note so users can track RFQ status.
 */
export async function GET(_req: NextRequest) {
  try {
    const user = await requireUser()
    const quotes = await db.quoteRequest.findMany({
      where: {
        OR: [{ userId: user.id }, { email: user.email.toLowerCase() }],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { items: { select: { id: true, titleSnapshot: true, qty: true, unitPrice: true, targetPrice: true } } },
    })
    return ok({ items: quotes })
  } catch (err) {
    return handleError(err)
  }
}
