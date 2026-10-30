import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, logAudit } from '@/lib/api'

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'brand'
  )
}

// ---------------- GET: all brands ----------------
export async function GET() {
  try {
    await requireAdmin()
    const items = await db.brand.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    })
    return ok({ items: items.map((b) => ({ id: b.id, name: b.name, slug: b.slug, productCount: b._count.products })) })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- POST: create brand ----------------
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) throw new HttpError('Brand name is required', 400)

    const base = slugify(name)
    let slug = base
    let attempt = 1
    while (await db.brand.findUnique({ where: { slug } })) {
      attempt += 1
      slug = `${base}-${attempt}`
    }

    const brand = await db.brand.create({ data: { name, slug } })
    await logAudit(user, 'brand.create', 'Brand', brand.id, name)
    return ok({ brand }, 201)
  } catch (err) {
    return handleError(err)
  }
}
