import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, logAudit } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// ---------------- DELETE: brand (only if unused) ----------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const brand = await db.brand.findUnique({ where: { id } })
    if (!brand) throw new HttpError('Brand not found', 404)

    const inUse = await db.product.count({ where: { brandId: id } })
    if (inUse > 0) throw new HttpError('Brand is in use by products and cannot be deleted', 400)

    await db.brand.delete({ where: { id } })
    await logAudit(user, 'brand.delete', 'Brand', id, brand.name)
    return ok({ deleted: true })
  } catch (err) {
    return handleError(err)
  }
}
