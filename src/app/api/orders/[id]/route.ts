import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'
import { parseJson } from '@/lib/format'

/**
 * GET /api/orders/:id — owner (session) or guest with ?email= matching guestEmail.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getSessionUser()
    const emailParam = req.nextUrl.searchParams.get('email')?.trim() ?? ''

    const order = await db.order.findUnique({
      where: { id },
      include: {
        subOrders: {
          orderBy: { createdAt: 'asc' },
          include: {
            vendor: { select: { name: true, slug: true } },
            items: { include: { product: { select: { slug: true } } } },
            events: { orderBy: { createdAt: 'asc' } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: { method: true, amount: true, status: true, createdAt: true },
        },
      },
    })
    if (!order) throw new HttpError('Order not found', 404)

    const isOwner = !!user && order.userId === user.id
    const isGuestMatch =
      !order.userId && !!emailParam && !!order.guestEmail && emailParam.toLowerCase() === order.guestEmail.toLowerCase()
    if (!isOwner && !isGuestMatch) {
      throw new HttpError('You are not authorized to view this order', 403)
    }

    return ok({
      order: {
        ...order,
        shippingAddress: parseJson<Record<string, string> | null>(order.shippingAddress, null),
      },
    })
  } catch (err) {
    return handleError(err)
  }
}
