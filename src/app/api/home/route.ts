import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, PUBLIC_PRODUCT_WHERE } from '@/lib/api'

// Explicit select — never `include` on Product: `cost` / `commissionPercent`
// are internal columns that must not reach anonymous clients.
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

export async function GET() {
  try {
    const settingsRows = await db.setting.findMany()
    const settingsMap: Record<string, string> = {}
    for (const r of settingsRows) settingsMap[r.key] = r.value

    const [banners, categories, featured, bestSellers, newArrivals, deals, refurbished, vendors] = await Promise.all([
      db.banner.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      db.category.findMany({
        where: { active: true, parentId: null },
        orderBy: { sortOrder: 'asc' },
        include: { children: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
      }),
      db.product.findMany({
        where: { ...PUBLIC_PRODUCT_WHERE, isFeatured: true },
        select: productCardSelect,
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      db.product.findMany({
        where: { ...PUBLIC_PRODUCT_WHERE, badge: 'BESTSELLER' },
        select: productCardSelect,
        take: 10,
        orderBy: { soldCount: 'desc' },
      }),
      db.product.findMany({
        where: { ...PUBLIC_PRODUCT_WHERE, badge: 'NEW_ARRIVAL' },
        select: productCardSelect,
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      db.product.findMany({
        where: { ...PUBLIC_PRODUCT_WHERE, sponsored: true },
        select: productCardSelect,
        take: 6,
        orderBy: { updatedAt: 'desc' },
      }),
      db.product.findMany({
        where: { ...PUBLIC_PRODUCT_WHERE, condition: 'REFURBISHED' },
        select: productCardSelect,
        take: 10,
        orderBy: [{ soldCount: 'desc' }, { rating: 'desc' }],
      }),
      db.vendor.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, slug: true, logoText: true, city: true, state: true, rating: true, description: true },
        take: 8,
        orderBy: { rating: 'desc' },
      }),
    ])

    return ok({
      siteName: settingsMap['site.name'] ?? 'Lastrivon Kart India',
      announcement: settingsMap['site.announcement'] ?? null,
      freeShipThreshold: parseFloat(settingsMap['shipping.freeThreshold'] ?? '499'),
      baseShipFee: parseFloat(settingsMap['shipping.baseFee'] ?? '49'),
      codFee: parseFloat(settingsMap['shipping.codFee'] ?? '25'),
      codEnabled: settingsMap['cod.enabled'] !== 'false',
      banners,
      categories,
      featured,
      bestSellers,
      newArrivals,
      deals,
      refurbished,
      vendors,
    })
  } catch (err) {
    return handleError(err)
  }
}
