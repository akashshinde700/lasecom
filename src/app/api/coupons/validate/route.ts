import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, round2 } from '@/lib/api'

type ValidateBody = { code?: string; itemsTotal?: number }

/**
 * POST /api/coupons/validate — body { code, itemsTotal }
 * Public coupon validation. Rules: active, not expired, usageLimit not
 * exceeded, minOrder <= itemsTotal.
 * PERCENT -> min(round2(total*value/100), maxDiscount); FLAT -> value.
 * Discount never exceeds itemsTotal.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ValidateBody
    const code = String(body.code ?? '').trim().toUpperCase()
    const itemsTotal = Number(body.itemsTotal)
    if (!code) throw new HttpError('Coupon code is required')
    if (!Number.isFinite(itemsTotal) || itemsTotal <= 0) {
      throw new HttpError('itemsTotal must be a positive number')
    }

    const exact = await db.coupon.findUnique({ where: { code } })
    const coupon =
      exact ??
      (await db.coupon.findMany({ where: { code: { contains: code } } })).find(
        (c) => c.code.toUpperCase() === code
      )
    if (!coupon || !coupon.active) throw new HttpError('Invalid coupon code', 404)
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new HttpError('This coupon has expired')
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new HttpError('This coupon has reached its usage limit')
    }
    if (itemsTotal < coupon.minOrder) {
      throw new HttpError(`This coupon requires a minimum order of ₹${coupon.minOrder}`)
    }

    let discount =
      coupon.type === 'PERCENT' ? round2((itemsTotal * coupon.value) / 100) : round2(coupon.value)
    if (coupon.type === 'PERCENT' && coupon.maxDiscount != null) {
      discount = Math.min(discount, coupon.maxDiscount)
    }
    discount = round2(Math.min(discount, itemsTotal))

    return ok({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discount,
      description: coupon.description,
    })
  } catch (err) {
    return handleError(err)
  }
}
