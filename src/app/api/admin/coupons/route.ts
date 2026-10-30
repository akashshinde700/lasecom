import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, round2, logAudit } from '@/lib/api'

// ---------------- GET: all coupons ----------------
export async function GET() {
  try {
    await requireAdmin()
    const items = await db.coupon.findMany({ orderBy: { createdAt: 'desc' } })
    return ok({ items })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- POST: create coupon ----------------
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    const type = typeof body.type === 'string' ? body.type : ''
    if (!code) throw new HttpError('Coupon code is required', 400)
    if (type !== 'PERCENT' && type !== 'FLAT') throw new HttpError('Type must be PERCENT or FLAT', 400)
    const value = Number(body.value)
    if (!Number.isFinite(value) || value <= 0) throw new HttpError('A valid value is required', 400)
    if (type === 'PERCENT' && value > 100) throw new HttpError('Percent value cannot exceed 100', 400)

    const existing = await db.coupon.findUnique({ where: { code } })
    if (existing) throw new HttpError('A coupon with this code already exists', 400)

    let expiresAt: Date | null = null
    if (typeof body.expiresAt === 'string' && body.expiresAt) {
      const d = new Date(body.expiresAt)
      if (Number.isNaN(d.getTime())) throw new HttpError('Invalid expiry date', 400)
      expiresAt = d
    }

    const coupon = await db.coupon.create({
      data: {
        code,
        type,
        value: round2(value),
        minOrder: Number.isFinite(Number(body.minOrder)) ? round2(Number(body.minOrder)) : 0,
        maxDiscount:
          body.maxDiscount !== undefined && body.maxDiscount !== null && Number.isFinite(Number(body.maxDiscount))
            ? round2(Number(body.maxDiscount))
            : null,
        usageLimit:
          body.usageLimit !== undefined && body.usageLimit !== null && Number.isFinite(Number(body.usageLimit))
            ? Math.max(0, Math.trunc(Number(body.usageLimit)))
            : null,
        description: typeof body.description === 'string' && body.description ? body.description : null,
        expiresAt,
      },
    })

    await logAudit(user, 'coupon.create', 'Coupon', coupon.id, code)
    return ok({ coupon }, 201)
  } catch (err) {
    return handleError(err)
  }
}
