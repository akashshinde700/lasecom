import type { NextRequest } from 'next/server'
import { ok, handleError, HttpError, requireAdmin } from '@/lib/api'
import { resolveReturnRequest } from '@/lib/suborder'

type Params = { params: Promise<{ id: string }> }

// ---------------- POST: admin resolve return request (same refund logic as vendor) ----------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = body.action
    if (action !== 'APPROVED' && action !== 'REJECTED') {
      throw new HttpError("action must be 'APPROVED' or 'REJECTED'", 400)
    }

    const result = await resolveReturnRequest(id, action, { actor: user })
    return ok(result)
  } catch (err) {
    return handleError(err)
  }
}
