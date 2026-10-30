import { db } from '@/lib/db'
import { ok, handleError, requireUser } from '@/lib/api'

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

async function getOrCreateCart(userId: string) {
  const existing = await db.cart.findUnique({ where: { userId }, include: cartInclude })
  if (existing) return existing
  return db.cart.create({ data: { userId }, include: cartInclude })
}

export async function GET() {
  try {
    const user = await requireUser()
    const cart = await getOrCreateCart(user.id)
    return ok({ items: cart.items, couponCode: cart.couponCode })
  } catch (err) {
    return handleError(err)
  }
}
