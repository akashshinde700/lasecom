'use client'

//
// ImageUploadButton — pick image(s), shrink each to <= 200 KB in the browser
// if needed, upload to /api/upload and hand back the served URL(s).
// The server enforces the same 200 KB limit.
//

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, Upload } from 'lucide-react'

export const MAX_IMAGE_BYTES = 200 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image')) }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Re-encode (WebP, falling back to JPEG) with lower quality / size until it fits. */
async function shrinkToLimit(file: File): Promise<Blob> {
  if (file.size <= MAX_IMAGE_BYTES) return file
  const img = await loadImage(file)
  let scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image compression is not supported in this browser')

  for (let round = 0; round < 8; round++) {
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    ctx.fillStyle = '#ffffff' // flatten transparency for JPEG fallback
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const q of [0.85, 0.72, 0.6, 0.48]) {
      const blob = (await toBlob(canvas, 'image/webp', q)) ?? (await toBlob(canvas, 'image/jpeg', q))
      if (blob && blob.type !== 'image/png' && blob.size <= MAX_IMAGE_BYTES) return blob
    }
    scale *= 0.75
  }
  throw new Error('Could not compress this image under 200 KB — try a smaller image')
}

export async function uploadImage(file: File): Promise<string> {
  if (!ACCEPT.split(',').includes(file.type)) throw new Error('Only JPG, PNG, WebP or GIF images are allowed')
  const blob = await shrinkToLimit(file)
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : file.name.split('.').pop()
  const form = new FormData()
  form.append('file', blob, `upload.${ext}`)
  const res = await fetch('/api/upload', { method: 'POST', body: form, credentials: 'include' })
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { url: string }; error?: string } | null
  if (!res.ok || !json?.ok || !json.data) throw new Error(json?.error ?? 'Upload failed')
  return json.data.url
}

export default function ImageUploadButton({
  onUploaded,
  multiple = false,
  label = 'Upload image',
}: {
  onUploaded: (urls: string[]) => void
  multiple?: boolean
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      try {
        urls.push(await uploadImage(file))
      } catch (err) {
        toast.error(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`)
      }
    }
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
    if (urls.length) {
      onUploaded(urls)
      toast.success(urls.length === 1 ? 'Image uploaded' : `${urls.length} images uploaded`)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {busy ? 'Uploading…' : label}
      </Button>
      <span className="text-[11px] text-stone-400">JPG, PNG, WebP or GIF · max 200 KB (larger photos are compressed automatically)</span>
    </div>
  )
}
