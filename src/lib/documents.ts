//
// Business documents — Tax Invoice, Proforma Invoice, Quotation, Purchase
// Order and Purchase Return. The server (/api/documents/:kind/:id) builds a
// DocData after checking access; this module renders it as a printable A4
// page that opens in a new tab ("Print / Save as PDF").
//
// Prices are GST-inclusive: every amount is split back into taxable value +
// GST at `gstRate`, shown as CGST + SGST (same state) or IGST (inter-state).
//

export type DocKind = 'TAX_INVOICE' | 'PROFORMA_INVOICE' | 'QUOTATION' | 'PURCHASE_ORDER' | 'PURCHASE_RETURN'

/** Which document to fetch from /api/documents/:kind/:id */
export type DocRequestKind =
  | 'invoice' // order -> tax invoice (paid) or proforma (unpaid)
  | 'proforma' // order -> proforma invoice
  | 'purchase-return' // order -> customer's purchase return for returned items
  | 'quotation' // quote -> quotation
  | 'quote-proforma' // quote -> proforma invoice
  | 'customer-po' // quote -> customer's purchase order to Lastrivon
  | 'vendor-po' // sub-order -> Lastrivon's purchase order to the vendor
  | 'vendor-return' // sub-order -> Lastrivon's purchase return to the vendor

export type DocParty = {
  name: string
  lines: string[] // address lines
  state?: string
  gstin?: string
  phone?: string
  email?: string
}

export type DocLine = {
  description: string
  detail?: string
  qty: number
  rate: number // per unit, GST-inclusive
}

export type DocBank = { accountName: string; bankName: string; accountNumber: string; ifsc: string; branch: string }

export type DocData = {
  kind: DocKind
  number: string
  date: string // ISO
  meta: [string, string][] // extra header rows, e.g. ['Order No.', 'SK-100001']
  brand: string
  issuer: DocParty // whose letterhead the document is on
  issuerLabel: string // e.g. 'Sold by', 'Buyer'
  counterparty: DocParty
  counterpartyLabel: string // e.g. 'Bill to', 'Supplier'
  shipTo?: DocParty | null
  lines: DocLine[]
  discount?: number
  discountLabel?: string
  shipping?: number
  codFee?: number
  gstRate: number
  interState: boolean
  notes: string[]
  terms: string[]
  bank?: DocBank | null
  signFor: string // "For <company>" above the signature line
}

export const DOC_TITLE: Record<DocKind, string> = {
  TAX_INVOICE: 'Tax Invoice',
  PROFORMA_INVOICE: 'Proforma Invoice',
  QUOTATION: 'Quotation',
  PURCHASE_ORDER: 'Purchase Order',
  PURCHASE_RETURN: 'Purchase Return',
}

const esc = (s: string | number | null | undefined) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const money = (n: number) =>
  '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function words999(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  const parts: string[] = []
  if (h) parts.push(`${ONES[h]} Hundred`)
  if (r) parts.push(r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? ' ' + ONES[r % 10] : ''}`)
  return parts.join(' ')
}

/** Indian numbering: 1,23,45,678.50 -> "One Crore Twenty Three Lakh … Rupees and Fifty Paise Only" */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.round(amount * 100) / 100)
  const paise = Math.round((amount - rupees) * 100)
  let n = rupees
  const parts: string[] = []
  const crore = Math.floor(n / 10000000); n %= 10000000
  const lakh = Math.floor(n / 100000); n %= 100000
  const thousand = Math.floor(n / 1000); n %= 1000
  if (crore) parts.push(`${crore > 999 ? amountInWords(crore).replace(/ Rupees.*$/, '') : words999(crore)} Crore`)
  if (lakh) parts.push(`${words999(lakh)} Lakh`)
  if (thousand) parts.push(`${words999(thousand)} Thousand`)
  if (n) parts.push(words999(n))
  const r = parts.length ? parts.join(' ') : 'Zero'
  return `${r} Rupees${paise ? ` and ${words999(paise)} Paise` : ''} Only`
}

export function computeTotals(
  d: Pick<DocData, 'lines' | 'discount' | 'shipping' | 'codFee' | 'gstRate' | 'interState'>
) {
  const itemsTotal = d.lines.reduce((s, l) => s + l.qty * l.rate, 0)
  const discount = Math.min(d.discount ?? 0, itemsTotal)
  const shipping = d.shipping ?? 0
  const codFee = d.codFee ?? 0
  const grand = Math.round((itemsTotal - discount + shipping + codFee) * 100) / 100
  const factor = 1 + d.gstRate / 100
  const taxable = Math.round((grand / factor) * 100) / 100
  const tax = Math.round((grand - taxable) * 100) / 100
  const half = Math.round((tax / 2) * 100) / 100
  return {
    itemsTotal,
    discount,
    shipping,
    codFee,
    taxable,
    tax,
    cgst: d.interState ? 0 : half,
    sgst: d.interState ? 0 : Math.round((tax - half) * 100) / 100,
    igst: d.interState ? tax : 0,
    grand,
  }
}

function party(label: string, p: DocParty) {
  return `<div class="party">
  <div class="label">${esc(label)}</div>
  <div class="pname">${esc(p.name)}</div>
  ${p.lines.filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join('')}
  ${p.phone ? `<div>Phone: ${esc(p.phone)}</div>` : ''}
  ${p.email ? `<div>Email: ${esc(p.email)}</div>` : ''}
  ${p.gstin ? `<div><b>GSTIN:</b> ${esc(p.gstin)}</div>` : ''}
  ${p.state ? `<div>State: ${esc(p.state)}</div>` : ''}
</div>`
}

export function renderDocumentHtml(d: DocData): string {
  const t = computeTotals(d)
  const title = DOC_TITLE[d.kind]
  const factor = 1 + d.gstRate / 100
  const date = new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const rows = d.lines
    .map((l, i) => {
      const amount = l.qty * l.rate
      return `<tr>
  <td class="c">${i + 1}</td>
  <td>${esc(l.description)}${l.detail ? `<div class="muted">${esc(l.detail)}</div>` : ''}</td>
  <td class="r">${l.qty}</td>
  <td class="r">${money(l.rate)}</td>
  <td class="r">${money(amount / factor)}</td>
  <td class="r">${money(amount)}</td>
</tr>`
    })
    .join('')

  const totalRow = (label: string, value: string, cls = '') => `<tr class="${cls}"><td>${esc(label)}</td><td class="r">${value}</td></tr>`
  const half = d.gstRate / 2

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} ${esc(d.number)} — ${esc(d.brand)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#1c1917;margin:0;background:#f5f5f4;font-size:12px}
  .page{max-width:800px;margin:24px auto;background:#fff;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .bar{max-width:800px;margin:16px auto 0;display:flex;justify-content:flex-end;gap:8px;padding:0 16px}
  .bar button{background:#ea580c;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:bold;cursor:pointer}
  .head{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #ea580c;padding-bottom:14px}
  .brand{font-size:22px;font-weight:bold;color:#ea580c}
  .doctitle{font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;text-align:right}
  .meta{margin-top:6px;text-align:right;line-height:1.6}
  .meta b{color:#57534e;font-weight:normal}
  .parties{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:18px}
  .party{line-height:1.55;border:1px solid #e7e5e4;border-radius:6px;padding:10px 12px}
  .label{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#78716c;margin-bottom:2px}
  .pname{font-weight:bold;font-size:13px}
  table{width:100%;border-collapse:collapse}
  .items{margin-top:18px}
  .items th{background:#fafaf9;border-top:1px solid #d6d3d1;border-bottom:1px solid #d6d3d1;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:8px 6px;text-align:left}
  .items td{border-bottom:1px solid #e7e5e4;padding:8px 6px;vertical-align:top}
  .r{text-align:right}.c{text-align:center}
  .muted{color:#78716c;font-size:11px}
  .sum{display:flex;justify-content:space-between;gap:24px;margin-top:14px;flex-wrap:wrap}
  .words{flex:1;min-width:220px;line-height:1.6}
  .totals{width:300px;max-width:100%}
  .totals td{padding:4px 6px}
  .grand td{font-weight:bold;font-size:14px;border-top:2px solid #1c1917;padding-top:8px}
  .box{margin-top:18px;border:1px solid #e7e5e4;border-radius:6px;padding:10px 12px;line-height:1.6}
  .foot{display:flex;justify-content:space-between;gap:24px;margin-top:18px;flex-wrap:wrap}
  .sign{text-align:right;min-width:220px;margin-left:auto}
  .sign .line{margin-top:48px;border-top:1px solid #1c1917;padding-top:4px}
  .note{margin-top:20px;font-size:10px;color:#78716c;text-align:center}
  ol{margin:4px 0 0 16px;padding:0}
  @media (max-width:600px){.page{padding:16px;margin:8px}.head{flex-direction:column}.doctitle,.meta{text-align:left}}
  @media print{body{background:#fff}.bar{display:none}.page{box-shadow:none;margin:0;max-width:none;padding:0}@page{size:A4;margin:12mm}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="page">
  <div class="head">
    <div>
      <div class="brand">${esc(d.issuer.name)}</div>
      ${d.issuer.lines.filter(Boolean).map((l) => `<div class="muted">${esc(l)}</div>`).join('')}
      <div class="muted">${[d.issuer.phone && `Ph: ${esc(d.issuer.phone)}`, d.issuer.email && esc(d.issuer.email)].filter(Boolean).join(' · ')}</div>
      ${d.issuer.gstin ? `<div><b>GSTIN:</b> ${esc(d.issuer.gstin)}</div>` : ''}
    </div>
    <div>
      <div class="doctitle">${esc(title)}</div>
      <div class="meta">
        <div><b>No.</b> ${esc(d.number)}</div>
        <div><b>Date</b> ${esc(date)}</div>
        ${d.meta.map(([k, v]) => `<div><b>${esc(k)}</b> ${esc(v)}</div>`).join('')}
      </div>
    </div>
  </div>

  <div class="parties">
    ${party(d.counterpartyLabel, d.counterparty)}
    ${d.shipTo ? party('Ship to', d.shipTo) : ''}
  </div>

  <table class="items">
    <thead><tr>
      <th class="c" style="width:32px">#</th><th>Description</th><th class="r">Qty</th>
      <th class="r">Rate (incl. GST)</th><th class="r">Taxable value</th><th class="r">Amount</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="6" class="c muted">No items</td></tr>'}</tbody>
  </table>

  <div class="sum">
    <div class="words">
      <div class="label">Amount in words</div>
      <div><b>${esc(amountInWords(t.grand))}</b></div>
      <div class="muted" style="margin-top:6px">All prices are inclusive of GST @ ${d.gstRate}%.</div>
    </div>
    <table class="totals">
      ${totalRow('Items total', money(t.itemsTotal))}
      ${t.discount > 0 ? totalRow(d.discountLabel || 'Discount', '- ' + money(t.discount)) : ''}
      ${t.shipping > 0 ? totalRow('Shipping', money(t.shipping)) : ''}
      ${t.codFee > 0 ? totalRow('COD handling fee', money(t.codFee)) : ''}
      ${totalRow('Taxable value', money(t.taxable))}
      ${d.interState
        ? totalRow(`IGST @ ${d.gstRate}%`, money(t.igst))
        : totalRow(`CGST @ ${half}%`, money(t.cgst)) + totalRow(`SGST @ ${half}%`, money(t.sgst))}
      ${totalRow('Grand total', money(t.grand), 'grand')}
    </table>
  </div>

  ${d.notes.length ? `<div class="box"><div class="label">Notes</div>${d.notes.map((n) => `<div>${esc(n)}</div>`).join('')}</div>` : ''}

  <div class="foot">
    <div style="flex:1;min-width:220px">
      ${d.bank && d.bank.accountNumber ? `<div class="box" style="margin-top:0"><div class="label">Bank details</div>
        ${d.bank.accountName ? `<div>A/c name: <b>${esc(d.bank.accountName)}</b></div>` : ''}
        ${d.bank.bankName ? `<div>Bank: ${esc(d.bank.bankName)}${d.bank.branch ? `, ${esc(d.bank.branch)}` : ''}</div>` : ''}
        <div>A/c no.: <b>${esc(d.bank.accountNumber)}</b></div>
        ${d.bank.ifsc ? `<div>IFSC: <b>${esc(d.bank.ifsc)}</b></div>` : ''}
      </div>` : ''}
      ${d.terms.length ? `<div class="box"><div class="label">Terms &amp; conditions</div><ol>${d.terms.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
    </div>
    <div class="sign">
      <div>For <b>${esc(d.signFor)}</b></div>
      <div class="line">Authorised Signatory</div>
    </div>
  </div>

  <div class="note">This is a computer-generated document.</div>
</div>
</body></html>`
}

/**
 * Open a document in a new tab. The tab is opened synchronously (so pop-up
 * blockers allow it), then filled once the API responds.
 */
export async function openDocument(kind: DocRequestKind, id: string): Promise<{ ok: boolean; error?: string }> {
  const win = window.open('', '_blank')
  if (!win) return { ok: false, error: 'Please allow pop-ups to download the document' }
  win.document.write('<p style="font-family:Arial,sans-serif;padding:24px;color:#57534e">Preparing document…</p>')
  try {
    const res = await fetch(`/api/documents/${kind}/${encodeURIComponent(id)}`, { credentials: 'include' })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { doc: DocData }; error?: string } | null
    if (!res.ok || !json?.ok || !json.data) {
      win.close()
      return { ok: false, error: json?.error ?? 'Could not generate the document' }
    }
    win.document.open()
    win.document.write(renderDocumentHtml(json.data.doc))
    win.document.close()
    return { ok: true }
  } catch {
    win.close()
    return { ok: false, error: 'Could not generate the document' }
  }
}
