'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '@/lib/store'
import { parseJson, formatINR, statusColor } from '@/lib/format'
import { toast } from 'sonner'
import ImageUploadButton from '@/components/shared/ImageUploadButton'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  Store,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ============================================================
// Shared types
// ============================================================

export type VendorProduct = {
  id: string
  title: string
  description: string
  images: string
  specs: string | null
  price: number
  mrp: number
  cost: number | null
  stock: number
  lowStockThreshold: number
  status: string
  rejectionReason: string | null
  rating: number
  reviewCount: number
  soldCount: number
  weightGrams: number
  freeShipping: boolean
  condition: string
  refurbGrade: string | null
  refurbNote: string | null
  categoryId: string
  category: { id: string; name: string; slug: string } | null
  brandId: string | null
  brand: { id: string; name: string; slug: string } | null
  variants: { id: string; name: string; sku: string; price: number | null; stock: number }[]
}

export type CategoryOption = { id: string; label: string }
export type BrandOption = { id: string; name: string }

// ============================================================
// Shared UI bits
// ============================================================

export function humanStatus(s: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'Active',
    PENDING_REVIEW: 'Pending Review',
    DRAFT: 'Draft',
    ARCHIVED: 'Archived',
    REJECTED: 'Rejected',
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    PROCESSING: 'Processing',
    PACKED: 'Packed',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    APPROVED: 'Approved',
    REFUNDED: 'Refunded',
    PROCESSED: 'Processed',
    RETURN_REQUESTED: 'Return Requested',
  }
  return map[s] ?? s.charAt(0) + s.slice(1).toLowerCase()
}

export function StatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <Badge className={cn('border-transparent font-medium', statusColor(status), className)}>
      {humanStatus(status)}
    </Badge>
  )
}

export function StockChip({ stock, threshold }: { stock: number; threshold?: number }) {
  const th = threshold ?? 5
  const cls =
    stock <= 0
      ? 'bg-red-100 text-red-700'
      : stock <= th
        ? 'bg-red-100 text-red-700'
        : stock <= 10
          ? 'bg-amber-100 text-amber-700'
          : 'bg-emerald-100 text-emerald-700'
  const label = stock <= 0 ? 'Out of stock' : stock <= th ? `Low · ${stock}` : `${stock} in stock`
  return <Badge className={cn('border-transparent font-medium', cls)}>{label}</Badge>
}

export function firstImage(imagesJson: string | null | undefined): string | null {
  const arr = parseJson<unknown>(imagesJson, [])
  if (Array.isArray(arr)) {
    for (const s of arr) {
      if (typeof s === 'string' && s.trim() !== '') return s
    }
  }
  return null
}

export function ProductThumb({
  src,
  title,
  className,
}: {
  src?: string | null
  title: string
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const url = src && src.trim() !== '' ? src : null
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-100 text-stone-400',
        className
      )}
    >
      {url && !broken ? (
        <img src={url} alt={title} className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <Store className="h-4 w-4" aria-hidden />
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon
  title: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-stone-700">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-stone-500">{hint}</p> : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  )
}

export function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="p-0">
        <EmptyState icon={AlertTriangle} title="Something went wrong" hint={message}>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </EmptyState>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Product add / edit dialog
// ============================================================

type SpecRow = { k: string; v: string }
type VariantRow = { name: string; price: string; stock: string }

export function ProductFormDialog({
  product,
  categories,
  brands,
  onClose,
  onSaved,
}: {
  product: VendorProduct | null
  categories: CategoryOption[]
  brands: BrandOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!product

  const [title, setTitle] = useState(product?.title ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '')
  const [brandId, setBrandId] = useState<string>(product?.brandId ?? 'none')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [mrp, setMrp] = useState(product ? String(product.mrp) : '')
  const [cost, setCost] = useState(product?.cost != null ? String(product.cost) : '')
  const [stock, setStock] = useState(product ? String(product.stock) : '0')
  const [weightGrams, setWeightGrams] = useState(product ? String(product.weightGrams ?? 500) : '500')
  const [freeShipping, setFreeShipping] = useState(product?.freeShipping ?? false)
  const [condition, setCondition] = useState(product?.condition === 'REFURBISHED' ? 'REFURBISHED' : 'NEW')
  const [refurbGrade, setRefurbGrade] = useState(product?.refurbGrade ?? 'GOOD')
  const [refurbNote, setRefurbNote] = useState(product?.refurbNote ?? '')
  const [imagesText, setImagesText] = useState(() => {
    if (!product) return ''
    return parseJson<string[]>(product.images, [])
      .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
      .join('\n')
  })
  const [specRows, setSpecRows] = useState<SpecRow[]>(() => {
    const parsed = parseJson<Record<string, unknown>>(product?.specs ?? null, {})
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
      return Object.entries(parsed)
        .slice(0, 8)
        .map(([k, v]) => ({ k, v: String(v) }))
    }
    return [{ k: '', v: '' }]
  })
  const [variantRows, setVariantRows] = useState<VariantRow[]>([{ name: '', price: '', stock: '' }])
  const [busy, setBusy] = useState(false)

  const previewUrls = useMemo(
    () =>
      imagesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4),
    [imagesText]
  )

  function setSpecRow(i: number, patch: Partial<SpecRow>) {
    setSpecRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function removeSpecRow(i: number) {
    setSpecRows((rows) => rows.filter((_, idx) => idx !== i))
  }
  function setVariantRow(i: number, patch: Partial<VariantRow>) {
    setVariantRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function removeVariantRow(i: number) {
    setVariantRows((rows) => rows.filter((_, idx) => idx !== i))
  }

  async function submit() {
    const priceNum = Number(price)
    const mrpNum = Number(mrp)
    if (!title.trim()) {
      toast.error('Product title is required')
      return
    }
    if (!description.trim()) {
      toast.error('Product description is required')
      return
    }
    if (!categoryId) {
      toast.error('Please choose a category')
      return
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error('Enter a valid selling price')
      return
    }
    if (Number.isFinite(mrpNum) && mrpNum > 0 && priceNum > mrpNum) {
      toast.error('Price cannot be greater than MRP')
      return
    }

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      categoryId,
      brandId: brandId === 'none' ? null : brandId,
      price: priceNum,
      mrp: Number.isFinite(mrpNum) && mrpNum > 0 ? mrpNum : priceNum,
      stock: Math.max(0, Math.floor(Number(stock) || 0)),
      weightGrams: Math.max(0, Math.floor(Number(weightGrams) || 0)),
      freeShipping,
      condition,
      ...(condition === 'REFURBISHED' ? { refurbGrade, refurbNote: refurbNote.trim() || '' } : {}),
      images: imagesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    }
    if (cost.trim() !== '' && Number(cost) > 0) payload.cost = Number(cost)

    const specObj: Record<string, string> = {}
    for (const r of specRows) {
      if (r.k.trim()) specObj[r.k.trim()] = r.v.trim()
    }
    if (Object.keys(specObj).length > 0) payload.specs = specObj

    if (!isEdit) {
      const variants = variantRows
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim(),
          price: r.price.trim() !== '' && Number(r.price) > 0 ? Number(r.price) : undefined,
          stock: Math.max(0, Math.floor(Number(r.stock) || 0)),
        }))
      if (variants.length > 0) payload.variants = variants
    }

    setBusy(true)
    const res = isEdit
      ? await api(`/api/vendor/products/${product.id}`, { method: 'PATCH', json: payload })
      : await api('/api/vendor/products', { method: 'POST', json: payload })
    setBusy(false)

    if (res.ok) {
      toast.success(isEdit ? 'Product updated' : 'Product created')
      onSaved()
      onClose()
    } else {
      toast.error(res.error ?? 'Could not save the product')
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit product' : 'Add new product'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the product details below.'
              : 'Fill in the product details. New listings may require platform review before going live.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basics */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="p-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cotton Kurta Set — Midnight Blue"
                maxLength={140}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-desc">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="p-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Materials, fit, care instructions, what is included…"
                rows={3}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Category <span className="text-red-500">*</span>
                </Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {categories.length === 0 ? (
                      <SelectItem value="__loading" disabled>
                        Loading categories…
                      </SelectItem>
                    ) : (
                      categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Select value={brandId} onValueChange={setBrandId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No brand" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
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
          </div>

          {/* Pricing & inventory */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Pricing &amp; inventory</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-price">
                  Selling price (₹) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="p-price"
                  type="number"
                  min="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="999"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-mrp">MRP (₹)</Label>
                <Input
                  id="p-mrp"
                  type="number"
                  min="1"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  placeholder="Shown struck through"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-cost">Cost price (optional, platform use)</Label>
                <Input
                  id="p-cost"
                  type="number"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="Your procurement cost"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-stock">Stock (units)</Label>
                <Input
                  id="p-stock"
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-weight">Package weight (grams)</Label>
                <Input
                  id="p-weight"
                  type="number"
                  min="0"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch id="p-freeship" checked={freeShipping} onCheckedChange={setFreeShipping} />
                <Label htmlFor="p-freeship" className="cursor-pointer text-sm">
                  Free shipping
                  <span className="block text-xs font-normal text-stone-400">
                    You absorb the delivery fee for this product
                  </span>
                </Label>
              </div>
            </div>

            {/* Condition (New / Refurbished) */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
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
                <p className="text-xs text-stone-400">
                  Refurbished = restored used item, fully tested before sale
                </p>
              </div>
              {condition === 'REFURBISHED' ? (
                <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <Label htmlFor="p-refurb-note">Refurb note (what's included / warranty)</Label>
                <Textarea
                  id="p-refurb-note"
                  value={refurbNote}
                  onChange={(e) => setRefurbNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="e.g. 6-month seller warranty. Charger and cable included; original box not included."
                />
              </div>
            ) : null}
          </div>

          {/* Media */}
          <div className="space-y-1.5">
            <Label htmlFor="p-images">Images</Label>
            <ImageUploadButton multiple label="Upload images" onUploaded={(urls) => setImagesText((t) => [t.trim(), ...urls].filter(Boolean).join('\n'))} />
            <Textarea
              id="p-images"
              value={imagesText}
              onChange={(e) => setImagesText(e.target.value)}
              placeholder={'Uploaded images appear here — or paste image URLs, one per line'}
              rows={3}
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {previewUrls.map((u, i) => (
                <ProductThumb key={i} src={u} title={`Image ${i + 1}`} className="h-16 w-16" />
              ))}
              {previewUrls.length === 0 && (
                <p className="text-xs text-stone-400">No images yet — a placeholder is shown on the storefront.</p>
              )}
            </div>
          </div>

          {/* Specifications */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Specifications</Label>
              <span className="text-xs text-stone-400">{specRows.length}/8</span>
            </div>
            <div className="space-y-2">
              {specRows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                  <Input
                    value={r.k}
                    onChange={(e) => setSpecRow(i, { k: e.target.value })}
                    placeholder="Label (e.g. Material)"
                  />
                  <Input
                    value={r.v}
                    onChange={(e) => setSpecRow(i, { v: e.target.value })}
                    placeholder="Value (e.g. 100% Cotton)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-stone-400 hover:text-red-600"
                    onClick={() => removeSpecRow(i)}
                    aria-label="Remove specification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {specRows.length < 8 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSpecRows((rows) => [...rows, { k: '', v: '' }])}
              >
                <Plus /> Add specification
              </Button>
            )}
          </div>

          {/* Variants */}
          <div className="space-y-2">
            <Label>Variants</Label>
            {isEdit ? (
              <div className="space-y-2">
                {product.variants.length === 0 ? (
                  <p className="text-sm text-stone-400">This product has no variants.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((v) => (
                      <span key={v.id} className="rounded-lg border bg-stone-50 px-2.5 py-1 text-xs">
                        <span className="font-medium text-stone-700">{v.name}</span>
                        <span className="text-stone-500">
                          {' '}
                          · {v.price != null ? formatINR(v.price) : 'base price'} · {v.stock} in stock
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-stone-400">Variants are created with the product and cannot be edited afterwards.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-stone-400">
                  Sizes, colours or packs — e.g. M / Navy. Leave price blank to inherit the product price.
                </p>
                <div className="space-y-2">
                  {variantRows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1.4fr_1fr_0.8fr_auto] items-center gap-2">
                      <Input
                        value={r.name}
                        onChange={(e) => setVariantRow(i, { name: e.target.value })}
                        placeholder="Name (e.g. M / Navy)"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={r.price}
                        onChange={(e) => setVariantRow(i, { price: e.target.value })}
                        placeholder="₹ optional"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={r.stock}
                        onChange={(e) => setVariantRow(i, { stock: e.target.value })}
                        placeholder="Stock"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-stone-400 hover:text-red-600"
                        onClick={() => removeVariantRow(i)}
                        aria-label="Remove variant"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVariantRows((rows) => [...rows, { name: '', price: '', stock: '' }])}
                >
                  <Plus /> Add variant
                </Button>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="bg-orange-600 text-white hover:bg-orange-700" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Stock adjustment dialog
// ============================================================

export function AdjustStockDialog({
  product,
  onClose,
  onSaved,
}: {
  product: { id: string; title: string; stock: number }
  onClose: () => void
  onSaved: () => void
}) {
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const deltaNum = Math.trunc(Number(delta))
  const valid = Number.isFinite(deltaNum) && deltaNum !== 0
  const newStock = Math.max(0, product.stock + (valid ? deltaNum : 0))

  async function submit() {
    if (!valid) {
      toast.error('Enter a non-zero adjustment, e.g. 10 or -3')
      return
    }
    setBusy(true)
    const res = await api<{ id: string; stock: number; applied: number }>(
      `/api/vendor/products/${product.id}/stock`,
      { method: 'POST', json: { delta: deltaNum, reason: reason.trim() } }
    )
    setBusy(false)
    if (res.ok && res.data) {
      toast.success(`Stock updated: ${res.data.applied >= 0 ? '+' : ''}${res.data.applied} → ${res.data.stock} units`)
      onSaved()
      onClose()
    } else {
      toast.error(res.error ?? 'Could not adjust stock')
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription className="line-clamp-1">{product.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border bg-stone-50 px-4 py-3">
            <span className="text-sm text-stone-500">Current stock</span>
            <span className="text-lg font-semibold text-stone-900">{product.stock} units</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-delta">Adjustment (+/- units)</Label>
            <Input
              id="s-delta"
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. 10 or -3"
              autoFocus
            />
            <p className="text-xs text-stone-400">
              Negative values reduce stock. Stock cannot go below zero.
              {valid ? (
                <span className="font-medium text-stone-600"> New stock: {newStock} units.</span>
              ) : null}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-reason">Reason</Label>
            <Input
              id="s-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Received new inventory"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="bg-orange-600 text-white hover:bg-orange-700" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Apply adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
