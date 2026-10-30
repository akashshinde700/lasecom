import { db } from '@/lib/db'
import { ok, handleError, requireUser } from '@/lib/api'
import { NextRequest } from 'next/server'

export async function GET() {
  try {
    const user = await requireUser()
    const [items, unread] = await Promise.all([
      db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      db.notification.count({ where: { userId: user.id, read: false } }),
    ])
    return ok({ items, unread })
  } catch (err) {
    return handleError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json().catch(() => ({}))
    const rawIds: unknown = body.ids
    const ids: string[] | undefined =
      Array.isArray(rawIds) && rawIds.every((s) => typeof s === 'string')
        ? (rawIds as string[])
        : undefined
    await db.notification.updateMany({
      where: { userId: user.id, ...(ids ? { id: { in: ids } } : {}) },
      data: { read: true },
    })
    const unread = await db.notification.count({ where: { userId: user.id, read: false } })
    return ok({ unread })
  } catch (err) {
    return handleError(err)
  }
}
