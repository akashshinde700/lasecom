import { db } from '@/lib/db'
import { ok, handleError, requireUser } from '@/lib/api'

export async function DELETE(_req: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { productId } = await params
    const user = await requireUser()

    await db.wishlistItem.deleteMany({ where: { userId: user.id, productId } })
    return ok({ removed: true })
  } catch (err) {
    return handleError(err)
  }
}
