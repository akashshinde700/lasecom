import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireVendorPermission, logAudit } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

// ---------------- DELETE: remove vendor staff (owner only) ----------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { user, vendor } = await requireVendorPermission('owner', { allowPending: true })
    const { id } = await params

    const staff = await db.vendorStaff.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    })
    if (!staff || staff.vendorId !== vendor.id) throw new HttpError('Staff member not found', 404)

    await db.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: staff.userId } })
      await tx.vendorStaff.delete({ where: { id: staff.id } })
      const [orderCount, reviewCount] = await Promise.all([
        tx.order.count({ where: { userId: staff.userId } }),
        tx.review.count({ where: { userId: staff.userId } }),
      ])
      if (orderCount > 0 || reviewCount > 0) {
        await tx.user.update({ where: { id: staff.userId }, data: { role: 'CUSTOMER' } })
      } else {
        await tx.user.delete({ where: { id: staff.userId } })
      }
    })

    await logAudit(user, 'staff.delete', 'VendorStaff', staff.id, `${staff.user.name} (${staff.user.email})`)
    return ok({ deleted: true })
  } catch (err) {
    return handleError(err)
  }
}
