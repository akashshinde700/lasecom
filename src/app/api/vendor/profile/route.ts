import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, requireActiveVendor, requireVendorAdmin } from '@/lib/api'

// ---------------- PATCH: vendor profile (owner only, active vendor only) ----------------
export async function PATCH(req: NextRequest) {
  try {
    const { vendor } = await requireActiveVendor(await requireVendorAdmin())
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const data: Record<string, unknown> = {}
    const strFields = [
      'name',
      'description',
      'phone',
      'city',
      'state',
      'gstin',
      'pickupAddress',
      'bankAccountName',
      'bankAccountNumber',
      'bankIfsc',
    ] as const

    for (const f of strFields) {
      const v = body[f]
      if (typeof v === 'string') {
        data[f] = v.trim() || null
      }
    }

    if (typeof data.name === 'string' && data.name) {
      data.logoText = (data.name as string).slice(0, 2).toUpperCase()
    }

    const updated = await db.vendor.update({ where: { id: vendor.id }, data })
    return ok({
      vendor: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        phone: updated.phone,
        city: updated.city,
        state: updated.state,
        gstin: updated.gstin,
        pickupAddress: updated.pickupAddress,
        bankAccountName: updated.bankAccountName,
        bankAccountNumber: updated.bankAccountNumber,
        bankIfsc: updated.bankIfsc,
        logoText: updated.logoText,
      },
    })
  } catch (err) {
    return handleError(err)
  }
}
