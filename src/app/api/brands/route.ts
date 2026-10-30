import { db } from '@/lib/db'
import { ok, handleError } from '@/lib/api'

export async function GET() {
  try {
    const brands = await db.brand.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    })
    return ok(brands)
  } catch (err) {
    return handleError(err)
  }
}
