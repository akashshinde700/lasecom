import { NextResponse } from 'next/server'
import { getSessionUser, hasGuestOrderAccess, type SessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import type { Prisma, Vendor, VendorStaff } from '@prisma/client'

export class HttpError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status })
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export function handleError(err: unknown) {
  if (err instanceof HttpError) return fail(err.message, err.status)
  // Never leak internal error details (Prisma/DB messages) to clients.
  console.error('[api-error]', err)
  return fail('Internal server error', 500)
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new HttpError('Please login to continue', 401)
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'PLATFORM_ADMIN' && user.role !== 'PLATFORM_STAFF') {
    throw new HttpError('Admin access required', 403)
  }
  return user
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'PLATFORM_ADMIN') {
    throw new HttpError('Only the platform owner can perform this action', 403)
  }
  return user
}

/**
 * Verifies whether the current caller may view/pay/cancel an order:
 * - Platform admins/staff: allowed
 * - Registered customer order (`order.userId`): must match `user.id`
 * - Guest order (`!order.userId`): must hold the HMAC-signed `sk_guest_orders`
 *   cookie for `order.id` OR supply matching `emailParam` (when permitted).
 */
export async function canAccessOrder(
  order: { id: string; userId: string | null; guestEmail?: string | null },
  user: SessionUser | null,
  opts?: { emailParam?: string; allowEmailFallback?: boolean }
): Promise<boolean> {
  if (user && (user.role === 'PLATFORM_ADMIN' || user.role === 'PLATFORM_STAFF')) {
    return true
  }
  if (order.userId) {
    return !!user && user.id === order.userId
  }
  if (await hasGuestOrderAccess(order.id)) {
    return true
  }
  if (
    opts?.allowEmailFallback &&
    opts.emailParam &&
    order.guestEmail &&
    opts.emailParam.trim().toLowerCase() === order.guestEmail.trim().toLowerCase()
  ) {
    return true
  }
  return false
}

export type VendorContext = {
  user: SessionUser
  vendor: Vendor
  staffRole: string | null
}

/**
 * Vendor isolation: resolves the vendor this user may act on.
 * VENDOR_ADMIN -> own vendor; VENDOR_STAFF -> assigned vendor.
 */
export async function requireVendor(): Promise<VendorContext> {
  const user = await requireUser()
  if (user.role === 'VENDOR_ADMIN') {
    const vendor = await db.vendor.findUnique({ where: { ownerId: user.id } })
    if (!vendor) throw new HttpError('Vendor profile not found', 404)
    return { user, vendor, staffRole: null }
  }
  if (user.role === 'VENDOR_STAFF') {
    const staff = (await db.vendorStaff.findUnique({
      where: { userId: user.id },
      include: { vendor: true },
    })) as (VendorStaff & { vendor: Vendor }) | null
    if (!staff) throw new HttpError('Staff profile not found', 404)
    return { user, vendor: staff.vendor, staffRole: staff.staffRole }
  }
  throw new HttpError('Vendor access required', 403)
}

/** Vendor admin (owner) only — VENDOR_STAFF is rejected. For payout/staff/profile routes. */
export async function requireVendorAdmin(): Promise<VendorContext> {
  const ctx = await requireVendor()
  if (ctx.staffRole !== null) throw new HttpError('Vendor admin permission required', 403)
  return ctx
}

/** Suspended/PENDING vendors are read-only for money-motion mutations. */
export async function requireActiveVendor(ctx?: VendorContext): Promise<VendorContext> {
  const c = ctx ?? (await requireVendor())
  if (c.vendor.status !== 'ACTIVE') {
    throw new HttpError('Your vendor account is not active. Please contact platform support.', 403)
  }
  return c
}

export type VendorPermission = 'products' | 'inventory' | 'orders' | 'returns' | 'finance' | 'owner'

const STAFF_PERMISSIONS: Record<string, VendorPermission[]> = {
  PRODUCT_MANAGER: ['products', 'inventory'],
  INVENTORY_MANAGER: ['inventory'],
  ORDER_MANAGER: ['orders', 'returns'],
  ACCOUNTANT: ['finance'],
}

/**
 * Role-scoped + vendor-status-enforced guard for `/api/vendor/**` routes.
 * - Blocks SUSPENDED / REJECTED vendors on mutations (`requireNotSuspended`).
 * - Requires ACTIVE vendor status unless `allowPending` is true (e.g. product setup while awaiting KYC).
 * - Enforces `VendorStaff.staffRole` permissions when caller is `VENDOR_STAFF`.
 */
export async function requireVendorPermission(
  permission: VendorPermission,
  opts?: { allowPending?: boolean; readOnly?: boolean }
): Promise<VendorContext> {
  const ctx = await requireVendor()
  if (!opts?.readOnly) {
    if (ctx.vendor.status === 'SUSPENDED' || ctx.vendor.status === 'REJECTED') {
      throw new HttpError('Your vendor account is suspended or rejected. Mutations are disabled.', 403)
    }
    if (!opts?.allowPending && ctx.vendor.status !== 'ACTIVE') {
      throw new HttpError('Your vendor account is awaiting platform approval.', 403)
    }
  }
  if (ctx.staffRole !== null) {
    const allowed = STAFF_PERMISSIONS[ctx.staffRole] ?? []
    if (!allowed.includes(permission)) {
      throw new HttpError('You do not have permission for this vendor section', 403)
    }
  }
  return ctx
}

/**
 * Reverses the exact remaining net credit (`CREDIT - DEBIT`) recorded on
 * `VendorLedger` for a cancelled `SubOrder`. Idempotent: if already reversed
 * (or never credited), returns 0 without inserting duplicate debits.
 */
export async function reverseSubOrderLedgerTx(
  tx: Prisma.TransactionClient,
  vendorId: string,
  subOrderId: string,
  notes: string
): Promise<number> {
  const entries = await tx.vendorLedger.findMany({
    where: { vendorId, subOrderId },
    select: { direction: true, amount: true },
  })
  const netCredited = round2(
    entries.reduce((sum, e) => sum + (e.direction === 'CREDIT' ? e.amount : -e.amount), 0)
  )
  if (netCredited <= 0) return 0
  await tx.vendorLedger.create({
    data: {
      vendorId,
      subOrderId,
      type: 'REFUND_DEBIT',
      direction: 'DEBIT',
      amount: netCredited,
      notes,
    },
  })
  return netCredited
}

/** Storefront visibility filter: platform 1P products OR products of ACTIVE vendors only. */
export const PUBLIC_PRODUCT_WHERE: Prisma.ProductWhereInput = {
  status: 'ACTIVE',
  OR: [{ vendorId: null }, { vendor: { status: 'ACTIVE' } }],
}

export async function logAudit(
  actor: SessionUser | null,
  action: string,
  entity: string,
  entityId?: string,
  detail?: string
) {
  try {
    await db.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? 'system',
        action,
        entity,
        entityId: entityId ?? null,
        detail: detail ?? null,
      },
    })
  } catch {
    // never break business flow on audit failure
  }
}

export async function notify(
  userId: string,
  title: string,
  body: string,
  type = 'SYSTEM'
) {
  try {
    await db.notification.create({ data: { userId, title, body, type } })
  } catch {
    // ignore
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function parsePage(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const limit = Math.min(60, Math.max(1, parseInt(searchParams.get('limit') || '12') || 12))
  return { page, limit, skip: (page - 1) * limit }
}
