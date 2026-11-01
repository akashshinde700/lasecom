import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireUser } from '@/lib/api'

type AddItemBody = { productId?: string; variantId?: string | null; qty?: number }

async function getOrCreateCartId(userId: string): Promise<string> {
  const existing = await db.cart.findUnique({ where: { userId }, select: { id: true } })
  if (existing) return existing.id
  const created = await db.cart.create({ data: { userId }, select: { id: true } })
  return created.id
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = (await req.json()) as AddItemBody

    const productId = body.productId ?? ''
    const variantId = body.variantId ?? null
    const qty = Math.floor(Number(body.qty ?? 1))
    if (!productId) throw new HttpError('productId is required')
    if (!Number.isFinite(qty) || qty < 1) throw new HttpError('Quantity must be at least 1')

    const product = await db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        status: true,
        stock: true,
        vendorId: true,
        vendor: { select: { status: true } },
        _count: { select: { variants: true } },
      },
    })
    if (
      !product ||
      product.status !== 'ACTIVE' ||
      (product.vendorId != null && product.vendor?.status !== 'ACTIVE')
    ) {
      throw new HttpError('This product is not available', 404)
    }

    if (product._count.variants > 0 && !variantId) {
      throw new HttpError('Please select a variant option on the product page', 400)
    }

    let availableStock = product.stock
    if (variantId) {
      const variant = await db.productVariant.findFirst({
        where: { id: variantId, productId },
        select: { id: true, stock: true },
      })
      if (!variant) throw new HttpError('Invalid product variant')
      availableStock = Math.min(product.stock, variant.stock)
    }

    const cartId = await getOrCreateCartId(user.id)
    const existingItem = await db.cartItem.findFirst({
      where: { cartId, productId, variantId: variantId ?? null },
      select: { id: true, qty: true },
    })

    if (existingItem) {
      const totalQty = existingItem.qty + qty
      if (availableStock < totalQty) {
        throw new HttpError(`Only ${availableStock} unit(s) available in stock`, 409)
      }
      await db.cartItem.update({ where: { id: existingItem.id }, data: { qty: totalQty } })
    } else {
      if (availableStock < qty) {
        throw new HttpError(`Only ${availableStock} unit(s) available in stock`, 409)
      }
      await db.cartItem.create({ data: { cartId, productId, variantId, qty } })
    }

    const itemCount = await db.cartItem.count({ where: { cartId } })
    return ok({ itemCount })
  } catch (err) {
    return handleError(err)
  }
}
