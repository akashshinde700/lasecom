import { randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, round2, parsePage, logAudit } from '@/lib/api'

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'product'
  )
}

async function uniqueProductSlug(title: string): Promise<string> {
  const base = slugify(title)
  let slug = base
  let attempt = 1
  while (await db.product.findUnique({ where: { slug } })) {
    attempt += 1
    slug = `${base}-${attempt}`
  }
  return slug
}

async function uniqueVariantSku(productId: string, index: number): Promise<string> {
  const base = `SKU-${productId.slice(-8).toUpperCase()}-V${index}`
  let sku = base
  while (await db.productVariant.findUnique({ where: { sku } })) {
    sku = `${base}-${randomBytes(3).toString('hex').toUpperCase()}`
  }
  return sku
}

function toInt(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback
}

const CONDITIONS = ['NEW', 'REFURBISHED']
const REFURB_GRADES = ['EXCELLENT', 'GOOD', 'FAIR']

function conditionFields(body: Record<string, unknown>): { condition: string; refurbGrade: string | null; refurbNote: string | null } {
  const rawCondition = typeof body.condition === 'string' ? body.condition.trim().toUpperCase() : 'NEW'
  const condition = CONDITIONS.includes(rawCondition) ? rawCondition : 'NEW'
  if (condition === 'REFURBISHED') {
    const grade = typeof body.refurbGrade === 'string' ? body.refurbGrade.trim().toUpperCase() : ''
    const note = typeof body.refurbNote === 'string' && body.refurbNote.trim() !== '' ? body.refurbNote.trim().slice(0, 500) : null
    return { condition, refurbGrade: REFURB_GRADES.includes(grade) ? grade : 'GOOD', refurbNote: note }
  }
  return { condition: 'NEW', refurbGrade: null, refurbNote: null }
}

// ---------------- GET: paginated product list (filters) ----------------
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const sp = req.nextUrl.searchParams
    const { page, limit, skip } = parsePage(sp)

    const where: Prisma.ProductWhereInput = {}
    const status = sp.get('status')
    if (status) where.status = status
    const sellerType = sp.get('sellerType')
    if (sellerType) where.sellerType = sellerType
    const search = sp.get('search')
    if (search) where.title = { contains: search }
    const vendorSlug = sp.get('vendor')
    if (vendorSlug) {
      const vendor = await db.vendor.findUnique({ where: { slug: vendorSlug }, select: { id: true } })
      where.vendorId = vendor?.id ?? 'nonexistent'
    }

    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          vendor: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          variants: true,
        },
      }),
      db.product.count({ where }),
    ])

    return ok({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- POST: create PLATFORM (1P) product ----------------
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId : ''
    if (!title || !description || !categoryId) {
      throw new HttpError('Title, description and category are required', 400)
    }
    const price = Number(body.price)
    if (!Number.isFinite(price) || price <= 0) throw new HttpError('A valid price is required', 400)

    const category = await db.category.findUnique({ where: { id: categoryId } })
    if (!category) throw new HttpError('Category not found', 404)

    let brandId: string | null = null
    if (typeof body.brandId === 'string' && body.brandId) {
      const brand = await db.brand.findUnique({ where: { id: body.brandId } })
      if (!brand) throw new HttpError('Brand not found', 404)
      brandId = brand.id
    }

    const slug = await uniqueProductSlug(title)
    const stock = toInt(body.stock, 0)
    const mrpRaw = Number(body.mrp)
    const mrp = Number.isFinite(mrpRaw) && mrpRaw > 0 ? mrpRaw : price
    const costRaw = Number(body.cost)

    const images = Array.isArray(body.images)
      ? JSON.stringify(body.images.filter((i): i is string => typeof i === 'string' && i.trim() !== ''))
      : '[]'
    const specs =
      body.specs && typeof body.specs === 'object' && !Array.isArray(body.specs)
        ? JSON.stringify(body.specs)
        : typeof body.specs === 'string' && body.specs.trim() !== ''
          ? body.specs
          : null

    const product = await db.product.create({
      data: {
        title,
        slug,
        description,
        sellerType: 'PLATFORM',
        vendorId: null,
        categoryId,
        brandId,
        images,
        specs,
        price: round2(price),
        mrp: round2(mrp),
        cost: Number.isFinite(costRaw) && costRaw > 0 ? round2(costRaw) : null,
        stock,
        status: 'ACTIVE',
        weightGrams: toInt(body.weightGrams, 500),
        freeShipping: body.freeShipping === true,
        ...conditionFields(body),
      },
    })

    if (stock > 0) {
      await db.stockMovement.create({
        data: { productId: product.id, delta: stock, reason: 'SEED', refId: product.id, actorName: user.name },
      })
    }

    const variantInput = Array.isArray(body.variants) ? (body.variants as Record<string, unknown>[]) : []
    let vIndex = 0
    for (const v of variantInput) {
      const name = typeof v.name === 'string' ? v.name.trim() : ''
      if (!name) continue
      vIndex += 1
      const sku = await uniqueVariantSku(product.id, vIndex)
      const vPrice = Number(v.price)
      const vStock = toInt(v.stock, 0)
      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          name,
          sku,
          price: Number.isFinite(vPrice) && vPrice > 0 ? round2(vPrice) : null,
          stock: vStock,
        },
      })
      if (vStock > 0) {
        await db.stockMovement.create({
          data: {
            productId: product.id,
            variantId: variant.id,
            delta: vStock,
            reason: 'SEED',
            refId: product.id,
            actorName: user.name,
          },
        })
      }
    }

    await logAudit(user, 'product.create', 'Product', product.id, `[Platform] ${title}`)
    const created = await db.product.findUnique({
      where: { id: product.id },
      include: { variants: true, category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } } },
    })
    return ok({ product: created }, 201)
  } catch (err) {
    return handleError(err)
  }
}
