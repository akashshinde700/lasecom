import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, HttpError } from '@/lib/api'

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    const vendor = await db.vendor.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoText: true,
        bannerUrl: true,
        description: true,
        rating: true,
        ratingCount: true,
        city: true,
        state: true,
        createdAt: true,
      },
    })
    if (!vendor) throw new HttpError('Vendor not found', 404)

    const products = await db.product.findMany({
      where: { vendorId: vendor.id, status: 'ACTIVE' },
      select: productCardSelect,
      orderBy: [{ sponsored: 'desc' }, { soldCount: 'desc' }, { createdAt: 'desc' }],
      take: 60,
    })

    return ok({ vendor, products })
  } catch (err) {
    return handleError(err)
  }
}
