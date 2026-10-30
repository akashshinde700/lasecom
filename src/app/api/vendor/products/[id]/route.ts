import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, fail, handleError, HttpError, requireVendor, round2, logAudit } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

const CONDITIONS = ['NEW', 'REFURBISHED']
const REFURB_GRADES = ['EXCELLENT', 'GOOD', 'FAIR']

async function getOwnedProduct(id: string, vendorId: string) {
  const product = await db.product.findUnique({ where: { id }, include: { variants: true } })
  if (!product || product.vendorId !== vendorId) throw new HttpError('Product not found', 404)
  return product
}

// ---------------- PATCH: partial update (owner only) ----------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { user, vendor } = await requireVendor()
    const { id } = await params
    const product = await getOwnedProduct(id, vendor.id)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const data: Record<string, unknown> = {}

    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
    if (typeof body.description === 'string' && body.description.trim()) data.description = body.description.trim()

    if (typeof body.categoryId === 'string' && body.categoryId) {
      const category = await db.category.findUnique({ where: { id: body.categoryId } })
      if (!category) throw new HttpError('Category not found', 404)
      data.categoryId = category.id
    }
    if (body.brandId === null) data.brandId = null
    else if (typeof body.brandId === 'string' && body.brandId) {
      const brand = await db.brand.findUnique({ where: { id: body.brandId } })
      if (!brand) throw new HttpError('Brand not found', 404)
      data.brandId = brand.id
    }

    if (body.price !== undefined) {
      const price = Number(body.price)
      if (!Number.isFinite(price) || price <= 0) throw new HttpError('Invalid price', 400)
      data.price = round2(price)
    }
    if (body.mrp !== undefined) {
      const mrp = Number(body.mrp)
      if (!Number.isFinite(mrp) || mrp <= 0) throw new HttpError('Invalid MRP', 400)
      data.mrp = round2(mrp)
    }
    if (body.cost !== undefined) {
      if (body.cost === null) data.cost = null
      else {
        const cost = Number(body.cost)
        if (!Number.isFinite(cost) || cost < 0) throw new HttpError('Invalid cost', 400)
        data.cost = round2(cost)
      }
    }

    if (body.stock !== undefined) {
      const newStock = Math.max(0, Math.floor(Number(body.stock) || 0))
      if (newStock !== product.stock) {
        data.stock = newStock
        await db.stockMovement.create({
          data: {
            productId: product.id,
            delta: newStock - product.stock,
            reason: 'MANUAL_ADJUST',
            refId: product.id,
            actorName: user.name,
          },
        })
      }
    }

    if (Array.isArray(body.images)) {
      data.images = JSON.stringify(body.images.filter((i): i is string => typeof i === 'string' && i.trim() !== ''))
    }
    if (body.specs !== undefined) {
      if (body.specs && typeof body.specs === 'object' && !Array.isArray(body.specs)) data.specs = JSON.stringify(body.specs)
      else if (body.specs === null) data.specs = null
    }
    if (body.weightGrams !== undefined) data.weightGrams = Math.max(0, Math.floor(Number(body.weightGrams) || 0))
    if (typeof body.freeShipping === 'boolean') data.freeShipping = body.freeShipping
    if (typeof body.condition === 'string') {
      const condition = body.condition.trim().toUpperCase()
      if (!CONDITIONS.includes(condition)) throw new HttpError('Invalid condition', 400)
      data.condition = condition
      if (condition === 'REFURBISHED') {
        const grade = typeof body.refurbGrade === 'string' ? body.refurbGrade.trim().toUpperCase() : ''
        data.refurbGrade = REFURB_GRADES.includes(grade) ? grade : 'GOOD'
        if (typeof body.refurbNote === 'string') {
          data.refurbNote = body.refurbNote.trim() !== '' ? body.refurbNote.trim().slice(0, 500) : null
        }
      } else {
        data.refurbGrade = null
        data.refurbNote = null
      }
    } else {
      if (typeof body.refurbGrade === 'string') {
        const grade = body.refurbGrade.trim().toUpperCase()
        if (!REFURB_GRADES.includes(grade)) throw new HttpError('Invalid refurb grade', 400)
        data.refurbGrade = grade
      }
      if (typeof body.refurbNote === 'string') {
        data.refurbNote = body.refurbNote.trim() !== '' ? body.refurbNote.trim().slice(0, 500) : null
      }
    }
    if (body.lowStockThreshold !== undefined) {
      data.lowStockThreshold = Math.max(0, Math.floor(Number(body.lowStockThreshold) || 0))
    }

    if (Object.keys(data).length === 0) return fail('Nothing to update', 400)

    const updated = await db.product.update({
      where: { id: product.id },
      data,
      include: { variants: true },
    })

    await logAudit(user, 'product.update', 'Product', product.id, product.title)
    return ok({ product: updated })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- DELETE: soft archive ----------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { user, vendor } = await requireVendor()
    const { id } = await params
    const product = await getOwnedProduct(id, vendor.id)

    if (product.status === 'ARCHIVED') return ok({ archived: true })

    const activeItems = await db.orderItem.count({ where: { productId: product.id, status: 'ACTIVE' } })
    if (activeItems > 0) {
      throw new HttpError('Cannot archive: product has active orders', 400)
    }

    await db.product.update({ where: { id: product.id }, data: { status: 'ARCHIVED' } })
    await logAudit(user, 'product.archive', 'Product', product.id, product.title)
    return ok({ archived: true })
  } catch (err) {
    return handleError(err)
  }
}
