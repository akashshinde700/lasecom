import { randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireVendor, round2, parsePage, logAudit } from '@/lib/api'

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

function normalizeImages(images: unknown): string {
  if (Array.isArray(images)) {
    const arr = images.filter((i): i is string => typeof i === 'string' && i.trim() !== '')
    return JSON.stringify(arr)
  }
  return '[]'
}

function normalizeSpecs(specs: unknown): string | null {
  if (specs && typeof specs === 'object' && !Array.isArray(specs)) return JSON.stringify(specs)
  if (typeof specs === 'string' && specs.trim() !== '') return specs
  return null
}

function toInt(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback
}

const CONDITIONS = ['NEW', 'REFURBISHED']
const REFURB_GRADES = ['EXCELLENT', 'GOOD', 'FAIR']

/** Extract validated condition fields from a request body. */
function conditionFields(body: Record<string, unknown>): { condition?: string; refurbGrade?: string | null; refurbNote?: string | null } {
  const out: { condition?: string; refurbGrade?: string | null; refurbNote?: string | null } = {}
  const rawCondition = typeof body.condition === 'string' ? body.condition.trim().toUpperCase() : 'NEW'
  const condition = CONDITIONS.includes(rawCondition) ? rawCondition : 'NEW'
  out.condition = condition
  if (condition === 'REFURBISHED') {
    const grade = typeof body.refurbGrade === 'string' ? body.refurbGrade.trim().toUpperCase() : ''
    out.refurbGrade = REFURB_GRADES.includes(grade) ? grade : 'GOOD'
    out.refurbNote = typeof body.refurbNote === 'string' && body.refurbNote.trim() !== '' ? body.refurbNote.trim().slice(0, 500) : null
  } else {
    out.refurbGrade = null
    out.refurbNote = null
  }
  return out
}

// ---------------- GET: paginated vendor product list ----------------
export async function GET(req: NextRequest) {
  try {
    const { vendor } = await requireVendor()
    const sp = req.nextUrl.searchParams
    const { page, limit, skip } = parsePage(sp)

    const where: Prisma.ProductWhereInput = { vendorId: vendor.id }
    const status = sp.get('status')
    if (status) where.status = status
    const search = sp.get('search')
    if (search) where.title = { contains: search }

    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          variants: true,
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
        },
      }),
      db.product.count({ where }),
    ])

    return ok({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- POST: create vendor product ----------------
export async function POST(req: NextRequest) {
  try {
    const { user, vendor } = await requireVendor()
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

    // ---- plan listing limit enforcement ----
    if (vendor.planId) {
      const plan = await db.subscriptionPlan.findUnique({ where: { id: vendor.planId } })
      if (plan && plan.listingLimit !== -1) {
        const count = await db.product.count({ where: { vendorId: vendor.id, status: { not: 'ARCHIVED' } } })
        if (count >= plan.listingLimit) {
          throw new HttpError('Listing limit reached. Upgrade your plan.', 403)
        }
      }
    }

    // ---- status from settings ----
    const autoApproveSetting = await db.setting.findUnique({ where: { key: 'product.autoApprove' } })
    const status = autoApproveSetting?.value === 'true' ? 'ACTIVE' : 'PENDING_REVIEW'

    const slug = await uniqueProductSlug(title)
    const stock = toInt(body.stock, 0)
    const mrpRaw = Number(body.mrp)
    const mrp = Number.isFinite(mrpRaw) && mrpRaw > 0 ? mrpRaw : price
    const costRaw = Number(body.cost)

    const product = await db.product.create({
      data: {
        title,
        slug,
        description,
        sellerType: 'VENDOR',
        vendorId: vendor.id,
        categoryId,
        brandId,
        images: normalizeImages(body.images),
        specs: normalizeSpecs(body.specs),
        price: round2(price),
        mrp: round2(mrp),
        cost: Number.isFinite(costRaw) && costRaw > 0 ? round2(costRaw) : null,
        stock,
        status,
        weightGrams: toInt(body.weightGrams, 500),
        freeShipping: body.freeShipping === true,
        ...conditionFields(body),
      },
    })

    // seed stock movement for the product itself
    if (stock > 0) {
      await db.stockMovement.create({
        data: {
          productId: product.id,
          delta: stock,
          reason: 'SEED',
          refId: product.id,
          actorName: user.name,
        },
      })
    }

    // ---- variants (sku derived from product id, unique) ----
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

    await logAudit(user, 'product.create', 'Product', product.id, title)

    const created = await db.product.findUnique({
      where: { id: product.id },
      include: { variants: true, category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } } },
    })
    return ok({ product: created }, 201)
  } catch (err) {
    return handleError(err)
  }
}
