import { NextResponse } from 'next/server'
import { getSessionUser, type SessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import type { Vendor, VendorStaff } from '@prisma/client'

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

export type VendorContext = {
  user: SessionUser
  vendor: Vendor
  staffRole: string | null
}

/**
 * Vendor isolation: resolves the vendor this user may act on.
 * VENDOR_ADMIN -> own vendor; VENDOR_STAFF -> assigned vendor.
 * Suspended/PENDING vendors are read-only for most mutations (checked by caller).
 */
export async function requireVendor(): Promise<VendorContext> {
  const user = await requireUser()
  if (user.role === 'VENDOR_ADMIN') {
    const vendor = await db.vendor.findUnique({ where: { ownerId: user.id } })
    if (!vendor) throw new HttpError('Vendor profile not found', 404)
    return { user, vendor, staffRole: null }
  }
  if (user.role === 'VENDOR_STAFF') {
    const staff = await db.vendorStaff.findUnique({
      where: { userId: user.id },
      include: { vendor: true },
    }) as (VendorStaff & { vendor: Vendor }) | null
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
