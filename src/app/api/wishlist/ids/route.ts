import { db } from '@/lib/db'
import { ok, handleError, requireUser } from '@/lib/api'

export async function GET() {
  try {
    const user = await requireUser()
    const items = await db.wishlistItem.findMany({
      where: { userId: user.id },
      select: { productId: true },
    })
    return ok({ ids: items.map((i) => i.productId) })
  } catch (err) {
    return handleError(err)
  }
}
