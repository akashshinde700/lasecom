import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireVendor, logAudit } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

const ALLOWED_REASONS = ['ORDER', 'CANCEL_RESTOCK', 'MANUAL_ADJUST', 'RETURN_RESTOCK', 'SEED']

// ---------------- POST: stock adjustment (clamped >= 0) ----------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { user, vendor } = await requireVendor()
    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })
    if (!product || product.vendorId !== vendor.id) throw new HttpError('Product not found', 404)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const delta = Math.trunc(Number(body.delta))
    if (!Number.isFinite(delta) || delta === 0) throw new HttpError('A non-zero integer delta is required', 400)
    const reasonRaw = typeof body.reason === 'string' ? body.reason.trim() : ''
    const movementReason = ALLOWED_REASONS.includes(reasonRaw) ? reasonRaw : 'MANUAL_ADJUST'

    const newStock = Math.max(0, product.stock + delta)
    const applied = newStock - product.stock

    const updated = await db.$transaction(async (tx) => {
      const p = await tx.product.update({ where: { id: product.id }, data: { stock: newStock } })
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          delta: applied,
          reason: movementReason,
          refId: reasonRaw && !ALLOWED_REASONS.includes(reasonRaw) ? reasonRaw : product.id,
          actorName: user.name,
        },
      })
      return p
    })

    await logAudit(user, 'product.stock', 'Product', product.id, `${applied >= 0 ? '+' : ''}${applied} → ${newStock} (${reasonRaw || 'manual'})`)
    return ok({ id: updated.id, stock: updated.stock, applied })
  } catch (err) {
    return handleError(err)
  }
}
