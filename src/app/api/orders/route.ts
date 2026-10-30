import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { ok, fail, handleError, HttpError, requireUser, round2 } from '@/lib/api'
import { parseJson } from '@/lib/format'

// ---------------------------------------------------------------------------
// Shared types & helpers
// ---------------------------------------------------------------------------

type OrderInputItem = { productId: string; variantId: string | null; qty: number }

type AddressInput = {
  fullName?: string
  phone?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  pincode?: string
}

type CheckoutBody = {
  idempotencyKey?: string
  items?: { productId?: string; variantId?: string | null; qty?: number }[]
  shippingAddress?: AddressInput
  billingAddress?: AddressInput
  paymentMethod?: string
  couponCode?: string
  guest?: { name?: string; email?: string; phone?: string }
}

const orderProductInclude = {
  category: { select: { commissionPercent: true } },
  vendor: {
    select: { commissionPercent: true, plan: { select: { commissionDiscountPercent: true } } },
  },
} satisfies Prisma.ProductInclude

type ProductForOrder = Prisma.ProductGetPayload<{ include: typeof orderProductInclude }>

type LineData = {
  product: ProductForOrder
  variant: { id: string; name: string } | null
  unitPrice: number
  qty: number
  lineTotal: number
}

/**
 * Commission resolution order:
 * product.commissionPercent ?? category.commissionPercent ?? vendor.commissionPercent
 * ?? Setting 'platform.commissionPercent' (default 10), then subtract the vendor
 * plan's commissionDiscountPercent (never below 0).
 */
function resolveCommissionRate(product: ProductForOrder, platformRate: number): number {
  if (product.vendorId == null) return 0
  let rate = platformRate
  if (product.vendor?.commissionPercent != null) rate = product.vendor.commissionPercent
  if (product.category?.commissionPercent != null) rate = product.category.commissionPercent
  if (product.commissionPercent != null) rate = product.commissionPercent
  const discount = product.vendor?.plan?.commissionDiscountPercent ?? 0
  return Math.max(0, rate - discount)
}

type CouponLike = { type: string; value: number; maxDiscount: number | null }

function couponDiscountFor(coupon: CouponLike, itemsTotal: number): number {
  let discount =
    coupon.type === 'PERCENT' ? round2((itemsTotal * coupon.value) / 100) : round2(coupon.value)
  if (coupon.type === 'PERCENT' && coupon.maxDiscount != null) {
    discount = Math.min(discount, coupon.maxDiscount)
  }
  return round2(Math.min(discount, itemsTotal))
}

/** Case-insensitive coupon lookup (SQLite `equals` is case-sensitive). */
async function findCouponTx(
  tx: Prisma.TransactionClient,
  code: string
): Promise<{ id: string; code: string; type: string; value: number; maxDiscount: number | null; minOrder: number; expiresAt: Date | null; usageLimit: number | null; usedCount: number; active: boolean } | null> {
  const candidates = await tx.coupon.findMany({ where: { code: { contains: code } }, take: 25 })
  return candidates.find((c) => c.code.toUpperCase() === code) ?? null
}

/** Fetch product + variant, validate ACTIVE status, atomically decrement stock. */
async function buildLine(tx: Prisma.TransactionClient, item: OrderInputItem): Promise<LineData> {
  const product = await tx.product.findUnique({
    where: { id: item.productId },
    include: orderProductInclude,
  })
  if (!product || product.status !== 'ACTIVE') {
    throw new HttpError('Some items in your cart are out of stock', 409)
  }

  let variant: { id: string; name: string; price: number | null } | null = null
  if (item.variantId) {
    const v = await tx.productVariant.findFirst({
      where: { id: item.variantId, productId: product.id },
      select: { id: true, name: true, price: true },
    })
    if (!v) throw new HttpError('Some items in your cart are out of stock', 409)
    variant = v
  }

  const unitPrice = variant?.price ?? product.price

  const productStock = await tx.product.updateMany({
    where: { id: product.id, stock: { gte: item.qty } },
    data: { stock: { decrement: item.qty } },
  })
  if (productStock.count === 0) throw new HttpError('Insufficient stock', 409)

  if (variant) {
    const variantStock = await tx.productVariant.updateMany({
      where: { id: variant.id, stock: { gte: item.qty } },
      data: { stock: { decrement: item.qty } },
    })
    if (variantStock.count === 0) throw new HttpError('Insufficient stock', 409)
  }

  return {
    product,
    variant: variant ? { id: variant.id, name: variant.name } : null,
    unitPrice,
    qty: item.qty,
    lineTotal: round2(unitPrice * item.qty),
  }
}

// ---------------------------------------------------------------------------
// POST /api/orders — checkout (guest or logged-in)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as CheckoutBody
    const user = await getSessionUser()

    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
    if (!idempotencyKey) return fail('idempotencyKey is required', 400)

    const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod : ''
    if (!['RAZORPAY', 'UPI', 'CARD', 'NETBANKING', 'COD'].includes(paymentMethod)) {
      return fail('Invalid payment method', 400)
    }

    const addr = body.shippingAddress
    if (
      !addr ||
      !addr.fullName?.trim() ||
      !addr.phone?.trim() ||
      !addr.line1?.trim() ||
      !addr.city?.trim() ||
      !addr.state?.trim() ||
      !addr.pincode?.trim()
    ) {
      return fail('Complete shipping address is required', 400)
    }

    let inputItems: OrderInputItem[] = []
    let usedBodyItems = false
    if (Array.isArray(body.items) && body.items.length > 0) {
      usedBodyItems = true
      for (const it of body.items) {
        const qty = Math.floor(Number(it.qty))
        if (!it.productId || !Number.isFinite(qty) || qty < 1) {
          return fail('Invalid order items', 400)
        }
        inputItems.push({ productId: it.productId, variantId: it.variantId ?? null, qty })
      }
    } else if (!user) {
      return fail('Items are required for guest checkout', 400)
    }

    if (!user) {
      const g = body.guest
      if (!g?.name?.trim() || !g?.email?.trim() || !g?.phone?.trim()) {
        return fail('Guest name, email and phone are required', 400)
      }
    }

    const cartUserId = usedBodyItems ? null : (user?.id ?? null)

    const result = await db.$transaction(async (tx) => {
      // 0. Idempotency — if this key was already processed, return the existing
      //    order untouched (no stock decrement, no duplicate rows).
      const existing = await tx.order.findUnique({ where: { idempotencyKey } })
      if (existing) {
        const payment = await tx.payment.findFirst({
          where: { orderId: existing.id },
          orderBy: { createdAt: 'desc' },
        })
        return {
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          grandTotal: existing.grandTotal,
          paymentRequired: existing.paymentMethod !== 'COD',
          paymentId: payment?.id ?? null,
        }
      }

      // 1. Build the item list (body items or the user's server cart).
      let couponCodeInput =
        typeof body.couponCode === 'string' && body.couponCode.trim()
          ? body.couponCode.trim().toUpperCase()
          : null

      let lines: LineData[] = []
      let serverCartId: string | null = null

      if (usedBodyItems) {
        for (const item of inputItems) {
          lines.push(await buildLine(tx, item))
        }
      } else {
        if (!cartUserId) throw new HttpError('Please login to use your cart', 401)
        const cart = await tx.cart.findUnique({
          where: { userId: cartUserId },
          include: { items: true },
        })
        if (!cart || cart.items.length === 0) throw new HttpError('Your cart is empty', 400)
        serverCartId = cart.id
        if (!couponCodeInput) couponCodeInput = cart.couponCode
        for (const item of cart.items) {
          lines.push(
            await buildLine(tx, { productId: item.productId, variantId: item.variantId, qty: item.qty })
          )
        }
      }

      const itemsTotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0))
      if (lines.length === 0 || itemsTotal <= 0) throw new HttpError('No items to order', 400)

      // 2. Coupon validation + discount.
      let couponDiscount = 0
      let appliedCouponId: string | null = null
      if (couponCodeInput) {
        const coupon = await findCouponTx(tx, couponCodeInput)
        if (!coupon || !coupon.active) throw new HttpError('Invalid coupon code', 400)
        if (coupon.expiresAt && coupon.expiresAt < new Date()) {
          throw new HttpError('This coupon has expired', 400)
        }
        if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
          throw new HttpError('This coupon has reached its usage limit', 400)
        }
        if (itemsTotal < coupon.minOrder) {
          throw new HttpError(`This coupon requires a minimum order of ₹${coupon.minOrder}`, 400)
        }
        couponDiscount = couponDiscountFor(coupon, itemsTotal)
        appliedCouponId = coupon.id
      }

      // 3. Settings: shipping + platform commission.
      const settingRows = await tx.setting.findMany({
        where: { key: { in: ['shipping.freeThreshold', 'shipping.baseFee', 'shipping.codFee', 'platform.commissionPercent'] } },
      })
      const settingsMap: Record<string, string> = {}
      for (const r of settingRows) settingsMap[r.key] = r.value
      const ft = parseFloat(settingsMap['shipping.freeThreshold'] ?? '499')
      const freeThreshold = isNaN(ft) ? 499 : ft
      const bf = parseFloat(settingsMap['shipping.baseFee'] ?? '49')
      const baseFee = isNaN(bf) ? 49 : bf
      const cf = parseFloat(settingsMap['shipping.codFee'] ?? '25')
      const codFee = isNaN(cf) ? 25 : cf
      const pc = parseFloat(settingsMap['platform.commissionPercent'] ?? '10')
      const platformRate = isNaN(pc) ? 10 : pc

      // 4. Shipping per vendor group.
      const groupMap = new Map<string, { vendorId: string | null; lines: LineData[]; subtotal: number }>()
      for (const l of lines) {
        const key = l.product.vendorId ?? '__platform__'
        const g = groupMap.get(key) ?? { vendorId: l.product.vendorId ?? null, lines: [], subtotal: 0 }
        g.lines.push(l)
        g.subtotal = round2(g.subtotal + l.lineTotal)
        groupMap.set(key, g)
      }
      const groups = [...groupMap.values()].map((g) => {
        const anyFreeShipping = g.lines.some((l) => l.product.freeShipping)
        const shippingFee = anyFreeShipping || g.subtotal >= freeThreshold ? 0 : baseFee
        return { ...g, shippingFee }
      })
      const shippingTotal = round2(groups.reduce((s, g) => s + g.shippingFee, 0))
      // COD handling fee is part of the confirmed total (CheckoutView shows the
      // same line) — must be added server-side or COD orders are created short.
      const grandTotal = round2(
        itemsTotal - couponDiscount + shippingTotal + (paymentMethod === 'COD' ? codFee : 0)
      )

      // 5. Order number: 'SK-' + 6 digits from Date.now() (collision-safe).
      let orderNumber = ''
      for (let attempt = 0; attempt < 5 && !orderNumber; attempt++) {
        const candidate =
          attempt === 0
            ? 'SK-' + String(Date.now()).slice(-6)
            : 'SK-' + String(100000 + Math.floor(Math.random() * 900000))
        if (!(await tx.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } }))) {
          orderNumber = candidate
        }
      }
      if (!orderNumber) throw new HttpError('Could not allocate an order number, please retry', 500)

      const isCOD = paymentMethod === 'COD'

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: user?.id ?? null,
          guestName: user ? null : (body.guest?.name?.trim() ?? null),
          guestEmail: user ? null : (body.guest?.email?.trim() ?? null),
          guestPhone: user ? null : (body.guest?.phone?.trim() ?? null),
          status: isCOD ? 'CONFIRMED' : 'PENDING_PAYMENT',
          paymentStatus: isCOD ? 'COD_PENDING' : 'PENDING',
          paymentMethod,
          itemsTotal,
          discountTotal: couponDiscount,
          shippingTotal,
          grandTotal,
          couponCode: couponCodeInput,
          couponDiscount,
          shippingAddress: JSON.stringify({
            fullName: addr.fullName?.trim(),
            phone: addr.phone?.trim(),
            line1: addr.line1?.trim(),
            line2: addr.line2?.trim() ?? null,
            city: addr.city?.trim(),
            state: addr.state?.trim(),
            pincode: addr.pincode?.trim(),
          }),
          idempotencyKey,
        },
      })

      // 6. SubOrders per vendor group + OrderItems with full snapshots.
      for (const g of groups) {
        const computed = g.lines.map((l) => {
          const discountShare = couponDiscount > 0 ? round2((couponDiscount * l.lineTotal) / itemsTotal) : 0
          const effectiveTotal = round2(l.lineTotal - discountShare)
          const isPlatform = l.product.vendorId == null
          const rate = resolveCommissionRate(l.product, platformRate)
          const commissionAmount = isPlatform ? 0 : round2((effectiveTotal * rate) / 100)
          const vendorEarning = isPlatform ? 0 : round2(effectiveTotal - commissionAmount)
          return { line: l, discountShare, effectiveTotal, rate, commissionAmount, vendorEarning }
        })
        const commissionTotal = round2(computed.reduce((s, c) => s + c.commissionAmount, 0))
        const vendorEarningTotal = round2(computed.reduce((s, c) => s + c.vendorEarning, 0))

        const sub = await tx.subOrder.create({
          data: {
            orderId: order.id,
            vendorId: g.vendorId,
            status: 'CONFIRMED',
            itemsTotal: g.subtotal,
            shippingFee: g.shippingFee,
            commissionTotal,
            vendorEarning: vendorEarningTotal,
          },
        })

        for (const c of computed) {
          const images = parseJson<string[]>(c.line.product.images, [])
          await tx.orderItem.create({
            data: {
              subOrderId: sub.id,
              productId: c.line.product.id,
              variantId: c.line.variant?.id ?? null,
              titleSnapshot: c.line.product.title,
              variantName: c.line.variant?.name ?? null,
              imageSnapshot: images[0] ?? null,
              unitPrice: c.line.unitPrice,
              qty: c.line.qty,
              lineTotal: c.line.lineTotal,
              discountShare: c.discountShare,
              effectiveTotal: c.effectiveTotal,
              commissionRate: c.rate,
              commissionAmount: c.commissionAmount,
              vendorEarning: c.vendorEarning,
              costSnapshot: c.line.product.cost ?? null,
              isPlatformOwned: c.line.product.vendorId == null,
              status: 'ACTIVE',
            },
          })
          await tx.stockMovement.create({
            data: {
              productId: c.line.product.id,
              variantId: c.line.variant?.id ?? null,
              delta: -c.line.qty,
              reason: 'ORDER',
              refId: orderNumber,
            },
          })
        }

        if (isCOD) {
          await tx.shipmentEvent.create({
            data: { subOrderId: sub.id, status: 'CONFIRMED', note: 'Order confirmed. Preparing for dispatch.' },
          })
        }
      }

      // 7. Payment row.
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          method: paymentMethod,
          amount: grandTotal,
          status: isCOD ? 'COD_PENDING' : 'PENDING',
        },
      })

      // 8. Coupon usage.
      if (appliedCouponId) {
        await tx.coupon.update({ where: { id: appliedCouponId }, data: { usedCount: { increment: 1 } } })
      }

      // 9. The consumed server cart is cleared.
      if (serverCartId) {
        await tx.cartItem.deleteMany({ where: { cartId: serverCartId } })
        await tx.cart.update({ where: { id: serverCartId }, data: { couponCode: null } })
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        grandTotal,
        paymentRequired: !isCOD,
        paymentId: payment.id,
      }
    })

    return ok(result)
  } catch (err) {
    return handleError(err)
  }
}

// ---------------------------------------------------------------------------
// GET /api/orders — customer's own order list (paginated)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const sp = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') || '1') || 1)
    const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit') || '10') || 10))
    const skip = (page - 1) * limit

    const where: Prisma.OrderWhereInput = { userId: user.id }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          grandTotal: true,
          createdAt: true,
          subOrders: {
            select: {
              items: {
                select: {
                  id: true,
                  titleSnapshot: true,
                  imageSnapshot: true,
                  qty: true,
                  unitPrice: true,
                },
              },
            },
          },
        },
      }),
      db.order.count({ where }),
    ])

    const items = orders.map((o) => {
      const allItems = o.subOrders.flatMap((s) => s.items)
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        grandTotal: o.grandTotal,
        createdAt: o.createdAt,
        itemCount: allItems.reduce((s, i) => s + i.qty, 0),
        items: allItems.slice(0, 3),
        vendorCount: o.subOrders.length,
      }
    })

    return ok({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (err) {
    return handleError(err)
  }
}
