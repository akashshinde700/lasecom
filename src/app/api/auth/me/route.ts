import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'

/**
 * GET /api/auth/me — session hydration endpoint used by useAppStore.refreshMe().
 * Mirrors GET /api/auth (same response shape: { ok: true, data: { user } }).
 * The storefront previously 404'd here, leaving `user` null on every page load.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session) return ok({ user: null })
    let vendor: { id: string; name: string; status: string; slug: string } | null = null
    if (session.role === 'VENDOR_ADMIN') {
      const v = await db.vendor.findUnique({
        where: { ownerId: session.id },
        select: { id: true, name: true, status: true, slug: true },
      })
      vendor = v
    } else if (session.role === 'VENDOR_STAFF') {
      const staff = await db.vendorStaff.findUnique({
        where: { userId: session.id },
        select: { vendor: { select: { id: true, name: true, status: true, slug: true } } },
      })
      vendor = staff?.vendor ?? null
    }
    return ok({ user: { ...session, vendor } })
  } catch (err) {
    return handleError(err)
  }
}
