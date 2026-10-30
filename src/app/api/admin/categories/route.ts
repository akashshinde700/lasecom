import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, round2, logAudit } from '@/lib/api'

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'category'
  )
}

async function uniqueCategorySlug(name: string): Promise<string> {
  const base = slugify(name)
  let slug = base
  let attempt = 1
  while (await db.category.findUnique({ where: { slug } })) {
    attempt += 1
    slug = `${base}-${attempt}`
  }
  return slug
}

// ---------------- GET: all categories (incl inactive, with children) ----------------
export async function GET() {
  try {
    await requireAdmin()
    const items = await db.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: 'asc' },
      include: { children: { orderBy: { sortOrder: 'asc' } } },
    })
    return ok({ items })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- POST: create category ----------------
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) throw new HttpError('Category name is required', 400)

    let parentId: string | null = null
    if (typeof body.parentId === 'string' && body.parentId) {
      const parent = await db.category.findUnique({ where: { id: body.parentId } })
      if (!parent) throw new HttpError('Parent category not found', 404)
      parentId = parent.id
    }

    const slug = await uniqueCategorySlug(name)
    const category = await db.category.create({
      data: {
        name,
        slug,
        parentId,
        icon: typeof body.icon === 'string' && body.icon ? body.icon : null,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
        commissionPercent:
          body.commissionPercent !== undefined && body.commissionPercent !== null && Number.isFinite(Number(body.commissionPercent))
            ? round2(Number(body.commissionPercent))
            : null,
      },
      include: { children: true },
    })

    await logAudit(user, 'category.create', 'Category', category.id, name)
    return ok({ category }, 201)
  } catch (err) {
    return handleError(err)
  }
}
