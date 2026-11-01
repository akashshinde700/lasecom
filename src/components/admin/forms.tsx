'use client'
//
// Admin panel — shared dialogs, owner-gated controls and small helpers.
// Used by AdminApp.tsx, sections.tsx and sections2.tsx.
//

import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import ImageUploadButton from '@/components/shared/ImageUploadButton'
import { Loader2, Lock, Package, Plus, Trash2, X } from 'lucide-react'
import { api } from '@/lib/store'
import { statusColor } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ============================================================
// CSV export util
// ============================================================

export function csvExport(filename: string, columns: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const raw = String(v ?? '')
    const safe = typeof v === 'string' && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
    return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe
  }
  const lines = [columns.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))]
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ============================================================
// Tiny shared UI helpers
// ============================================================

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function StatusChip({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
        statusColor(status),
        className
      )}
    >
      {label ?? status}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-stone-900">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-stone-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="text-stone-300">{icon ?? <Package className="size-10" />}</div>
      <p className="text-sm font-medium text-stone-600">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-stone-400">{hint}</p> : null}
    </div>
  )
}

export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (p: number) => void
}) {
  if (pages <= 1) return null
  const windowed: number[] = []
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) windowed.push(p)
  return (
    <div className="flex items-center justify-end gap-1.5 pt-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Prev
      </Button>
      {windowed[0] > 1 ? <span className="px-1 text-xs text-stone-400">…</span> : null}
      {windowed.map((p) => (
        <Button
          key={p}
          variant={p === page ? 'default' : 'outline'}
          size="sm"
          className={p === page ? 'bg-orange-600 hover:bg-orange-700' : ''}
          onClick={() => onPage(p)}
        >
          {p}
        </Button>
      ))}
      {windowed[windowed.length - 1] < pages ? <span className="px-1 text-xs text-stone-400">…</span> : null}
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  )
}

// ============================================================
// Owner-gated controls (PLATFORM_STAFF sees disabled + tooltip)
// ============================================================

const OWNER_LOCK_MSG = 'Read-only: owner permission required'

type BtnProps = React.ComponentProps<typeof Button>

export function OwnerButton({ isOwner, ...props }: BtnProps & { isOwner: boolean }) {
  if (isOwner) return <Button {...props} />
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          <Button disabled {...props} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{OWNER_LOCK_MSG}</TooltipContent>
    </Tooltip>
  )
}

export function OwnerDropdownItem({
  isOwner,
  onSelect,
  destructive,
  children,
}: {
  isOwner: boolean
  onSelect?: () => void
  destructive?: boolean
  children: ReactNode
}) {
  if (isOwner) {
    return (
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault()
          onSelect?.()
        }}
        className={destructive ? 'text-red-600 focus:text-red-600 focus:bg-red-50' : ''}
      >
        {children}
      </DropdownMenuItem>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-not-allowed">
          <DropdownMenuItem disabled className="text-stone-400">
            {children}
            <Lock className="ml-auto size-3" />
          </DropdownMenuItem>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left">{OWNER_LOCK_MSG}</TooltipContent>
    </Tooltip>
  )
}

export function OwnerSwitch({
  isOwner,
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
}: {
  isOwner: boolean
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  'aria-label'?: string
}) {
  if (isOwner) {
    return <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={ariaLabel} />
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          <Switch checked={checked} disabled aria-label={ariaLabel} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{OWNER_LOCK_MSG}</TooltipContent>
    </Tooltip>
  )
}

// ============================================================
// ProductFormDialog — create a PLATFORM (1P) product
// POST /api/admin/products
// ============================================================

type CatNode = { id: string; name: string; children?: CatNode[] }
type BrandOpt = { id: string; name: string }
type SpecRow = { key: string; value: string }

export function ProductFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [cats, setCats] = useState<CatNode[]>([])
  const [brands, setBrands] = useState<BrandOpt[]>([])
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('none')
  const [price, setPrice] = useState('')
  const [mrp, setMrp] = useState('')
  const [cost, setCost] = useState('')
  const [stock, setStock] = useState('10')
  const [weight, setWeight] = useState('500')
  const [freeShipping, setFreeShipping] = useState(false)
  const [condition, setCondition] = useState('NEW')
  const [refurbGrade, setRefurbGrade] = useState('GOOD')
  const [refurbNote, setRefurbNote] = useState('')
  const [imagesText, setImagesText] = useState('')
  const [specs, setSpecs] = useState<SpecRow[]>([{ key: '', value: '' }])

  useEffect(() => {
    if (!open) return
    api<CatNode[]>('/api/categories').then((res) => {
      if (res.ok && res.data) setCats(Array.isArray(res.data) ? res.data : [])
    })
    api<BrandOpt[]>('/api/brands').then((res) => {
      if (res.ok && res.data) setBrands(Array.isArray(res.data) ? res.data : [])
    })
  }, [open])

  const imageUrls = imagesText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  function reset() {
    setTitle('')
    setDescription('')
    setCategoryId('')
    setBrandId('none')
    setPrice('')
    setMrp('')
    setCost('')
    setStock('10')
    setWeight('500')
    setFreeShipping(false)
    setCondition('NEW')
    setRefurbGrade('GOOD')
    setRefurbNote('')
    setImagesText('')
    setSpecs([{ key: '', value: '' }])
  }

  function submit() {
    if (!title.trim() || !description.trim() || !categoryId) {
      toast.error('Title, description and category are required')
      return
    }
    const p = Number(price)
    if (!Number.isFinite(p) || p <= 0) {
      toast.error('A valid price is required')
      return
    }
    setSaving(true)
    api('/api/admin/products', {
      method: 'POST',
      json: {
        title: title.trim(),
        description: description.trim(),
        categoryId,
        brandId: brandId === 'none' ? undefined : brandId,
        price: p,
        mrp: mrp ? Number(mrp) : undefined,
        cost: cost ? Number(cost) : undefined,
        stock: Number(stock) || 0,
        weightGrams: Number(weight) || 500,
        freeShipping,
        condition,
        ...(condition === 'REFURBISHED' ? { refurbGrade, refurbNote: refurbNote.trim() } : {}),
        images: imageUrls,
        specs: Object.fromEntries(specs.filter((r) => r.key.trim() !== '').map((r) => [r.key.trim(), r.value.trim()])),
      },
    }).then((res) => {
      setSaving(false)
      if (res.ok) {
        toast.success('Platform product created')
        reset()
        onOpenChange(false)
        onCreated()
      } else {
        toast.error(res.error ?? 'Could not create product')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Platform Product (1P)</DialogTitle>
          <DialogDescription>
            Sold & fulfilled by Lastrivon Retail. It goes live immediately with status ACTIVE.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wireless Noise-Cancelling Headphones" />
          </div>
          <div className="grid gap-1.5">
            <Label>Description *</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key features, materials, warranty…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Category *</Label>
              <Select value={categoryId || undefined} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  {cats.flatMap((c) =>
                    (c.children ?? []).map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        ↳ {ch.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Brand</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No brand</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="grid gap-1.5">
              <Label>Price (₹) *</Label>
              <Input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="2999" />
            </div>
            <div className="grid gap-1.5">
              <Label>MRP (₹)</Label>
              <Input type="number" min="1" value={mrp} onChange={(e) => setMrp(e.target.value)} placeholder="4999" />
            </div>
            <div className="grid gap-1.5">
              <Label>Cost (₹)</Label>
              <Input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="1800" />
            </div>
            <div className="grid gap-1.5">
              <Label>Stock</Label>
              <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Weight (grams)</Label>
              <Input type="number" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={freeShipping} onCheckedChange={setFreeShipping} aria-label="Free shipping" />
              Free shipping
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Brand new" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">✨ Brand New</SelectItem>
                  <SelectItem value="REFURBISHED">♻ Refurbished (Renewed)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {condition === 'REFURBISHED' ? (
              <div className="grid gap-1.5">
                <Label>Refurb grade</Label>
                <Select value={refurbGrade} onValueChange={setRefurbGrade}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Good" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXCELLENT">Excellent — like new</SelectItem>
                    <SelectItem value="GOOD">Good — light signs of use</SelectItem>
                    <SelectItem value="FAIR">Fair — visible signs of use</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          {condition === 'REFURBISHED' ? (
            <div className="grid gap-1.5">
              <Label>Refurb note (what's included / warranty)</Label>
              <Textarea
                rows={2}
                value={refurbNote}
                onChange={(e) => setRefurbNote(e.target.value)}
                maxLength={500}
                placeholder="e.g. 6-month Lastrivon Kart warranty. Charger and cable included."
              />
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label>Images</Label>
            <ImageUploadButton multiple label="Upload images" onUploaded={(urls) => setImagesText((t) => [t.trim(), ...urls].filter(Boolean).join('\n'))} />
            <Textarea
              rows={3}
              value={imagesText}
              onChange={(e) => setImagesText(e.target.value)}
              placeholder={'Uploaded images appear here — or paste image URLs, one per line'}
              className="font-mono text-xs"
            />
            {imageUrls.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {imageUrls.map((u, i) => (
                   
                  <img
                    key={i}
                    src={u}
                    alt={`Preview ${i + 1}`}
                    className="size-14 rounded-md border border-stone-200 bg-stone-50 object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.opacity = '0.15'
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Specifications</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-orange-600 hover:text-orange-700"
                onClick={() => setSpecs([...specs, { key: '', value: '' }])}
              >
                <Plus className="size-3.5" /> Add row
              </Button>
            </div>
            <div className="space-y-1.5">
              {specs.map((row, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    value={row.key}
                    onChange={(e) =>
                      setSpecs(specs.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))
                    }
                    placeholder="Warranty"
                    className="flex-1"
                  />
                  <Input
                    value={row.value}
                    onChange={(e) =>
                      setSpecs(specs.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                    }
                    placeholder="1 year"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-stone-400 hover:text-red-600"
                    aria-label="Remove spec row"
                    onClick={() => setSpecs(specs.filter((_, j) => j !== i))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="bg-orange-600 text-white hover:bg-orange-700">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Create product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// ConfirmRow — small shared confirm dialog driver helper (data type)
// ============================================================

export type ConfirmState = { title: string; description: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void } | null
