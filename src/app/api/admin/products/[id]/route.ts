import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, round2, logAudit } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

const PRODUCT_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'ARCHIVED', 'REJECTED']

// ---------------- PATCH: update any product (1P or 3P) ----------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })
    if (!product) throw new HttpError('Product not found', 404)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const data: Record<string, unknown> = {}

    if (body.status !== undefined) {
      const status = typeof body.status === 'string' ? body.status : ''
      if (!PRODUCT_STATUSES.includes(status)) throw new HttpError('Invalid status', 400)
      data.status = status
    }
    if (typeof body.isFeatured === 'boolean') data.isFeatured = body.isFeatured
    if (typeof body.sponsored === 'boolean') data.sponsored = body.sponsored
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

    // stock: absolute set or relative delta
    let stockDelta = 0
    if (body.stockDelta !== undefined && body.stockDelta !== null) {
      const delta = Math.trunc(Number(body.stockDelta))
      if (!Number.isFinite(delta) || delta === 0) throw new HttpError('Invalid stock delta', 400)
      const newStock = Math.max(0, product.stock + delta)
      stockDelta = newStock - product.stock
      data.stock = newStock
    } else if (body.stock !== undefined) {
      const newStock = Math.max(0, Math.floor(Number(body.stock) || 0))
      stockDelta = newStock - product.stock
      data.stock = newStock
    }

    if (Object.keys(data).length === 0) throw new HttpError('Nothing to update', 400)

    const updated = await db.$transaction(async (tx) => {
      const p = await tx.product.update({ where: { id: product.id }, data })
      if (stockDelta !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            delta: stockDelta,
            reason: 'MANUAL_ADJUST',
            refId: product.id,
            actorName: user.name,
          },
        })
      }
      return p
    })

    await logAudit(user, 'product.update', 'Product', product.id, JSON.stringify(data))
    return ok({ product: updated })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- DELETE: soft archive ----------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })
    if (!product) throw new HttpError('Product not found', 404)

    await db.product.update({ where: { id: product.id }, data: { status: 'ARCHIVED' } })
    await logAudit(user, 'product.archive', 'Product', product.id, `[Platform] ${product.title}`)
    return ok({ archived: true })
  } catch (err) {
    return handleError(err)
  }
}
