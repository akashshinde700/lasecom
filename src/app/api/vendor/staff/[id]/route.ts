import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireVendorAdmin, logAudit } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// ---------------- DELETE: remove vendor staff (owner only) ----------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { user, vendor } = await requireVendorAdmin()
    const { id } = await params

    const staff = await db.vendorStaff.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    })
    if (!staff || staff.vendorId !== vendor.id) throw new HttpError('Staff member not found', 404)

    await db.$transaction(async (tx) => {
      await tx.vendorStaff.delete({ where: { id: staff.id } })
      await tx.user.delete({ where: { id: staff.userId } })
    })

    await logAudit(user, 'staff.delete', 'VendorStaff', staff.id, `${staff.user.name} (${staff.user.email})`)
    return ok({ deleted: true })
  } catch (err) {
    return handleError(err)
  }
}
