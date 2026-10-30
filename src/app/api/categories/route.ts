import { db } from '@/lib/db'
import { ok, handleError } from '@/lib/api'

export async function GET() {
  try {
    const categories = await db.category.findMany({
      where: { active: true, parentId: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
      },
    })
    return ok(categories)
  } catch (err) {
    return handleError(err)
  }
}
