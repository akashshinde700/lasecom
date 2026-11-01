import type { NextRequest } from 'next/server'
import { ok, handleError, HttpError, requireVendorPermission } from '@/lib/api'
import { resolveReturnRequest } from '@/lib/suborder'

type Params = { params: Promise<{ id: string }> }

// ------- POST: approve / reject a return request (vendor-isolated, active vendor, owner or ORDER_MANAGER) -------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { user, vendor } = await requireVendorPermission('returns')
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = body.action
    if (action !== 'APPROVED' && action !== 'REJECTED') {
      throw new HttpError("action must be 'APPROVED' or 'REJECTED'", 400)
    }

    const result = await resolveReturnRequest(id, action, { vendorId: vendor.id, actor: user })
    return ok(result)
  } catch (err) {
    return handleError(err)
  }
}
