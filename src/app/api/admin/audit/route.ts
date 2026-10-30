import { db } from '@/lib/db'
import { ok, handleError, requireAdmin } from '@/lib/api'

// ---------------- GET: latest 100 audit logs ----------------
export async function GET() {
  try {
    await requireAdmin()
    const rows = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return ok({
      items: rows.map((r) => ({
        id: r.id,
        actorName: r.actorName,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        detail: r.detail,
        createdAt: r.createdAt,
      })),
    })
  } catch (err) {
    return handleError(err)
  }
}
