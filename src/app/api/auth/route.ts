import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword, createSession, destroySession, getSessionUser, clearExpiredSessions } from '@/lib/auth'
import { ok, fail, handleError } from '@/lib/api'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    if (action === 'register') {
      const { name, email, password, phone } = body
      if (!name || !email || !password) return fail('Name, email and password are required')
      if (String(password).length < 6) return fail('Password must be at least 6 characters')
      const emailNorm = String(email).toLowerCase().trim()
      const existing = await db.user.findUnique({ where: { email: emailNorm } })
      if (existing) return fail('An account with this email already exists')
      const user = await db.user.create({
        data: {
          name: String(name).trim(),
          email: emailNorm,
          phone: phone ? String(phone).trim() : null,
          passwordHash: hashPassword(String(password)),
          role: 'CUSTOMER',
        },
      })
      await createSession(user.id)
      return ok({ id: user.id, name: user.name, email: user.email, role: user.role })
    }

    if (action === 'vendor-register') {
      const { name, email, password, phone, businessName, gstin, city, state } = body
      if (!name || !email || !password || !businessName) {
        return fail('Owner name, email, password and business name are required')
      }
      if (String(password).length < 6) return fail('Password must be at least 6 characters')
      const emailNorm = String(email).toLowerCase().trim()
      const existing = await db.user.findUnique({ where: { email: emailNorm } })
      if (existing) return fail('An account with this email already exists')

      const baseSlug =
        String(businessName)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || 'vendor'

      const { user, vendor } = await db.$transaction(async (tx) => {
        let slug = baseSlug
        let attempt = 1
        while (await tx.vendor.findUnique({ where: { slug } })) {
          attempt += 1
          slug = `${baseSlug}-${attempt}`
        }
        const createdUser = await tx.user.create({
          data: {
            name: String(name).trim(),
            email: emailNorm,
            phone: phone ? String(phone).trim() : null,
            passwordHash: hashPassword(String(password)),
            role: 'VENDOR_ADMIN',
          },
        })
        const freePlan = await tx.subscriptionPlan.findFirst({ where: { name: 'Free' } })
        const createdVendor = await tx.vendor.create({
          data: {
            name: String(businessName).trim(),
            slug,
            email: emailNorm,
            phone: phone ? String(phone).trim() : null,
            gstin: gstin ? String(gstin).trim() : null,
            city: city ? String(city).trim() : null,
            state: state ? String(state).trim() : null,
            status: 'PENDING',
            ownerId: createdUser.id,
            planId: freePlan?.id ?? null,
            logoText: String(businessName).trim().slice(0, 2).toUpperCase(),
          },
        })
        return { user: createdUser, vendor: createdVendor }
      })

      await createSession(user.id)
      return ok({ id: user.id, vendorId: vendor.id, role: user.role, vendorStatus: vendor.status })
    }

    if (action === 'login') {
      const { email, password } = body
      if (!email || !password) return fail('Email and password are required')
      await clearExpiredSessions()
      const user = await db.user.findUnique({ where: { email: String(email).toLowerCase().trim() } })
      if (!user || !verifyPassword(String(password), user.passwordHash)) {
        return fail('Invalid email or password', 401)
      }
      if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
        return fail('Your account has been blocked. Contact support.', 403)
      }
      await createSession(user.id)
      return ok({ id: user.id, name: user.name, email: user.email, role: user.role })
    }

    if (action === 'logout') {
      await destroySession()
      return ok({ loggedOut: true })
    }

    return fail('Unknown auth action')
  } catch (err) {
    return handleError(err)
  }
}

export async function GET() {
  try {
    const session = await getSessionUser()
    if (!session) return ok({ user: null })
    let vendor: { id: string; name: string; status: string; slug: string } | null = null
    let staffRole: string | null = null
    if (session.role === 'VENDOR_ADMIN') {
      const v = await db.vendor.findUnique({
        where: { ownerId: session.id },
        select: { id: true, name: true, status: true, slug: true },
      })
      vendor = v
    } else if (session.role === 'VENDOR_STAFF') {
      const staff = await db.vendorStaff.findUnique({
        where: { userId: session.id },
        select: {
          staffRole: true,
          vendor: { select: { id: true, name: true, status: true, slug: true } },
        },
      })
      vendor = staff?.vendor ?? null
      staffRole = staff?.staffRole ?? null
    }
    return ok({ user: { ...session, staffRole, vendor } })
  } catch (err) {
    return handleError(err)
  }
}
