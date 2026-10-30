import { NextRequest } from 'next/server'
import { Prisma, Coupon } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireUser, round2 } from '@/lib/api'

type CouponBody = { code?: string }

const cartProductSelect = {
  id: true,
  title: true,
  slug: true,
  price: true,
  mrp: true,
  images: true,
  stock: true,
  freeShipping: true,
  sellerType: true,
  vendor: { select: { name: true, slug: true } },
}

const cartInclude = {
  items: {
    orderBy: { id: 'asc' as const },
    include: {
      product: { select: cartProductSelect },
      variant: { select: { id: true, name: true, price: true, stock: true } },
    },
  },
}

/** Case-insensitive coupon lookup (SQLite `equals` is case-sensitive). */
async function findCoupon(client: Prisma.TransactionClient, code: string): Promise<Coupon | null> {
  const candidates = await client.coupon.findMany({ where: { code: { contains: code } }, take: 25 })
  return candidates.find((c) => c.code.toUpperCase() === code) ?? null
}

function computeDiscount(coupon: Coupon, itemsTotal: number): number {
  let discount =
    coupon.type === 'PERCENT' ? round2((itemsTotal * coupon.value) / 100) : round2(coupon.value)
  if (coupon.type === 'PERCENT' && coupon.maxDiscount != null) {
    discount = Math.min(discount, coupon.maxDiscount)
  }
  return round2(Math.min(discount, itemsTotal))
}

async function validateCoupon(code: string, itemsTotal: number): Promise<Coupon> {
  const coupon = await findCoupon(db, code)
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
  return coupon
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = (await req.json()) as CouponBody
    const code = String(body.code ?? '').trim().toUpperCase()
    if (!code) throw new HttpError('Coupon code is required')

    let cart = await db.cart.findUnique({ where: { userId: user.id }, include: cartInclude })
    if (!cart) {
      cart = await db.cart.create({ data: { userId: user.id }, include: cartInclude })
    }

    const itemsTotal = round2(
      cart.items.reduce((sum, i) => sum + (i.variant?.price ?? i.product.price) * i.qty, 0)
    )
    if (itemsTotal <= 0) throw new HttpError('Your cart is empty')

    const coupon = await validateCoupon(code, itemsTotal)
    const discount = computeDiscount(coupon, itemsTotal)

    await db.cart.update({ where: { id: cart.id }, data: { couponCode: coupon.code } })

    return ok({ code: coupon.code, discount, description: coupon.description })
  } catch (err) {
    return handleError(err)
  }
}

export async function DELETE() {
  try {
    const user = await requireUser()
    const cart = await db.cart.findUnique({ where: { userId: user.id }, select: { id: true } })
    if (cart) {
      await db.cart.update({ where: { id: cart.id }, data: { couponCode: null } })
    }
    return ok({ removed: true })
  } catch (err) {
    return handleError(err)
  }
}
