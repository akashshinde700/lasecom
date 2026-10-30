import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, requireUser, HttpError } from '@/lib/api'

export async function GET() {
  try {
    const user = await requireUser()
    const items = await db.address.findMany({
      where: { userId: user.id },
      // NOTE: Address model has no createdAt column — use cuid id (time-ordered) instead.
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    })
    return ok({ items })
  } catch (err) {
    return handleError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const { fullName, phone, line1, line2, city, state, pincode, type, isDefault } = body
    if (!fullName || !phone || !line1 || !city || !state || !pincode) {
      throw new HttpError('All address fields except line2 are required')
    }
    if (isDefault) {
      await db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } })
    }
    const count = await db.address.count({ where: { userId: user.id } })
    const address = await db.address.create({
      data: {
        userId: user.id,
        fullName: String(fullName).trim(),
        phone: String(phone).trim(),
        line1: String(line1).trim(),
        line2: line2 ? String(line2).trim() : null,
        city: String(city).trim(),
        state: String(state).trim(),
        pincode: String(pincode).trim(),
        type: type === 'WORK' ? 'WORK' : 'HOME',
        isDefault: isDefault || count === 0,
      },
    })
    return ok({ address })
  } catch (err) {
    return handleError(err)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser()
    const id = req.nextUrl.searchParams.get('id')
    if (!id) throw new HttpError('Address id required')
    const addr = await db.address.findUnique({ where: { id } })
    if (!addr || addr.userId !== user.id) throw new HttpError('Address not found', 404)
    await db.address.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (err) {
    return handleError(err)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const addr = await db.address.findUnique({ where: { id: body.id } })
    if (!addr || addr.userId !== user.id) throw new HttpError('Address not found', 404)
    if (body.isDefault) {
      await db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } })
    }
    const address = await db.address.update({
      where: { id: body.id },
      data: { isDefault: body.isDefault ?? addr.isDefault },
    })
    return ok({ address })
  } catch (err) {
    return handleError(err)
  }
}
