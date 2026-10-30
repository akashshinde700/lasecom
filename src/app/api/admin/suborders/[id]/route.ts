import type { NextRequest } from 'next/server'
import { ok, handleError, requireAdmin } from '@/lib/api'
import { updateSubOrderStatus } from '@/lib/suborder'

type Params = { params: Promise<{ id: string }> }

// ---------------- POST: admin sub-order status update (same flow as vendor) ----------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const result = await updateSubOrderStatus(
      id,
      {
        status: typeof body.status === 'string' ? body.status : '',
        courierName: typeof body.courierName === 'string' ? body.courierName : null,
        trackingNumber: typeof body.trackingNumber === 'string' ? body.trackingNumber : null,
      },
      { actor: user }
    )

    return ok(result)
  } catch (err) {
    return handleError(err)
  }
}
