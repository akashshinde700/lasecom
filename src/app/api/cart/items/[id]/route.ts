import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireUser } from '@/lib/api'

type PatchBody = { qty?: number }

async function findOwnedItem(id: string, userId: string) {
  const item = await db.cartItem.findUnique({
    where: { id },
    include: {
      cart: { select: { userId: true } },
      product: { select: { id: true, stock: true } },
      variant: { select: { id: true, stock: true } },
    },
  })
  if (!item || item.cart.userId !== userId) return null
  return item
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requireUser()
    const body = (await req.json()) as PatchBody

    const item = await findOwnedItem(id, user.id)
    if (!item) throw new HttpError('Cart item not found', 404)

    const qty = Math.floor(Number(body.qty))
    if (!Number.isFinite(qty)) throw new HttpError('Quantity is required')

    // qty <= 0 removes the item (friendly behaviour)
    if (qty <= 0) {
      await db.cartItem.delete({ where: { id } })
      return ok({ id, removed: true })
    }

    const availableStock = item.variant ? item.variant.stock : item.product.stock
    if (availableStock < qty) {
      throw new HttpError(`Only ${availableStock} unit(s) available in stock`, 409)
    }

    await db.cartItem.update({ where: { id }, data: { qty } })
    return ok({ id, qty, removed: false })
  } catch (err) {
    return handleError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requireUser()

    const item = await findOwnedItem(id, user.id)
    if (!item) throw new HttpError('Cart item not found', 404)

    await db.cartItem.delete({ where: { id } })
    return ok({ id, removed: true })
  } catch (err) {
    return handleError(err)
  }
}
