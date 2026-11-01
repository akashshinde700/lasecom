import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireUser, round2, PUBLIC_PRODUCT_WHERE } from '@/lib/api'

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
  condition: true,
  refurbGrade: true,
  brand: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  vendor: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect

type ReviewBody = { rating?: number; title?: string; comment?: string }

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    const product = await db.product.findFirst({
      where: {
        AND: [PUBLIC_PRODUCT_WHERE, { OR: [{ slug }, { id: slug }] }],
      },
      select: {
        ...productCardSelect,
        status: true,
        categoryId: true,
        description: true,
        specs: true,
        soldCount: true,
        createdAt: true,
        refurbNote: true,
        variants: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true, sku: true, price: true, stock: true },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoText: true,
            rating: true,
            ratingCount: true,
            city: true,
            state: true,
            description: true,
          },
        },
      },
    })
    if (!product || product.status !== 'ACTIVE') throw new HttpError('Product not found', 404)

    const sp = req.nextUrl.searchParams
    const reviewPage = Math.max(1, parseInt(sp.get('reviewPage') || sp.get('page') || '1') || 1)
    const reviewLimit = Math.min(20, Math.max(1, parseInt(sp.get('reviewLimit') || '5') || 5))

    const reviewWhere = { productId: product.id, status: 'APPROVED' }

    const [related, reviews, totalReviews, breakdownGroups] = await Promise.all([
      db.product.findMany({
        where: {
          ...PUBLIC_PRODUCT_WHERE,
          categoryId: product.categoryId,
          id: { not: product.id },
        },
        select: productCardSelect,
        orderBy: [{ soldCount: 'desc' }, { rating: 'desc' }],
        take: 8,
      }),
      db.review.findMany({
        where: reviewWhere,
        orderBy: { createdAt: 'desc' },
        skip: (reviewPage - 1) * reviewLimit,
        take: reviewLimit,
        select: {
          id: true,
          rating: true,
          title: true,
          comment: true,
          verified: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      }),
      db.review.count({ where: reviewWhere }),
      db.review.groupBy({ by: ['rating'], where: reviewWhere, _count: { rating: true } }),
    ])

    const ratingBreakdown: Record<string, number> = {}
    for (const g of breakdownGroups) ratingBreakdown[String(g.rating)] = g._count.rating

    return ok({
      product,
      related,
      reviews: { items: reviews, total: totalReviews, page: reviewPage },
      ratingBreakdown,
    })
  } catch (err) {
    return handleError(err)
  }
}

/**
 * POST /api/products/:slug — body { rating(1-5), title?, comment }
 * One review per user per product (upsert). verified=true if the user has a
 * DELIVERED order item for this product. Recomputes product rating aggregate.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const user = await requireUser()
    const body = (await req.json()) as ReviewBody

    const rating = Math.floor(Number(body.rating))
    if (!rating || rating < 1 || rating > 5) throw new HttpError('Rating must be between 1 and 5')
    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : ''
    if (!comment) throw new HttpError('Review comment is required')
    const title =
      typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 100) : null

    const product = await db.product.findFirst({
      where: {
        AND: [PUBLIC_PRODUCT_WHERE, { OR: [{ id: slug }, { slug }] }],
      },
      select: { id: true, status: true, vendorId: true },
    })
    if (!product || product.status !== 'ACTIVE') throw new HttpError('Product not found', 404)

    const deliveredItem = await db.orderItem.findFirst({
      where: {
        productId: product.id,
        status: { not: 'CANCELLED' },
        subOrder: { status: 'DELIVERED', order: { userId: user.id } },
      },
      select: { id: true },
    })

    const review = await db.review.upsert({
      where: { userId_productId: { userId: user.id, productId: product.id } },
      create: {
        productId: product.id,
        userId: user.id,
        rating,
        title,
        comment,
        verified: !!deliveredItem,
        status: 'APPROVED',
      },
      update: { rating, title, comment, verified: !!deliveredItem },
    })

    const agg = await db.review.aggregate({
      where: { productId: product.id, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { rating: true },
    })
    const avgRating = round2(agg._avg.rating ?? 0)
    const reviewCount = agg._count.rating

    await db.product.update({
      where: { id: product.id },
      data: { rating: avgRating, reviewCount },
    })

    if (product.vendorId) {
      const vendorAgg = await db.review.aggregate({
        where: { product: { vendorId: product.vendorId }, status: 'APPROVED' },
        _avg: { rating: true },
        _count: { rating: true },
      })
      await db.vendor.update({
        where: { id: product.vendorId },
        data: {
          rating: round2(vendorAgg._avg.rating ?? 0),
          ratingCount: vendorAgg._count.rating,
        },
      })
    }

    return ok({ rating: avgRating, reviewCount, review })
  } catch (err) {
    return handleError(err)
  }
}
