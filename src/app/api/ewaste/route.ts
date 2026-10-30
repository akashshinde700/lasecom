import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, notify } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'
import { EWASTE_CATEGORY_KEYS } from '@/lib/ewaste'

function requestNumber() {
  return 'EW-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10)
}

/**
 * POST /api/ewaste — public e-waste pickup request from companies.
 *
 * Body: {
 *   company, contactName, email, phone, gstin?,
 *   address, city, state?, pincode,
 *   categories: string[], quantity?, unit?: 'KG' | 'UNITS',
 *   pickupDate?: 'YYYY-MM-DD', needCertificate?, message?
 * }
 *
 * All PLATFORM_ADMIN / PLATFORM_STAFF users get an in-app notification.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const str = (k: string, max: number) => String(body[k] ?? '').trim().slice(0, max)

    const company = str('company', 160)
    const contactName = str('contactName', 120)
    const email = str('email', 200).toLowerCase()
    const phone = str('phone', 20)
    const address = str('address', 500)
    const city = str('city', 80)
    const pincode = str('pincode', 10)
    const pickupDate = str('pickupDate', 10)
    const categories = (Array.isArray(body.categories) ? body.categories : [])
      .map(String)
      .filter((c) => EWASTE_CATEGORY_KEYS.includes(c))
    const quantity = Math.max(0, Math.min(10000000, Number(body.quantity) || 0))

    if (!company) throw new HttpError('Company name is required', 400)
    if (!contactName) throw new HttpError('Contact person name is required', 400)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError('A valid email is required', 400)
    }
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      throw new HttpError('A valid 10-digit phone number is required', 400)
    }
    if (!address || !city) throw new HttpError('Pickup address and city are required', 400)
    if (!/^\d{6}$/.test(pincode)) throw new HttpError('A valid 6-digit pincode is required', 400)
    if (categories.length === 0) throw new HttpError('Select at least one e-waste category', 400)
    if (pickupDate && !/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) {
      throw new HttpError('Invalid pickup date', 400)
    }

    const user = await getSessionUser()

    const request = await db.ewasteRequest.create({
      data: {
        requestNumber: requestNumber(),
        userId: user?.id ?? null,
        company,
        contactName,
        email,
        phone,
        gstin: str('gstin', 20).toUpperCase(),
        address,
        city,
        state: str('state', 80),
        pincode,
        categories: JSON.stringify([...new Set(categories)]),
        quantity,
        unit: body.unit === 'UNITS' ? 'UNITS' : 'KG',
        pickupDate,
        needCertificate: body.needCertificate === true,
        message: str('message', 2000),
      },
    })

    // Notify every platform admin so the request is picked up quickly
    const admins = await db.user.findMany({
      where: { role: { in: ['PLATFORM_ADMIN', 'PLATFORM_STAFF'] }, status: 'ACTIVE' },
      select: { id: true },
    })
    for (const admin of admins) {
      await notify(
        admin.id,
        'New e-waste pickup request',
        `${company} (${city}) requested an e-waste pickup — ${request.requestNumber}${quantity ? ` · ~${quantity} ${request.unit === 'KG' ? 'kg' : 'units'}` : ''}.`,
        'SYSTEM'
      )
    }

    return ok({ id: request.id, requestNumber: request.requestNumber, status: request.status })
  } catch (err) {
    return handleError(err)
  }
}
