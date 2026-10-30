import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError } from '@/lib/api'

/**
 * POST /api/newsletter — public footer newsletter subscription.
 *
 * Body: { email }
 * Idempotent: re-subscribing an existing email returns ok with already=true
 * (no duplicate rows, unique constraint on email).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string }

    const email = (body.email ?? '').trim().toLowerCase()
    if (!email || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new HttpError('Please enter a valid email address', 400)
    }

    const existing = await db.newsletterSubscriber.findUnique({ where: { email } })
    if (existing) {
      return ok({ already: true })
    }

    // Not found yet — create. Catch P2002 in case of a concurrent race.
    try {
      await db.newsletterSubscriber.create({ data: { email, source: 'footer' } })
    } catch (err) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        return ok({ already: true })
      }
      throw err
    }

    return ok({ already: false })
  } catch (err) {
    return handleError(err)
  }
}
