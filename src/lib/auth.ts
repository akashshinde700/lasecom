import { createHmac, randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { cookies, headers } from 'next/headers'

export const SESSION_COOKIE = 'sk_session'
export const GUEST_ORDERS_COOKIE = 'sk_guest_orders'
const SESSION_DAYS = 30
const MAX_GUEST_ORDERS = 20

const globalForSecret = globalThis as unknown as {
  __lkSigningSecret?: string
}

/**
 * Returns an HMAC signing secret without ever falling back to a hardcoded
 * public string literal. Uses RAZORPAY_KEY_SECRET or SESSION_SECRET when
 * configured; otherwise generates a per-process 256-bit random secret.
 */
export function getSigningSecret(): string {
  const configured =
    process.env.SESSION_SECRET?.trim() ||
    process.env.PAYMENT_SIGNING_SECRET?.trim() ||
    process.env.RAZORPAY_KEY_SECRET?.trim()
  if (configured) return configured
  if (!globalForSecret.__lkSigningSecret) {
    globalForSecret.__lkSigningSecret = randomBytes(32).toString('hex')
  }
  return globalForSecret.__lkSigningSecret
}

async function isSecureRequest(): Promise<boolean> {
  if (process.env.FORCE_SECURE_COOKIE === 'true') return true
  if (process.env.FORCE_SECURE_COOKIE === 'false') return false
  try {
    const h = await headers()
    const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
    if (proto === 'https') return true
  } catch {
    // ignore outside request context
  }
  return false
}

export type SessionUser = {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  status: string
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const hashBuf = Buffer.from(hash, 'hex')
    const testBuf = scryptSync(password, salt, 64)
    return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf)
  } catch {
    return false
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = randomUUID() + '.' + randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000)
  await db.session.create({ data: { token, userId, expiresAt } })
  const jar = await cookies()
  const secure = await isSecureRequest()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: SESSION_DAYS * 24 * 3600,
    path: '/',
  })
  return token
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { token } })
  }
  jar.delete(SESSION_COOKIE)
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const jar = await cookies()
    const token = jar.get(SESSION_COOKIE)?.value
    if (!token) return null
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    })
    if (!session) return null
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {})
      return null
    }
    if (session.user.status === 'BLOCKED' || session.user.status === 'SUSPENDED') {
      await db.session.delete({ where: { id: session.id } }).catch(() => {})
      return null
    }
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      phone: session.user.phone,
      role: session.user.role,
      status: session.user.status,
    }
  } catch {
    return null
  }
}

export async function clearExpiredSessions(): Promise<void> {
  try {
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  } catch {
    // ignore
  }
}

function signGuestOrderIds(ids: string[]): string {
  const payload = ids.join(',')
  const sig = createHmac('sha256', getSigningSecret()).update(`guest-orders:${payload}`).digest('hex')
  return `${payload}.${sig}`
}

function parseSignedGuestOrderIds(raw: string | undefined): string[] {
  if (!raw) return []
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return []
  const payload = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expected = createHmac('sha256', getSigningSecret()).update(`guest-orders:${payload}`).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return []
  try {
    if (!timingSafeEqual(a, b)) return []
  } catch {
    return []
  }
  return payload
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Grants the current browser session HMAC-signed HttpOnly cookie access to a
 * newly created guest order (prevents third-party IDOR on guest payment &
 * order tracking routes while letting the guest track/pay/cancel seamlessly).
 */
export async function grantGuestOrderAccess(orderId: string): Promise<void> {
  try {
    const jar = await cookies()
    const existing = parseSignedGuestOrderIds(jar.get(GUEST_ORDERS_COOKIE)?.value)
    const next = [orderId, ...existing.filter((id) => id !== orderId)].slice(0, MAX_GUEST_ORDERS)
    const secure = await isSecureRequest()
    jar.set(GUEST_ORDERS_COOKIE, signGuestOrderIds(next), {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: SESSION_DAYS * 24 * 3600,
      path: '/',
    })
  } catch {
    // ignore outside request context
  }
}

export async function hasGuestOrderAccess(orderId: string): Promise<boolean> {
  try {
    const jar = await cookies()
    const ids = parseSignedGuestOrderIds(jar.get(GUEST_ORDERS_COOKIE)?.value)
    return ids.includes(orderId)
  } catch {
    return false
  }
}
