import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, handleError, HttpError, requireAdmin, requirePlatformAdmin, logAudit } from '@/lib/api'

// ---------------- GET: all settings ----------------
export async function GET() {
  try {
    await requireAdmin()
    const rows = await db.setting.findMany()
    const settings: Record<string, string> = {}
    for (const r of rows) settings[r.key] = r.value
    return ok({ settings })
  } catch (err) {
    return handleError(err)
  }
}

// ---------------- PATCH: upsert settings (PLATFORM_ADMIN only) ----------------
export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePlatformAdmin()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const settings = body.settings
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw new HttpError('settings object is required', 400)
    }

    const entries = Object.entries(settings as Record<string, unknown>).filter(([k]) => k.trim() !== '')
    if (entries.length === 0) throw new HttpError('No settings provided', 400)

    for (const [key, value] of entries) {
      const strValue = typeof value === 'string' ? value : String(value ?? '')
      await db.setting.upsert({
        where: { key },
        create: { key, value: strValue },
        update: { value: strValue },
      })
    }

    await logAudit(user, 'settings.update', 'Setting', undefined, entries.map(([k]) => k).join(', ').slice(0, 200))

    const rows = await db.setting.findMany()
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    return ok({ settings: map })
  } catch (err) {
    return handleError(err)
  }
}
