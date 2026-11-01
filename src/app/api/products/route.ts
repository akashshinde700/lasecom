import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, parsePage, PUBLIC_PRODUCT_WHERE } from '@/lib/api'

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
  _count: { select: { variants: true } },
} satisfies Prisma.ProductSelect

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const { page, limit, skip } = parsePage(sp)

    const search = sp.get('search')?.trim() || ''
    const categorySlug = sp.get('category')?.trim() || ''
    const brandSlug = sp.get('brand')?.trim() || ''
    const vendorSlug = sp.get('vendor')?.trim() || ''
    const badge = sp.get('badge')?.trim() || ''
    const condition = sp.get('condition')?.trim().toUpperCase() || ''
    const min = parseFloat(sp.get('min') || '')
    const max = parseFloat(sp.get('max') || '')
    const rating = parseFloat(sp.get('rating') || '')
    const sponsoredOnly = sp.get('sponsored') === 'true'
    const inStockOnly = sp.get('inStock') === 'true'
    const sort = sp.get('sort') || 'relevance'

    const conditions: Prisma.ProductWhereInput[] = [PUBLIC_PRODUCT_WHERE]
    if (search) {
      conditions.push({
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
          { brand: { name: { contains: search } } },
        ],
      })
    }
    if (categorySlug) {
      // match products in the category itself or in any of its children
      conditions.push({
        OR: [{ category: { slug: categorySlug } }, { category: { parent: { slug: categorySlug } } }],
      })
    }
    if (brandSlug) conditions.push({ brand: { slug: brandSlug } })
    if (vendorSlug) conditions.push({ vendor: { slug: vendorSlug, status: 'ACTIVE' } })
    if (badge) conditions.push({ badge })
    if (condition === 'NEW' || condition === 'REFURBISHED') conditions.push({ condition })
    if (!isNaN(min) || !isNaN(max)) {
      conditions.push({
        price: {
          ...(isNaN(min) ? {} : { gte: min }),
          ...(isNaN(max) ? {} : { lte: max }),
        },
      })
    }
    if (!isNaN(rating) && rating > 0) conditions.push({ rating: { gte: rating } })
    if (sponsoredOnly) conditions.push({ sponsored: true })
    if (inStockOnly) conditions.push({ stock: { gt: 0 } })

    const where: Prisma.ProductWhereInput = { AND: conditions }

    let orderBy: Prisma.ProductOrderByWithRelationInput[]
    switch (sort) {
      case 'price_asc':
        orderBy = [{ price: 'asc' }]
        break
      case 'price_desc':
        orderBy = [{ price: 'desc' }]
        break
      case 'newest':
        orderBy = [{ createdAt: 'desc' }]
        break
      case 'rating':
        orderBy = [{ rating: 'desc' }, { reviewCount: 'desc' }]
        break
      default:
        orderBy = [{ soldCount: 'desc' }, { rating: 'desc' }]
    }

    const [items, total] = await Promise.all([
      db.product.findMany({ where, select: productCardSelect, orderBy, skip, take: limit }),
      db.product.count({ where }),
    ])

    return ok({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (err) {
    return handleError(err)
  }
}
