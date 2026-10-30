import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requirePlatformAdmin, logAudit, notify } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

const VENDOR_STATUSES = ['ACTIVE', 'SUSPENDED', 'REJECTED', 'PENDING']

/**
 * Contract endpoint: POST /api/admin/vendors/:id/status {status, reason?}
 * (Same logic as POST /api/admin/vendors/:id)
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requirePlatformAdmin()
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const status = typeof body.status === 'string' ? body.status : ''
    if (!VENDOR_STATUSES.includes(status)) {
      throw new HttpError('Invalid status', 400)
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

    const vendor = await db.vendor.findUnique({ where: { id }, select: { id: true, name: true, ownerId: true, status: true } })
    if (!vendor) throw new HttpError('Vendor not found', 404)

    const data: Record<string, unknown> = { status }
    if (status === 'REJECTED' || status === 'SUSPENDED') data.rejectionReason = reason || null
    if (status === 'ACTIVE') data.rejectionReason = null

    await db.vendor.update({ where: { id }, data })

    const statusText =
      status === 'ACTIVE'
        ? 'approved and is now live on the marketplace'
        : status === 'SUSPENDED'
          ? 'been suspended'
          : status === 'REJECTED'
            ? 'been rejected'
            : 'been moved to review'
    await notify(
      vendor.ownerId,
      `Vendor account ${status}`,
      `Your store "${vendor.name}" has ${statusText}.${reason ? ` Reason: ${reason}` : ''}`,
      'VENDOR'
    )

    await logAudit(user, 'vendor.status', 'Vendor', id, `${vendor.status} → ${status}${reason ? ` (${reason})` : ''}`)
    return ok({ id, status })
  } catch (err) {
    return handleError(err)
  }
}
