import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, notify } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'

type IncomingItem = {
  productId?: string
  title: string
  qty: number
  targetPrice?: number
}

function quoteNumber() {
  return 'QT-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10)
}

/**
 * POST /api/quotes — public Request-For-Quote endpoint (customer single-item
 * quotes AND B2B bulk/business inquiries).
 *
 * Body: {
 *   kind?: 'CUSTOMER' | 'B2B',
 *   name, email, phone,
 *   company?, gstin?, message?,
 *   items?: [{ productId?, title, qty, targetPrice? }]
 * }
 *
 * kind=CUSTOMER requires >=1 item; kind=B2B allows a general inquiry with
 * message only. Product lines snapshot title/condition/unitPrice from the DB
 * when productId is provided. All PLATFORM_ADMIN users get an in-app
 * notification so quotes never sit unnoticed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      kind?: string
      name?: string
      company?: string
      email?: string
      phone?: string
      gstin?: string
      message?: string
      items?: IncomingItem[]
    }

    const kind = body.kind === 'B2B' ? 'B2B' : 'CUSTOMER'
    const name = (body.name ?? '').trim().slice(0, 120)
    const email = (body.email ?? '').trim().toLowerCase().slice(0, 200)
    const phone = (body.phone ?? '').trim().slice(0, 20)
    const message = (body.message ?? '').trim()
    const rawItems = Array.isArray(body.items) ? body.items : []

    if (!name) throw new HttpError('Name is required', 400)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError('A valid email is required', 400)
    }
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      throw new HttpError('A valid 10-digit phone number is required', 400)
    }
    if (kind === 'CUSTOMER' && rawItems.length === 0) {
      throw new HttpError('Add at least one product to request a quote', 400)
    }
    if (kind === 'B2B' && rawItems.length === 0 && !message) {
      throw new HttpError('Please describe your requirement in the message', 400)
    }
    if (rawItems.length > 25) throw new HttpError('A quote request can include at most 25 products', 400)

    const user = await getSessionUser()

    // Resolve product lines + snapshots
    const productIds = rawItems.map((i) => i.productId).filter((v): v is string => !!v)
    const products = productIds.length
      ? await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, title: true, condition: true, price: true },
        })
      : []
    const productMap = new Map(products.map((p) => [p.id, p]))

    const itemData = rawItems
      .filter((i) => (i.productId ?? '').trim().length > 0 || (i.title ?? '').trim().length > 0)
      .slice(0, 25)
      .map((i) => {
        const p = i.productId ? productMap.get(i.productId) : undefined
        const qty = Math.max(1, Math.min(100000, Math.floor(Number(i.qty) || 1)))
        return {
          productId: p?.id ?? null,
          titleSnapshot: (p?.title ?? ((i.title ?? '').trim() || 'Custom item')).slice(0, 200),
          condition: p?.condition ?? 'NEW',
          qty,
          unitPrice: p?.price ?? 0,
          targetPrice:
            i.targetPrice !== undefined && i.targetPrice !== null && Number(i.targetPrice) > 0
              ? Math.min(10000000, Number(i.targetPrice))
              : null,
        }
      })

    const quote = await db.quoteRequest.create({
      data: {
        quoteNumber: quoteNumber(),
        kind,
        userId: user?.id ?? null,
        name,
        company: (body.company ?? '').trim().slice(0, 160),
        email,
        phone,
        gstin: (body.gstin ?? '').trim().toUpperCase().slice(0, 20),
        message: message.slice(0, 2000),
        status: 'OPEN',
        items: itemData.length ? { create: itemData } : undefined,
      },
      include: { items: true },
    })

    // Notify every platform admin so the request is picked up quickly
    const admins = await db.user.findMany({
      where: { role: { in: ['PLATFORM_ADMIN', 'PLATFORM_STAFF'] }, status: 'ACTIVE' },
      select: { id: true },
    })
    for (const admin of admins) {
      await notify(
        admin.id,
        kind === 'B2B' ? 'New B2B inquiry' : 'New quote request',
        `${name}${body.company ? ` (${body.company})` : ''} requested a quote — ${quote.quoteNumber}${itemData.length ? ` · ${itemData.length} item(s)` : ' · General inquiry'}.`,
        'SYSTEM'
      )
    }

    return ok({
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      itemCount: quote.items.length,
    })
  } catch (err) {
    return handleError(err)
  }
}
