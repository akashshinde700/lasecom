import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, logAudit } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// ---------------- POST: block / unblock a customer ----------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const status = typeof body.status === 'string' ? body.status : ''
    if (status !== 'ACTIVE' && status !== 'BLOCKED') throw new HttpError("status must be 'ACTIVE' or 'BLOCKED'", 400)

    const target = await db.user.findUnique({ where: { id } })
    if (!target) throw new HttpError('Customer not found', 404)
    if (target.role !== 'CUSTOMER') throw new HttpError('Only customer accounts can be toggled', 400)

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status } })
      if (status === 'BLOCKED') {
        await tx.session.deleteMany({ where: { userId: id } })
      }
    })
    await logAudit(user, `customer.${status === 'BLOCKED' ? 'block' : 'unblock'}`, 'User', id, target.email)
    return ok({ id, status })
  } catch (err) {
    return handleError(err)
  }
}
