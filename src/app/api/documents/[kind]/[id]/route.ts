import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireUser, requireVendor, canAccessOrder, round2 } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'
import type { DocBank, DocData, DocLine, DocParty, DocRequestKind } from '@/lib/documents'

/**
 * GET /api/documents/:kind/:id — data for a printable business document.
 *
 *   invoice | proforma | purchase-return   :id = order id     (order owner or admin)
 *   quotation | quote-proforma | customer-po :id = quote id    (quote owner or admin)
 *   vendor-po | vendor-return               :id = sub-order id (that vendor or admin)
 *
 * Seller / bank details come from the admin "Business & invoice" settings.
 * The client renders the returned DocData with renderDocumentHtml().
 */

const RETURNED_ITEM_STATUSES = ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURNED', 'REFUNDED']

type Business = {
  party: DocParty
  brand: string
  bank: DocBank
  gstRate: number
  terms: string[]
}

async function loadBusiness(): Promise<Business> {
  const rows = await db.setting.findMany({
    where: { OR: [{ key: { startsWith: 'business.' } }, { key: { startsWith: 'bank.' } }, { key: { startsWith: 'invoice.' } }, { key: 'site.name' }] },
  })
  const s: Record<string, string> = {}
  for (const r of rows) s[r.key] = r.value.trim()
  const brand = s['site.name'] || 'Lastrivon Kart India'
  const rate = Number(s['invoice.gstRate'])
  return {
    brand,
    party: {
      name: s['business.legalName'] || brand,
      lines: [
        s['business.address'],
        [s['business.city'], s['business.pincode']].filter(Boolean).join(' — '),
        s['business.pan'] ? `PAN: ${s['business.pan']}` : '',
      ].filter(Boolean),
      state: s['business.state'] || undefined,
      gstin: s['business.gstin'] || undefined,
      phone: s['business.phone'] || undefined,
      email: s['business.email'] || undefined,
    },
    bank: {
      accountName: s['bank.accountName'] ?? '',
      bankName: s['bank.bankName'] ?? '',
      accountNumber: s['bank.accountNumber'] ?? '',
      ifsc: s['bank.ifsc'] ?? '',
      branch: s['bank.branch'] ?? '',
    },
    gstRate: Number.isFinite(rate) && rate >= 0 && rate <= 40 ? rate : 18,
    terms: (s['invoice.terms'] ?? '').split('\n').map((t) => t.trim()).filter(Boolean),
  }
}

/** GSTIN starts with the 2-digit state code; fall back to comparing state names. */
function isInterState(a?: { state?: string; gstin?: string }, b?: { state?: string; gstin?: string }) {
  const code = (g?: string) => (g && /^\d{2}/.test(g) ? g.slice(0, 2) : '')
  if (code(a?.gstin) && code(b?.gstin)) return code(a?.gstin) !== code(b?.gstin)
  const norm = (x?: string) => (x ?? '').trim().toLowerCase()
  if (norm(a?.state) && norm(b?.state)) return norm(a?.state) !== norm(b?.state)
  return false
}

const isAdmin = (role: string) => role === 'PLATFORM_ADMIN' || role === 'PLATFORM_STAFF'

/* ---------------------------------------------------------------- orders */

async function orderDoc(kind: 'invoice' | 'proforma' | 'purchase-return', id: string): Promise<DocData> {
  const user = await getSessionUser()
  const order = await db.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      subOrders: { include: { items: true } },
    },
  })
  if (!order) throw new HttpError('Order not found', 404)
  if (!(await canAccessOrder(order, user))) throw new HttpError('Order not found', 404)

  const biz = await loadBusiness()
  let addr: Record<string, string | null | undefined> = {}
  try { addr = JSON.parse(order.shippingAddress) ?? {} } catch { /* keep empty */ }

  const customer: DocParty = {
    name: String(addr.fullName || order.user?.name || order.guestName || 'Customer'),
    lines: [
      [addr.line1, addr.line2].filter(Boolean).join(', '),
      [addr.city, addr.pincode].filter(Boolean).join(' — '),
    ].filter(Boolean) as string[],
    state: addr.state ? String(addr.state) : undefined,
    phone: String(addr.phone || order.user?.phone || order.guestPhone || '') || undefined,
    email: order.user?.email || order.guestEmail || undefined,
  }

  const allItems = order.subOrders.flatMap((s) => s.items)
  const toLine = (i: (typeof allItems)[number]): DocLine => ({
    description: i.titleSnapshot,
    detail: i.variantName ?? undefined,
    qty: i.qty,
    rate: i.unitPrice,
  })

  if (kind === 'purchase-return') {
    const returned = allItems.filter((i) => RETURNED_ITEM_STATUSES.includes(i.status))
    if (returned.length === 0) throw new HttpError('No returned items on this order', 400)
    return {
      kind: 'PURCHASE_RETURN',
      number: `PR-${order.orderNumber}`,
      date: new Date().toISOString(),
      meta: [['Against invoice', `INV-${order.orderNumber}`], ['Order date', order.createdAt.toLocaleDateString('en-IN')]],
      brand: biz.brand,
      issuer: customer,
      issuerLabel: 'Returned by',
      counterparty: biz.party,
      counterpartyLabel: 'Returned to (supplier)',
      lines: returned.map((i) => ({ ...toLine(i), rate: i.qty ? i.effectiveTotal / i.qty : i.unitPrice })),
      gstRate: biz.gstRate,
      interState: isInterState(biz.party, customer),
      notes: [`Goods returned against order ${order.orderNumber}.`],
      terms: [],
      bank: null,
      signFor: customer.name,
    }
  }

  const items = allItems.filter((i) => i.status !== 'CANCELLED')
  const paid = order.paymentStatus === 'PAID' || (order.paymentMethod === 'COD' && ['DELIVERED', 'COMPLETED'].includes(order.status))
  const tax = kind === 'invoice' && paid
  const discount = order.discountTotal > 0 ? order.discountTotal : order.couponDiscount
  const activeItemsSum = round2(items.reduce((s, i) => s + i.qty * i.unitPrice, 0))
  const codFee =
    order.paymentMethod === 'COD'
      ? round2(Math.max(0, order.grandTotal - (order.itemsTotal - discount + order.shippingTotal)))
      : 0
  void activeItemsSum

  return {
    kind: tax ? 'TAX_INVOICE' : 'PROFORMA_INVOICE',
    number: `${tax ? 'INV' : 'PI'}-${order.orderNumber}`,
    date: order.createdAt.toISOString(),
    meta: [
      ['Order No.', order.orderNumber],
      ['Payment', `${order.paymentMethod ?? '—'} · ${order.paymentStatus.replace(/_/g, ' ').toLowerCase()}`],
      ['Place of supply', customer.state ?? '—'],
    ],
    brand: biz.brand,
    issuer: biz.party,
    issuerLabel: 'Sold by',
    counterparty: customer,
    counterpartyLabel: 'Bill to',
    shipTo: null,
    lines: items.map(toLine),
    discount,
    discountLabel: order.couponCode ? `Coupon (${order.couponCode})` : 'Discount',
    shipping: order.shippingTotal,
    codFee,
    gstRate: biz.gstRate,
    interState: isInterState(biz.party, customer),
    notes: tax ? [] : ['This is a proforma invoice and not a demand for payment under GST. A tax invoice is issued once payment is received.'],
    terms: biz.terms,
    bank: tax ? null : biz.bank,
    signFor: biz.party.name,
  }
}

/* ---------------------------------------------------------------- quotes */

async function quoteDoc(kind: 'quotation' | 'quote-proforma' | 'customer-po', id: string): Promise<DocData> {
  const user = await requireUser()
  const quote = await db.quoteRequest.findUnique({ where: { id }, include: { items: true } })
  if (!quote) throw new HttpError('Quote not found', 404)
  const owns = quote.userId === user.id || quote.email.toLowerCase() === user.email.toLowerCase()
  if (!owns && !isAdmin(user.role)) throw new HttpError('Quote not found', 404)
  if (quote.quotedTotal === null || quote.quotedTotal <= 0) {
    throw new HttpError('This request has not been quoted yet', 400)
  }
  if (kind !== 'quotation' && !['QUOTED', 'ACCEPTED'].includes(quote.status)) {
    throw new HttpError('Available once the quotation is sent', 400)
  }

  const biz = await loadBusiness()
  const customer: DocParty = {
    name: quote.company || quote.name,
    lines: quote.company ? [`Attn: ${quote.name}`] : [],
    gstin: quote.gstin || undefined,
    phone: quote.phone,
    email: quote.email,
  }

  // Spread the quoted total over the lines in proportion to target / list price.
  const total = quote.quotedTotal
  let lines: DocLine[]
  if (quote.items.length === 0) {
    lines = [{ description: 'As per your requirement', detail: quote.message.slice(0, 200) || undefined, qty: 1, rate: total }]
  } else {
    const base = quote.items.map((i) => (i.targetPrice ?? i.unitPrice) * i.qty)
    const sumBase = base.reduce((a, b) => a + b, 0)
    const totalQty = quote.items.reduce((a, i) => a + i.qty, 0)
    lines = quote.items.map((i, idx) => {
      const lineTotal = sumBase > 0 ? (base[idx] / sumBase) * total : (i.qty / totalQty) * total
      return {
        description: i.titleSnapshot,
        detail: i.condition === 'REFURBISHED' ? 'Refurbished' : undefined,
        qty: i.qty,
        rate: lineTotal / i.qty,
      }
    })
  }

  const notes = quote.quoteNote ? [quote.quoteNote] : []
  const common = {
    date: new Date().toISOString(),
    brand: biz.brand,
    lines,
    gstRate: biz.gstRate,
    interState: isInterState(biz.party, customer),
    terms: biz.terms,
  }

  if (kind === 'customer-po') {
    return {
      ...common,
      kind: 'PURCHASE_ORDER',
      number: `PO-${quote.quoteNumber}`,
      meta: [['Against quotation', `QTN-${quote.quoteNumber}`]],
      issuer: customer,
      issuerLabel: 'Buyer',
      counterparty: biz.party,
      counterpartyLabel: 'Supplier',
      notes: [`Please supply the items below as per quotation QTN-${quote.quoteNumber}.`, ...notes],
      terms: [],
      bank: null,
      signFor: customer.name,
    }
  }

  return {
    ...common,
    kind: kind === 'quotation' ? 'QUOTATION' : 'PROFORMA_INVOICE',
    number: `${kind === 'quotation' ? 'QTN' : 'PI'}-${quote.quoteNumber}`,
    meta: [
      ['Reference', quote.quoteNumber],
      ...(kind === 'quotation' ? [['Valid till', new Date(Date.now() + 15 * 86400000).toLocaleDateString('en-IN')] as [string, string]] : []),
    ],
    issuer: biz.party,
    issuerLabel: 'From',
    counterparty: customer,
    counterpartyLabel: kind === 'quotation' ? 'Quotation for' : 'Bill to',
    notes: kind === 'quotation' ? notes : ['This is a proforma invoice and not a demand for payment under GST.', ...notes],
    bank: biz.bank,
    signFor: biz.party.name,
  }
}

/* ------------------------------------------------------------ sub-orders */

async function vendorDoc(kind: 'vendor-po' | 'vendor-return', id: string): Promise<DocData> {
  const user = await requireUser()
  const sub = await db.subOrder.findUnique({
    where: { id },
    include: { vendor: true, items: true, order: { select: { orderNumber: true, createdAt: true } } },
  })
  if (!sub || !sub.vendor) throw new HttpError('Vendor sub-order not found', 404)
  if (!isAdmin(user.role)) {
    const ctx = await requireVendor()
    if (ctx.vendor.id !== sub.vendorId) throw new HttpError('Vendor sub-order not found', 404)
  }

  const biz = await loadBusiness()
  const v = sub.vendor
  const vendor: DocParty = {
    name: v.name,
    lines: [v.pickupAddress ?? '', v.city ?? ''].filter(Boolean),
    state: v.state ?? undefined,
    gstin: v.gstin ?? undefined,
    phone: v.phone ?? undefined,
    email: v.email,
  }

  // Lastrivon buys from the vendor at the vendor's earning (sale price less commission).
  const purchaseRate = (i: (typeof sub.items)[number]) => (i.qty ? i.vendorEarning / i.qty : 0)
  const items =
    kind === 'vendor-po'
      ? sub.items.filter((i) => i.status !== 'CANCELLED')
      : sub.items.filter((i) => RETURNED_ITEM_STATUSES.includes(i.status))
  if (items.length === 0) {
    throw new HttpError(kind === 'vendor-po' ? 'No active items on this sub-order' : 'No returned items on this sub-order', 400)
  }
  const suffix = sub.id.slice(-4).toUpperCase()

  return {
    kind: kind === 'vendor-po' ? 'PURCHASE_ORDER' : 'PURCHASE_RETURN',
    number: `${kind === 'vendor-po' ? 'PO' : 'PR'}-${sub.order.orderNumber}-${suffix}`,
    date: kind === 'vendor-po' ? sub.createdAt.toISOString() : new Date().toISOString(),
    meta: [
      ['Customer order', sub.order.orderNumber],
      ...(kind === 'vendor-return' ? [['Against PO', `PO-${sub.order.orderNumber}-${suffix}`] as [string, string]] : []),
    ],
    brand: biz.brand,
    issuer: biz.party,
    issuerLabel: 'Buyer',
    counterparty: vendor,
    counterpartyLabel: kind === 'vendor-po' ? 'Supplier (vendor)' : 'Returned to (vendor)',
    lines: items.map((i) => ({ description: i.titleSnapshot, detail: i.variantName ?? undefined, qty: i.qty, rate: purchaseRate(i) })),
    gstRate: biz.gstRate,
    interState: isInterState(biz.party, vendor),
    notes:
      kind === 'vendor-po'
        ? ['Rates are net of marketplace commission. Ship to the customer address shared in the vendor panel.']
        : [`Goods returned by the customer against order ${sub.order.orderNumber}.`],
    terms: kind === 'vendor-po' ? biz.terms : [],
    bank: null,
    signFor: biz.party.name,
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const { kind, id } = (await params) as { kind: DocRequestKind; id: string }
    let doc: DocData
    switch (kind) {
      case 'invoice':
      case 'proforma':
      case 'purchase-return':
        doc = await orderDoc(kind, id)
        break
      case 'quotation':
      case 'quote-proforma':
      case 'customer-po':
        doc = await quoteDoc(kind, id)
        break
      case 'vendor-po':
      case 'vendor-return':
        doc = await vendorDoc(kind, id)
        break
      default:
        throw new HttpError('Unknown document type', 404)
    }
    return ok({ doc })
  } catch (err) {
    return handleError(err)
  }
}
