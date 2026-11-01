import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireVendorAdmin, requireVendorPermission } from '@/lib/api'

function serializeVendorProfile(v: {
  id: string
  name: string
  description: string | null
  phone: string | null
  city: string | null
  state: string | null
  gstin: string | null
  pickupAddress: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  bankIfsc: string | null
  logoText: string | null
}) {
  return {
    id: v.id,
    name: v.name,
    description: v.description,
    phone: v.phone,
    city: v.city,
    state: v.state,
    gstin: v.gstin,
    pickupAddress: v.pickupAddress,
    bankAccountName: v.bankAccountName,
    bankAccountNumber: v.bankAccountNumber,
    bankIfsc: v.bankIfsc,
    logoText: v.logoText,
  }
}

// ---------------- GET: vendor profile & payout details (owner only) ----------------
export async function GET() {
  try {
    const { vendor } = await requireVendorAdmin()
    return ok({ vendor: serializeVendorProfile(vendor) })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- PATCH: vendor profile (owner only; PENDING + ACTIVE allowed, SUSPENDED/REJECTED blocked) ----------------
export async function PATCH(req: NextRequest) {
  try {
    const { vendor } = await requireVendorPermission('owner', { allowPending: true })
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const data: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) throw new HttpError('Store name is required', 400)
      data.name = name
      data.logoText = name.slice(0, 2).toUpperCase()
    }

    const nullableFields = [
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

    for (const f of nullableFields) {
      const v = body[f]
      if (typeof v === 'string') {
        data[f] = v.trim() || null
      } else if (v === null) {
        data[f] = null
      }
    }

    const updated = await db.vendor.update({ where: { id: vendor.id }, data })
    return ok({ vendor: serializeVendorProfile(updated) })
  } catch (err) {
    return handleError(err)
  }
}
