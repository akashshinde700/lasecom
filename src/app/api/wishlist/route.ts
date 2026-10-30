import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireUser } from '@/lib/api'

const productCardSelect = {
  id: true,
  title: true,
  slug: true,
  price: true,
  mrp: true,
  images: true,
  rating: true,
  reviewCount: true,
  badge: true,
  sponsored: true,
  stock: true,
  sellerType: true,
  freeShipping: true,
  weightGrams: true,
  brand: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  vendor: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect

export async function GET() {
  try {
    const user = await requireUser()
    const items = await db.wishlistItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, product: { select: productCardSelect } },
    })
    return ok({ items })
  } catch (err) {
    return handleError(err)
  }
}

/** POST /api/wishlist — body { productId }; toggles. Returns { wishlisted }. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = (await req.json()) as { productId?: string }
    const productId = body.productId ?? ''
    if (!productId) throw new HttpError('productId is required')

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true },
    })
    if (!product || product.status !== 'ACTIVE') throw new HttpError('Product not found', 404)

    const existing = await db.wishlistItem.findUnique({
      where: { userId_productId: { userId: user.id, productId } },
      select: { id: true },
    })

    if (existing) {
      await db.wishlistItem.delete({ where: { id: existing.id } })
      return ok({ wishlisted: false })
    }

    await db.wishlistItem.create({ data: { userId: user.id, productId } })
    return ok({ wishlisted: true })
  } catch (err) {
    return handleError(err)
  }
}
