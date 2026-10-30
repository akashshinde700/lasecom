import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { ok, handleError, HttpError, requireUser } from '@/lib/api'
import { MAX_UPLOAD_BYTES, sniffImage, uploadDir } from '@/lib/uploads'

const ALLOWED_ROLES = ['PLATFORM_ADMIN', 'PLATFORM_STAFF', 'VENDOR_ADMIN', 'VENDOR_STAFF']

/**
 * POST /api/upload — multipart form with a single `file` field.
 * Admins and vendors only. JPG / PNG / WebP / GIF, max 200 KB.
 * Returns { url } served by GET /api/files/:name.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    if (!ALLOWED_ROLES.includes(user.role)) throw new HttpError('Only admins and vendors can upload images', 403)

    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!file || typeof file === 'string') throw new HttpError('No file uploaded', 400)
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new HttpError(`Image must be 200 KB or smaller (this one is ${Math.ceil(file.size / 1024)} KB)`, 400)
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const ext = sniffImage(buf)
    if (!ext) throw new HttpError('Only JPG, PNG, WebP or GIF images are allowed', 400)

    const name = `${randomBytes(16).toString('hex')}.${ext}`
    const dir = uploadDir()
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, name), buf)

    return ok({ url: `/api/files/${name}`, size: buf.length })
  } catch (err) {
    return handleError(err)
  }
}
