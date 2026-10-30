import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, requireAdmin, HttpError, notify } from '@/lib/api'
import { EWASTE_STATUSES } from '@/lib/ewaste'

const STATUS_MESSAGE: Record<string, string> = {
  SCHEDULED: 'Your e-waste pickup has been scheduled',
  COLLECTED: 'Your e-waste has been collected',
  REJECTED: 'Update on your e-waste pickup request',
}

/**
 * PATCH /api/admin/ewaste/:id
 * Body: { status?, adminNote? }
 * Moves a request through NEW -> SCHEDULED -> COLLECTED -> CLOSED (or REJECTED).
 * A registered requester gets an in-app notification on status changes.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { status?: string; adminNote?: string }

    const request = await db.ewasteRequest.findUnique({ where: { id } })
    if (!request) throw new HttpError('E-waste request not found', 404)
    if (body.status && !EWASTE_STATUSES.includes(body.status)) {
      throw new HttpError('Invalid status', 400)
    }

    const updated = await db.ewasteRequest.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.adminNote !== undefined ? { adminNote: String(body.adminNote).slice(0, 1000) } : {}),
      },
    })

    if (body.status && body.status !== request.status && updated.userId && STATUS_MESSAGE[body.status]) {
      await notify(
        updated.userId,
        STATUS_MESSAGE[body.status],
        `Request ${updated.requestNumber}${updated.adminNote ? ` — ${updated.adminNote}` : ''}.`,
        'SYSTEM'
      )
    }

    return ok({ request: updated })
  } catch (err) {
    return handleError(err)
  }
}
