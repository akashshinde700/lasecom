import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { UPLOAD_CONTENT_TYPE, UPLOAD_NAME_RE, uploadDir } from '@/lib/uploads'

/** GET /api/files/:name — serve an uploaded image. Names are random and immutable. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!UPLOAD_NAME_RE.test(name)) return new Response('Not found', { status: 404 })
  try {
    const data = await readFile(path.join(/*turbopackIgnore: true*/ uploadDir(), name))
    const ext = name.split('.').pop() as string
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': UPLOAD_CONTENT_TYPE[ext],
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
