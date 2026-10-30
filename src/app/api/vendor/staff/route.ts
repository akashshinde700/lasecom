import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireVendor, requireVendorAdmin, logAudit } from '@/lib/api'
import { hashPassword } from '@/lib/auth'

const STAFF_ROLES = ['PRODUCT_MANAGER', 'ORDER_MANAGER', 'INVENTORY_MANAGER', 'ACCOUNTANT']

// ---------------- GET: vendor staff list ----------------
export async function GET() {
  try {
    const { vendor } = await requireVendor()
    const rows = await db.vendorStaff.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    })
    return ok({
      items: rows.map((s) => ({
        id: s.id,
        name: s.user.name,
        email: s.user.email,
        staffRole: s.staffRole,
        createdAt: s.createdAt,
      })),
    })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- POST: create VENDOR_STAFF (owner only) ----------------
export async function POST(req: NextRequest) {
  try {
    const { user, vendor } = await requireVendorAdmin()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const staffRole = typeof body.staffRole === 'string' && STAFF_ROLES.includes(body.staffRole) ? body.staffRole : 'ORDER_MANAGER'

    if (!name || !email || !password) throw new HttpError('Name, email and password are required', 400)
    if (password.length < 6) throw new HttpError('Password must be at least 6 characters', 400)

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) throw new HttpError('An account with this email already exists', 400)

    const created = await db.$transaction(async (tx) => {
      const staff = await tx.user.create({
        data: { name, email, passwordHash: hashPassword(password), role: 'VENDOR_STAFF' },
      })
      return tx.vendorStaff.create({
        data: { userId: staff.id, vendorId: vendor.id, staffRole },
        include: { user: { select: { name: true, email: true } } },
      })
    })

    await logAudit(user, 'staff.create', 'VendorStaff', created.id, `${name} (${email}) — ${staffRole}`)
    return ok({ id: created.id, name: created.user.name, email: created.user.email, staffRole: created.staffRole }, 201)
  } catch (err) {
    return handleError(err)
  }
}
