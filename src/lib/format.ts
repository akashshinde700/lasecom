export function formatINR(n: number | null | undefined): string {
  const v = n ?? 0
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export function formatINR2(n: number | null | undefined): string {
  const v = n ?? 0
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '-'
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '-'
  const date = new Date(d)
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function discountPercent(mrp: number, price: number): number {
  if (!mrp || mrp <= price) return 0
  return Math.round(((mrp - price) / mrp) * 100)
}

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Payment Pending',
  CONFIRMED: 'Confirmed',
  PARTIALLY_SHIPPED: 'Partially Shipped',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  FAILED: 'Failed',
  COD_PENDING: 'COD Pending',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially Refunded',
}

export const SUBORDER_FLOW = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']

export function statusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
    case 'CONFIRMED':
    case 'PAID':
    case 'APPROVED':
    case 'SUCCESS':
    case 'DELIVERED':
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-700'
    case 'PENDING':
    case 'PENDING_PAYMENT':
    case 'COD_PENDING':
    case 'PENDING_REVIEW':
      return 'bg-amber-100 text-amber-700'
    case 'PROCESSING':
    case 'PACKED':
      return 'bg-sky-100 text-sky-700'
    case 'SHIPPED':
    case 'PARTIALLY_SHIPPED':
      return 'bg-violet-100 text-violet-700'
    case 'CANCELLED':
    case 'REJECTED':
    case 'FAILED':
    case 'SUSPENDED':
    case 'BLOCKED':
      return 'bg-red-100 text-red-700'
    case 'RETURN_REQUESTED':
      return 'bg-orange-100 text-orange-700'
    case 'RETURNED':
    case 'REFUNDED':
      return 'bg-stone-200 text-stone-700'
    default:
      return 'bg-stone-100 text-stone-600'
  }
}

export function etaText(daysMin = 2, daysMax = 5): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  const a = new Date(Date.now() + daysMin * 86400000)
  const b = new Date(Date.now() + daysMax * 86400000)
  return `Delivery by ${fmt(a)} - ${fmt(b)}`
}
