import path from 'path'

/** Max size of any uploaded image, enforced on the server (client compresses to fit). */
export const MAX_UPLOAD_BYTES = 200 * 1024

/** Uploads live outside the build output so a rebuild never deletes them. */
export function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'data-uploads')
}

export const UPLOAD_NAME_RE = /^[a-f0-9]{32}\.(jpg|png|webp|gif)$/

export const UPLOAD_CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

/** Detect the image type from its magic bytes; never trust the client's MIME type. */
export function sniffImage(buf: Buffer): 'jpg' | 'png' | 'webp' | 'gif' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString('ascii'))) return 'gif'
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
  return null
}
