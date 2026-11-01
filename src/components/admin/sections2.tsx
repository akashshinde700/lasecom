'use client'
//
// Admin panel sections (part 2): Catalog, Coupons, Banners, Plans,
// Settlements, Customers, Reports, Audit, Settings
//

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ImageUploadButton from '@/components/shared/ImageUploadButton'
import {
  AlertTriangle,
  ArrowDownToLine,
  Check,
  Crown,
  FolderTree,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  ScrollText,
  Search,
  Store,
  Tag,
  TicketPercent,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { api } from '@/lib/store'
import { formatDate, formatDateTime, formatINR, formatINR2, parseJson } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  EmptyState,
  OwnerButton,
  OwnerSwitch,
  PageHeader,
  Pager,
  StatusChip,
  csvExport,
  initials,
} from './forms'

function RowSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-md" />
      ))}
    </div>
  )
}

// ============================================================
// CatalogSection — Categories + Brands (Tabs)
// ============================================================

type CatRow = {
  id: string
  name: string
  slug: string
  icon: string | null
  sortOrder: number
  commissionPercent: number | null
  active: boolean
  parentId: string | null
  children: CatRow[]
}

type BrandRow = { id: string; name: string; slug: string; productCount: number }

function CategoryDialog({
  open,
  onOpenChange,
  parents,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  parents: CatRow[]
  editing: CatRow | null
  onSaved: () => void
}) {
  // Form state is seeded from props; the parent remounts this dialog via `key` on open/target change.
  const [name, setName] = useState(editing?.name ?? '')
  const [parentId, setParentId] = useState('none')
  const [icon, setIcon] = useState(editing?.icon ?? '')
  const [sortOrder, setSortOrder] = useState(String(editing?.sortOrder ?? 0))
  const [commission, setCommission] = useState(
    editing?.commissionPercent != null ? String(editing.commissionPercent) : ''
  )
  const [busy, setBusy] = useState(false)

  function save() {
    if (!name.trim()) {
      toast.error('Category name is required')
      return
    }
    setBusy(true)
    const req = editing
      ? api(`/api/admin/categories/${editing.id}`, {
          method: 'PATCH',
          json: {
            name: name.trim(),
            icon,
            sortOrder: Number(sortOrder) || 0,
            commissionPercent: commission === '' ? null : Number(commission),
          },
        })
      : api('/api/admin/categories', {
          method: 'POST',
          json: {
            name: name.trim(),
            parentId: parentId === 'none' ? undefined : parentId,
            icon,
            sortOrder: Number(sortOrder) || 0,
            commissionPercent: commission === '' ? undefined : Number(commission),
          },
        })
    req.then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(editing ? 'Category updated' : 'Category created')
        onOpenChange(false)
        onSaved()
      } else {
        toast.error(res.error ?? 'Failed to save category')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit category' : 'Add category'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update name, ordering, icon or commission override.' : 'Create a root or child category for the storefront menu.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Electronics" />
          </div>
          {!editing ? (
            <div className="grid gap-1.5">
              <Label>Parent category</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None (root category)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (root category)</SelectItem>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Icon</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Smartphone" />
            </div>
            <div className="grid gap-1.5">
              <Label>Sort order</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Commission %</Label>
              <Input type="number" min="0" max="100" step="0.5" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="Default" />
            </div>
          </div>
          <p className="text-xs text-stone-400">
            Icon can be an emoji or word shown on category tiles. Commission % overrides the platform default for this category.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy} className="bg-orange-600 text-white hover:bg-orange-700">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Create category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoriesTab() {
  const [items, setItems] = useState<CatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dlgOpen, setDlgOpen] = useState(false)
  const [editing, setEditing] = useState<CatRow | null>(null)

  function fetchCats() {
    api<{ items: CatRow[] }>('/api/admin/categories').then((res) => {
      if (res.ok && res.data) setItems(res.data.items)
      else toast.error(res.error ?? 'Failed to load categories')
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchCats()
     
  }, [])

  function toggleActive(c: CatRow, active: boolean) {
    api(`/api/admin/categories/${c.id}`, { method: 'PATCH', json: { active } }).then((res) => {
      if (res.ok) {
        toast.success(`${c.name} ${active ? 'activated' : 'hidden'}`)
        fetchCats()
      } else {
        toast.error(res.error ?? 'Failed to update category')
      }
    })
  }

  const rows: { c: CatRow; depth: number }[] = []
  for (const p of items) {
    rows.push({ c: p, depth: 0 })
    for (const ch of p.children ?? []) rows.push({ c: ch, depth: 1 })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">Category tree with per-category commission overrides</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setDlgOpen(true)
          }}
          className="bg-orange-600 text-white hover:bg-orange-700"
        >
          <Plus className="size-4" /> Add Category
        </Button>
      </div>
      <Card className="rounded-xl border-stone-200 shadow-sm">
        {loading ? (
          <RowSkeleton rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<FolderTree className="size-10" />} title="No categories yet" />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Sort</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ c, depth }) => (
                  <TableRow key={c.id} className={cn(depth > 0 && 'bg-stone-50/40')}>
                    <TableCell>
                      <div className={cn('flex items-center gap-2', depth > 0 && 'pl-6')}>
                        {depth > 0 ? <span className="text-stone-300">↳</span> : null}
                        <span className="text-base leading-none">{c.icon ?? (depth === 0 ? '📁' : '·')}</span>
                        <span className="font-medium text-stone-800">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-stone-500">/{c.slug}</TableCell>
                    <TableCell>
                      {c.commissionPercent != null ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700">
                          {c.commissionPercent}%
                        </Badge>
                      ) : (
                        <span className="text-xs text-stone-400">default</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-stone-500">{c.sortOrder}</TableCell>
                    <TableCell>
                      <Switch checked={c.active} onCheckedChange={(v) => toggleActive(c, v)} aria-label={`Toggle ${c.name}`} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-stone-600"
                        onClick={() => {
                          setEditing(c)
                          setDlgOpen(true)
                        }}
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      <CategoryDialog
        key={`${dlgOpen}-${editing?.id ?? 'new'}`}
        open={dlgOpen}
        onOpenChange={setDlgOpen}
        parents={items}
        editing={editing}
        onSaved={() => fetchCats()}
      />
    </div>
  )
}

function BrandsTab() {
  const [items, setItems] = useState<BrandRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [delDlg, setDelDlg] = useState<BrandRow | null>(null)
  const [busy, setBusy] = useState(false)

  function fetchBrands() {
    api<{ items: BrandRow[] }>('/api/admin/brands').then((res) => {
      if (res.ok && res.data) setItems(res.data.items)
      else toast.error(res.error ?? 'Failed to load brands')
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchBrands()
     
  }, [])

  function addBrand() {
    if (!name.trim()) {
      toast.error('Brand name is required')
      return
    }
    setBusy(true)
    api('/api/admin/brands', { method: 'POST', json: { name: name.trim() } }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success('Brand created')
        setName('')
        setAddOpen(false)
        fetchBrands()
      } else {
        toast.error(res.error ?? 'Failed to create brand')
      }
    })
  }

  function deleteBrand() {
    if (!delDlg) return
    setBusy(true)
    api(`/api/admin/brands/${delDlg.id}`, { method: 'DELETE' }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(`Brand "${delDlg.name}" deleted`)
        setDelDlg(null)
        fetchBrands()
      } else {
        toast.error(res.error ?? 'Failed to delete brand')
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{items.length} brands — used for filters and product pages</p>
        <Button size="sm" onClick={() => setAddOpen(true)} className="bg-orange-600 text-white hover:bg-orange-700">
          <Plus className="size-4" /> Add Brand
        </Button>
      </div>
      <Card className="rounded-xl border-stone-200 shadow-sm">
        {loading ? (
          <RowSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState icon={<Tag className="size-10" />} title="No brands yet" />
        ) : (
          <div className="max-h-96 overflow-y-auto pr-2">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead>Brand</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-md bg-stone-100 text-[10px] font-bold text-stone-500">
                          {b.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-medium text-stone-800">{b.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-stone-500">/{b.slug}</TableCell>
                    <TableCell className="text-right text-sm">{b.productCount}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setDelDlg(b)}
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add brand</DialogTitle>
            <DialogDescription>Brands power catalog filters. The slug is generated automatically.</DialogDescription>
          </DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. boAt" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addBrand} disabled={busy} className="bg-orange-600 text-white hover:bg-orange-700">
              Create brand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delDlg} onOpenChange={(o) => !o && setDelDlg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete brand "{delDlg?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Brands that are used by products cannot be deleted. You will see an error if this brand is still in use.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                deleteBrand()
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete brand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function CatalogSection() {
  return (
    <div className="space-y-4">
      <PageHeader title="Catalog" description="Categories and brands that structure the marketplace" />
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">
            <FolderTree className="size-4" /> Categories
          </TabsTrigger>
          <TabsTrigger value="brands">
            <Tag className="size-4" /> Brands
          </TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-3">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="brands" className="mt-3">
          <BrandsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// CouponsSection — GET /api/admin/coupons
// ============================================================

type CouponRow = {
  id: string
  code: string
  description: string | null
  type: string
  value: number
  minOrder: number
  maxDiscount: number | null
  usageLimit: number | null
  usedCount: number
  active: boolean
  expiresAt: string | null
  createdAt: string
}

export function CouponsSection() {
  const [items, setItems] = useState<CouponRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dlgOpen, setDlgOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [delDlg, setDelDlg] = useState<CouponRow | null>(null)

  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('PERCENT')
  const [value, setValue] = useState('')
  const [minOrder, setMinOrder] = useState('')
  const [maxDiscount, setMaxDiscount] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  function fetchCoupons() {
    api<{ items: CouponRow[] }>('/api/admin/coupons').then((res) => {
      if (res.ok && res.data) setItems(res.data.items)
      else toast.error(res.error ?? 'Failed to load coupons')
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchCoupons()
     
  }, [])

  function toggle(c: CouponRow, active: boolean) {
    api(`/api/admin/coupons/${c.id}`, { method: 'PATCH', json: { active } }).then((res) => {
      if (res.ok) {
        toast.success(`${c.code} ${active ? 'activated' : 'paused'}`)
        fetchCoupons()
      } else {
        toast.error(res.error ?? 'Failed to update coupon')
      }
    })
  }

  function create() {
    const v = Number(value)
    if (!code.trim()) return toast.error('Coupon code is required')
    if (!Number.isFinite(v) || v <= 0) return toast.error('A valid value is required')
    setBusy(true)
    api('/api/admin/coupons', {
      method: 'POST',
      json: {
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        type,
        value: v,
        minOrder: minOrder ? Number(minOrder) : undefined,
        maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
        expiresAt: expiresAt || undefined,
      },
    }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(`Coupon ${code.toUpperCase()} created`)
        setDlgOpen(false)
        setCode('')
        setDescription('')
        setValue('')
        setMinOrder('')
        setMaxDiscount('')
        setUsageLimit('')
        setExpiresAt('')
        fetchCoupons()
      } else {
        toast.error(res.error ?? 'Failed to create coupon')
      }
    })
  }

  function del() {
    if (!delDlg) return
    setBusy(true)
    api(`/api/admin/coupons/${delDlg.id}`, { method: 'DELETE' }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(`Coupon ${delDlg.code} deleted`)
        setDelDlg(null)
        fetchCoupons()
      } else {
        toast.error(res.error ?? 'Failed to delete coupon')
      }
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Coupons"
        description={`${items.length} discount code${items.length === 1 ? '' : 's'} — cart-level promotions`}
        actions={
          <Button onClick={() => setDlgOpen(true)} className="bg-orange-600 text-white hover:bg-orange-700">
            <Plus className="size-4" /> Create Coupon
          </Button>
        }
      />

      <Card className="rounded-xl border-stone-200 shadow-sm">
        {loading ? (
          <RowSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState icon={<TicketPercent className="size-10" />} title="No coupons yet" hint="Create your first promo code to drive sales." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Min order</TableHead>
                  <TableHead>Cap</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm font-bold text-stone-800">{c.code}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-stone-600" title={c.description ?? ''}>
                      {c.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      {c.type === 'PERCENT' ? (
                        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-[11px] text-orange-700">
                          PERCENT %
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700">
                          FLAT ₹
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{c.type === 'PERCENT' ? `${c.value}%` : formatINR2(c.value)}</TableCell>
                    <TableCell className="text-sm text-stone-600">{c.minOrder > 0 ? formatINR(c.minOrder) : '—'}</TableCell>
                    <TableCell className="text-sm text-stone-600">{c.maxDiscount != null ? formatINR(c.maxDiscount) : '—'}</TableCell>
                    <TableCell className="text-sm">
                      {c.usedCount}/{c.usageLimit ?? '∞'}
                    </TableCell>
                    <TableCell className="text-xs text-stone-500">{c.expiresAt ? formatDate(c.expiresAt) : 'No expiry'}</TableCell>
                    <TableCell>
                      <Switch checked={c.active} onCheckedChange={(v) => toggle(c, v)} aria-label={`Toggle ${c.code}`} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setDelDlg(c)}
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create coupon</DialogTitle>
            <DialogDescription>Customers apply the code at cart; validation (min order, cap, expiry) is server-side.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="DIWALI25"
                className="font-mono uppercase"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="25% off for Diwali sale" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percent (%)</SelectItem>
                    <SelectItem value="FLAT">Flat (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{type === 'PERCENT' ? 'Value (%) *' : 'Value (₹) *'}</Label>
                <Input type="number" min="1" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Min order (₹)</Label>
                <Input type="number" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label>Max discount (₹)</Label>
                <Input type="number" min="1" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="Percent cap" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Usage limit</Label>
                <Input type="number" min="1" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Unlimited" />
              </div>
              <div className="grid gap-1.5">
                <Label>Expires on</Label>
                <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={busy} className="bg-orange-600 text-white hover:bg-orange-700">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Create coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delDlg} onOpenChange={(o) => !o && setDelDlg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete coupon {delDlg?.code}?</AlertDialogTitle>
            <AlertDialogDescription>Customers will no longer be able to apply this code. Usage history stays on past orders.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                del()
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// BannersSection — GET /api/admin/banners
// ============================================================

type BannerRow = {
  id: string
  title: string
  imageUrl: string
  link: string | null
  position: string
  sortOrder: number
  active: boolean
}

function BannerImage({ banner }: { banner: BannerRow }) {
  const [failed, setFailed] = useState(false)
  if (banner.imageUrl && !failed) {
     
    return (
      <img
        src={banner.imageUrl}
        alt={banner.title}
        className="h-28 w-full rounded-lg border border-stone-200 object-cover"
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <div className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border border-stone-200 bg-gradient-to-br from-orange-100 via-amber-50 to-stone-100 text-stone-500">
      <ImageIcon className="size-6 text-stone-400" />
      <span className="max-w-[80%] truncate text-xs font-medium">{banner.title}</span>
    </div>
  )
}

export function BannersSection() {
  const [items, setItems] = useState<BannerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dlgOpen, setDlgOpen] = useState(false)
  const [editing, setEditing] = useState<BannerRow | null>(null)
  const [delDlg, setDelDlg] = useState<BannerRow | null>(null)

  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [link, setLink] = useState('')
  const [position, setPosition] = useState('HERO')
  const [sortOrder, setSortOrder] = useState('0')

  function fetchBanners() {
    api<{ items: BannerRow[] }>('/api/admin/banners').then((res) => {
      if (res.ok && res.data) setItems(res.data.items)
      else toast.error(res.error ?? 'Failed to load banners')
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchBanners()
     
  }, [])

  function openAdd() {
    setEditing(null)
    setTitle('')
    setImageUrl('')
    setLink('')
    setPosition('HERO')
    setSortOrder('0')
    setDlgOpen(true)
  }

  function openEdit(b: BannerRow) {
    setEditing(b)
    setTitle(b.title)
    setImageUrl(b.imageUrl)
    setLink(b.link ?? '')
    setPosition(b.position)
    setSortOrder(String(b.sortOrder))
    setDlgOpen(true)
  }

  function toggle(b: BannerRow, active: boolean) {
    api(`/api/admin/banners/${b.id}`, { method: 'PATCH', json: { active } }).then((res) => {
      if (res.ok) {
        toast.success(`"${b.title}" ${active ? 'activated' : 'hidden'}`)
        fetchBanners()
      } else {
        toast.error(res.error ?? 'Failed to update banner')
      }
    })
  }

  function save() {
    if (!title.trim() || !imageUrl.trim()) {
      toast.error('Title and image URL are required')
      return
    }
    setBusy(true)
    const req = editing
      ? api(`/api/admin/banners/${editing.id}`, {
          method: 'PATCH',
          json: { title: title.trim(), imageUrl: imageUrl.trim(), link, position, sortOrder: Number(sortOrder) || 0 },
        })
      : api('/api/admin/banners', {
          method: 'POST',
          json: { title: title.trim(), imageUrl: imageUrl.trim(), link, position, sortOrder: Number(sortOrder) || 0 },
        })
    req.then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(editing ? 'Banner updated' : 'Banner created')
        setDlgOpen(false)
        fetchBanners()
      } else {
        toast.error(res.error ?? 'Failed to save banner')
      }
    })
  }

  function del() {
    if (!delDlg) return
    setBusy(true)
    api(`/api/admin/banners/${delDlg.id}`, { method: 'DELETE' }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success('Banner deleted')
        setDelDlg(null)
        fetchBanners()
      } else {
        toast.error(res.error ?? 'Failed to delete banner')
      }
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Banners"
        description={`${items.length} banner${items.length === 1 ? '' : 's'} — homepage hero & promo strips`}
        actions={
          <Button onClick={openAdd} className="bg-orange-600 text-white hover:bg-orange-700">
            <Plus className="size-4" /> Add Banner
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="rounded-xl border-stone-200 shadow-sm">
          <EmptyState icon={<ImageIcon className="size-10" />} title="No banners yet" hint="Add a HERO banner for the homepage carousel." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((b) => (
            <Card key={b.id} className="rounded-xl border-stone-200 shadow-sm">
              <CardContent className="space-y-3 p-4">
                <BannerImage banner={b} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-800" title={b.title}>
                      {b.title}
                    </p>
                    {b.link ? <p className="truncate font-mono text-[11px] text-stone-400">{b.link}</p> : null}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 text-[11px]',
                      b.position === 'HERO' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-violet-200 bg-violet-50 text-violet-700'
                    )}
                  >
                    {b.position}
                  </Badge>
                </div>
                <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                  <label className="flex items-center gap-2 text-xs text-stone-500">
                    <Switch checked={b.active} onCheckedChange={(v) => toggle(b, v)} aria-label={`Toggle ${b.title}`} />
                    Active
                  </label>
                  <span className="text-xs text-stone-400">Sort #{b.sortOrder}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-stone-600" onClick={() => openEdit(b)}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setDelDlg(b)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit banner' : 'Add banner'}</DialogTitle>
            <DialogDescription>
              Link format: <code className="rounded bg-stone-100 px-1 font-mono text-[11px]">listing:deals</code> or a category slug.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mega Diwali Sale" />
            </div>
            <div className="grid gap-1.5">
              <Label>Image *</Label>
              <ImageUploadButton label="Upload banner" onUploaded={(urls) => setImageUrl(urls[0])} />
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="…or paste an image URL" className="font-mono text-xs" />
              {imageUrl ? (
                <img src={imageUrl} alt="Banner preview" className="h-20 w-full rounded-md border border-stone-200 object-cover" />
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Link</Label>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="listing:deals or category slug" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Position</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HERO">Hero carousel</SelectItem>
                    <SelectItem value="PROMO">Promo strip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Sort order</Label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy} className="bg-orange-600 text-white hover:bg-orange-700">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {editing ? 'Save changes' : 'Create banner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delDlg} onOpenChange={(o) => !o && setDelDlg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete banner "{delDlg?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>It will be removed from the storefront immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                del()
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// PlansSection — GET /api/admin/plans (mutations owner-only)
// ============================================================

type PlanFull = {
  id: string
  name: string
  priceMonthly: number
  listingLimit: number
  commissionDiscountPercent: number
  features: string
  active: boolean
  _count?: { vendors: number }
  createdAt?: string
}

function PlanDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: PlanFull | null
  onSaved: () => void
}) {
  // Form state is seeded from props; the parent remounts this dialog via `key` on open/target change.
  const [name, setName] = useState(editing?.name ?? '')
  const [price, setPrice] = useState(String(editing?.priceMonthly ?? 0))
  const [limit, setLimit] = useState(String(editing?.listingLimit ?? 10))
  const [discount, setDiscount] = useState(String(editing?.commissionDiscountPercent ?? 0))
  const [features, setFeatures] = useState(parseJson<string[]>(editing?.features, []).join(', '))
  const [busy, setBusy] = useState(false)

  function save() {
    const p = Number(price)
    if (!name.trim()) return toast.error('Plan name is required')
    if (!Number.isFinite(p) || p < 0) return toast.error('A valid monthly price is required')
    setBusy(true)
    const body = {
      priceMonthly: p,
      listingLimit: Math.trunc(Number(limit) || 0),
      commissionDiscountPercent: Number(discount) || 0,
      features: features
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean),
    }
    const req = editing
      ? api(`/api/admin/plans/${editing.id}`, { method: 'PATCH', json: body })
      : api('/api/admin/plans', { method: 'POST', json: { name: name.trim(), ...body } })
    req.then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(editing ? 'Plan updated' : 'Plan created')
        onOpenChange(false)
        onSaved()
      } else {
        toast.error(res.error ?? 'Failed to save plan')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : 'Create plan'}</DialogTitle>
          <DialogDescription>
            Listing limit −1 means unlimited. Commission discount reduces the platform commission for vendors on this plan.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {!editing ? (
            <div className="grid gap-1.5">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Growth" />
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>₹ / month</Label>
              <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Listings</Label>
              <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="-1 = unlimited" />
            </div>
            <div className="grid gap-1.5">
              <Label>Comm. off %</Label>
              <Input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Features (comma separated)</Label>
            <Textarea
              rows={2}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder="Priority support, Analytics dashboard, Sponsored credits"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy} className="bg-orange-600 text-white hover:bg-orange-700">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {editing ? 'Save plan' : 'Create plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlansSection({ isOwner }: { isOwner: boolean }) {
  const [items, setItems] = useState<PlanFull[]>([])
  const [loading, setLoading] = useState(true)
  const [dlgOpen, setDlgOpen] = useState(false)
  const [editing, setEditing] = useState<PlanFull | null>(null)

  function fetchPlans() {
    api<{ items: PlanFull[] }>('/api/admin/plans').then((res) => {
      if (res.ok && res.data) setItems(res.data.items)
      else toast.error(res.error ?? 'Failed to load plans')
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchPlans()
     
  }, [])

  function toggle(p: PlanFull, active: boolean) {
    api(`/api/admin/plans/${p.id}`, { method: 'PATCH', json: { active } }).then((res) => {
      if (res.ok) {
        toast.success(`${p.name} ${active ? 'activated' : 'deactivated'}`)
        fetchPlans()
      } else {
        toast.error(res.error ?? 'Failed to update plan')
      }
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subscription Plans"
        description="Vendor tiers controlling listing limits and commission discounts"
        actions={
          <OwnerButton isOwner={isOwner} onClick={() => { setEditing(null); setDlgOpen(true) }} className="bg-orange-600 text-white hover:bg-orange-700">
            <Plus className="size-4" /> Create Plan
          </OwnerButton>
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map((p) => {
            const feats = parseJson<string[]>(p.features, [])
            const vendorCount = p._count?.vendors
            return (
              <Card key={p.id} className={cn('flex flex-col rounded-xl border-stone-200 shadow-sm', p.active ? '' : 'opacity-60')}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Crown className="size-4 text-amber-500" /> {p.name}
                    </CardTitle>
                    <OwnerSwitch isOwner={isOwner} checked={p.active} onCheckedChange={(v) => toggle(p, v)} aria-label={`Toggle ${p.name}`} />
                  </div>
                  <p className="text-lg font-bold text-stone-900">
                    {formatINR(p.priceMonthly)}
                    <span className="text-xs font-normal text-stone-400"> /month</span>
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="border-stone-200 bg-stone-50 text-[11px] text-stone-600">
                      {p.listingLimit === -1 ? 'Unlimited listings' : `${p.listingLimit} listings`}
                    </Badge>
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700">
                      −{p.commissionDiscountPercent}% commission
                    </Badge>
                    {vendorCount != null ? (
                      <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[11px] text-violet-700">
                        {vendorCount} vendor{vendorCount === 1 ? '' : 's'}
                      </Badge>
                    ) : null}
                  </div>
                  <ul className="flex-1 space-y-1.5">
                    {feats.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-stone-600">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" /> {f}
                      </li>
                    ))}
                  </ul>
                  <OwnerButton
                    isOwner={isOwner}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setEditing(p)
                      setDlgOpen(true)
                    }}
                  >
                    <Pencil className="size-3.5" /> Edit plan
                  </OwnerButton>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <PlanDialog key={`${dlgOpen}-${editing?.id ?? 'new'}`} open={dlgOpen} onOpenChange={setDlgOpen} editing={editing} onSaved={() => fetchPlans()} />
    </div>
  )
}

// ============================================================
// SettlementsSection — GET /api/admin/settlements
// ============================================================

type SettlementsData = {
  items: { id: string; vendorId: string; vendorName: string; amount: number; status: string; reference: string | null; createdAt: string }[]
  byVendor: { vendorId: string; vendorName: string; balance: number }[]
}

export function SettlementsSection({ isOwner }: { isOwner: boolean }) {
  const [data, setData] = useState<SettlementsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [payout, setPayout] = useState<{ vendorId: string; vendorName: string; balance: number } | null>(null)

  function fetchSettlements() {
    api<SettlementsData>('/api/admin/settlements').then((res) => {
      if (res.ok && res.data) setData(res.data)
      else toast.error(res.error ?? 'Failed to load settlements')
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchSettlements()
     
  }, [])

  function settle() {
    if (!payout) return
    setBusy(true)
    api('/api/admin/settlements', { method: 'POST', json: { vendorId: payout.vendorId } }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(`Payout to ${payout.vendorName} processed`)
        setPayout(null)
        fetchSettlements()
      } else {
        toast.error(res.error ?? 'Settlement failed')
        setPayout(null)
      }
    })
  }

  const balances = (data?.byVendor ?? []).slice().sort((a, b) => b.balance - a.balance)

  return (
    <div className="space-y-4">
      <PageHeader title="Settlements" description="Pending vendor payouts and payout history" />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Pending balances by vendor</h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : balances.length === 0 ? (
          <Card className="rounded-xl border-stone-200 shadow-sm">
            <EmptyState icon={<Store className="size-10" />} title="No vendors yet" />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {balances.map((b) => (
              <Card key={b.vendorId} className="rounded-xl border-stone-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="truncate text-sm font-medium text-stone-700" title={b.vendorName}>
                    {b.vendorName}
                  </p>
                  <p className={cn('mt-1 text-lg font-bold', b.balance > 0 ? 'text-emerald-600' : b.balance < 0 ? 'text-red-600' : 'text-stone-400')}>
                    {formatINR2(b.balance)}
                  </p>
                  <OwnerButton
                    isOwner={isOwner}
                    size="sm"
                    className="mt-2 w-full bg-orange-600 text-white hover:bg-orange-700"
                    disabled={b.balance <= 0}
                    title={b.balance <= 0 ? 'No pending balance' : undefined}
                    onClick={() => setPayout(b)}
                  >
                    <Wallet className="size-4" /> Settle Now
                  </OwnerButton>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="rounded-xl border-stone-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payout history</CardTitle>
        </CardHeader>
        {loading ? (
          <RowSkeleton rows={4} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState icon={<Wallet className="size-10" />} title="No settlements yet" hint="Processed payouts will be listed here." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-stone-800">{s.vendorName}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-700">{formatINR2(s.amount)}</TableCell>
                    <TableCell>
                      <StatusChip status={s.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.reference ?? '—'}</TableCell>
                    <TableCell className="text-xs text-stone-500">{formatDate(s.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <AlertDialog open={!!payout} onOpenChange={(o) => !o && setPayout(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm payout</AlertDialogTitle>
            <AlertDialogDescription>
              Transfer{' '}
              <span className="font-semibold text-stone-900">{formatINR2(payout?.balance ?? 0)}</span> to{' '}
              <span className="font-semibold text-stone-900">{payout?.vendorName}</span> bank account? All unsettled ledger entries
              will be marked settled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 text-white hover:bg-orange-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                settle()
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Transfer now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// CustomersSection — GET /api/admin/customers?search
// ============================================================

type AdminCustomer = {
  id: string
  name: string
  email: string
  phone: string | null
  createdAt: string
  orderCount: number
  totalSpent: number
  status: string
}

export function CustomersSection() {
  const [items, setItems] = useState<AdminCustomer[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [blockDlg, setBlockDlg] = useState<AdminCustomer | null>(null)
  const [busy, setBusy] = useState(false)

  function fetchCustomers(p = 1) {
    const q = new URLSearchParams()
    if (search.trim()) q.set('search', search.trim())
    q.set('page', String(p))
    api<{ items: AdminCustomer[]; total: number; page: number; pages: number }>(`/api/admin/customers?${q.toString()}`).then((res) => {
      if (res.ok && res.data) {
        setItems(res.data.items)
        setTotal(res.data.total)
        setPage(res.data.page)
        setPages(res.data.pages)
      } else {
        toast.error(res.error ?? 'Failed to load customers')
      }
      setLoading(false)
    })
  }

  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(1), search ? 300 : 0)
    return () => clearTimeout(t)
     
  }, [search])

  function toggleBlock() {
    if (!blockDlg) return
    const next = blockDlg.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE'
    setBusy(true)
    api(`/api/admin/customers/${blockDlg.id}/block-toggle`, { method: 'POST', json: { status: next } }).then((res) => {
      setBusy(false)
      if (res.ok) {
        toast.success(next === 'BLOCKED' ? `${blockDlg.name} blocked` : `${blockDlg.name} unblocked`)
        setBlockDlg(null)
        fetchCustomers(page)
      } else {
        toast.error(res.error ?? 'Failed to update customer')
      }
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Customers" description={`${total} registered customer${total === 1 ? '' : 's'}`} />

      <div className="relative w-full lg:w-80">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="pl-8" />
      </div>

      <Card className="rounded-xl border-stone-200 shadow-sm">
        {loading ? (
          <RowSkeleton rows={8} />
        ) : items.length === 0 ? (
          <EmptyState icon={<Users className="size-10" />} title="No customers found" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow className="bg-stone-50/60">
                    <TableHead>Customer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Total spent</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-700">
                            {initials(c.name)}
                          </span>
                          <span className="font-medium text-stone-800">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-stone-600">{c.email}</TableCell>
                      <TableCell className="text-sm text-stone-600">{c.phone ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{c.orderCount}</TableCell>
                      <TableCell className="text-right font-semibold text-stone-800">{formatINR(c.totalSpent)}</TableCell>
                      <TableCell className="text-xs text-stone-500">{formatDate(c.createdAt)}</TableCell>
                      <TableCell>
                        <StatusChip status={c.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {c.status === 'ACTIVE' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setBlockDlg(c)}
                          >
                            Block
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setBlockDlg(c) }}>
                            Unblock
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 pb-3">
              <Pager page={page} pages={pages} onPage={(p) => { setLoading(true); fetchCustomers(p) }} />
            </div>
          </>
        )}
      </Card>

      <AlertDialog open={!!blockDlg} onOpenChange={(o) => !o && setBlockDlg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{blockDlg?.status === 'ACTIVE' ? `Block ${blockDlg?.name}?` : `Unblock ${blockDlg?.name}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {blockDlg?.status === 'ACTIVE'
                ? 'They will not be able to log in or place orders until unblocked. Existing orders are unaffected.'
                : 'They will be able to log in and shop again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(blockDlg?.status === 'ACTIVE' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-emerald-600 text-white hover:bg-emerald-700')}
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                toggleBlock()
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {blockDlg?.status === 'ACTIVE' ? 'Block customer' : 'Unblock customer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================================
// ReportsSection — GET /api/admin/reports?type&from&to
// ============================================================

const REPORT_TYPES = [
  { value: 'sales', label: 'Sales by day' },
  { value: 'vendors', label: 'Vendor performance' },
  { value: 'settlements', label: 'Settlement history' },
  { value: 'inventory', label: 'Inventory valuation' },
]

type ReportData = { title: string; columns: string[]; rows: (string | number)[][] }

export function ReportsSection() {
  const [type, setType] = useState('sales')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  function generate() {
    setLoading(true)
    const q = new URLSearchParams({ type })
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    api<ReportData>(`/api/admin/reports?${q.toString()}`).then((res) => {
      setLoading(false)
      if (res.ok && res.data) setReport(res.data)
      else toast.error(res.error ?? 'Failed to generate report')
    })
  }

  function download() {
    if (!report) return
    const fname = report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'report'
    csvExport(`${fname}.csv`, report.columns, report.rows)
    toast.success('CSV downloaded')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" description="Generate CSV-ready operational reports" />

      <Card className="rounded-xl border-stone-200 shadow-sm">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          <div className="grid gap-1.5">
            <Label>Report type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={generate} disabled={loading} className="flex-1 bg-orange-600 text-white hover:bg-orange-700">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}
              Generate
            </Button>
            {report ? (
              <Button variant="outline" onClick={download} disabled={loading}>
                Download CSV
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {report ? (
        <Card className="rounded-xl border-stone-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{report.title}</CardTitle>
            <Badge variant="outline" className="border-stone-200 bg-stone-50 text-[11px] text-stone-600">
              {report.rows.length} row{report.rows.length === 1 ? '' : 's'}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-50/60">
                      {report.columns.map((c) => (
                        <TableHead key={c} className={cn(/amount|total|value|sales|earning|gmv|shipping|discount/i.test(c) && 'text-right')}>
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={report.columns.length} className="py-8 text-center text-sm text-stone-400">
                          No data for this period
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {report.rows.map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell
                            key={j}
                            className={cn(
                              typeof cell === 'number' && /amount|total|value|sales|earning|gmv|shipping|discount/i.test(report.columns[j] ?? '') && 'text-right font-medium'
                            )}
                          >
                            {typeof cell === 'number' && /gmv|sales|total|value|earning|amount/i.test(report.columns[j] ?? '')
                              ? formatINR2(cell)
                              : String(cell)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl border-stone-200 shadow-sm">
          <EmptyState
            icon={<AlertTriangle className="size-10" />}
            title="No report generated yet"
            hint="Pick a report type and date range, then press Generate. Defaults cover the last 30 days."
          />
        </Card>
      )}
    </div>
  )
}

// ============================================================
// AuditSection — GET /api/admin/audit
// ============================================================

type AuditRow = {
  id: string
  actorName: string
  action: string
  entity: string
  entityId: string | null
  detail: string | null
  createdAt: string
}

function actionChipClass(action: string): string {
  const a = action.toLowerCase()
  if (a.includes('delete')) return 'border-red-200 bg-red-50 text-red-700'
  if (a.includes('create')) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (a.includes('status') || a.includes('block')) return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

export function AuditSection() {
  const [items, setItems] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<{ items: AuditRow[] }>('/api/admin/audit').then((res) => {
      if (res.ok && res.data) setItems(res.data.items)
      else toast.error(res.error ?? 'Failed to load audit log')
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-4">
      <PageHeader title="Audit Log" description="Latest 100 privileged actions performed in the admin panel" />

      <Card className="rounded-xl border-stone-200 shadow-sm">
        {loading ? (
          <RowSkeleton rows={10} />
        ) : items.length === 0 ? (
          <EmptyState icon={<ScrollText className="size-10" />} title="No audit entries yet" />
        ) : (
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            <div className="overflow-x-auto">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow className="bg-stone-50/60">
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[10px] font-bold text-stone-500">
                            {initials(a.actorName)}
                          </span>
                          <span className="text-sm font-medium text-stone-700">{a.actorName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('font-mono text-[11px]', actionChipClass(a.action))}>
                          {a.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-stone-600">
                        {a.entity}
                        {a.entityId ? <span className="font-mono text-[11px] text-stone-400"> · {a.entityId.slice(-8)}</span> : null}
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[320px] truncate text-xs text-stone-500" title={a.detail ?? ''}>
                          {a.detail ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-stone-500">{formatDateTime(a.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// ============================================================
// SettingsSection — GET /api/admin/settings, PATCH (owner only)
// ============================================================

const NUMERIC_KEYS = ['platform.commissionPercent', 'shipping.baseFee', 'shipping.freeThreshold', 'shipping.perKg', 'shipping.codFee']

const SETTING_LABELS: Record<string, string> = {
  'site.name': 'Site name',
  'site.announcement': 'Announcement bar text',
  'platform.commissionPercent': 'Default commission (%)',
  'shipping.baseFee': 'Base shipping fee (₹)',
  'shipping.freeThreshold': 'Free shipping above (₹)',
  'shipping.perKg': 'Per-kg shipping fee (₹)',
  'shipping.codFee': 'COD fee (₹)',
  'product.autoApprove': 'Auto-approve vendor products',
  'cod.enabled': 'Cash on Delivery',
  'business.legalName': 'Legal / company name',
  'business.gstin': 'GSTIN',
  'business.pan': 'PAN',
  'business.address': 'Registered address',
  'business.city': 'City',
  'business.state': 'State',
  'business.pincode': 'Pincode',
  'business.phone': 'Phone',
  'business.email': 'Email',
  'bank.accountName': 'Account holder name',
  'bank.bankName': 'Bank name',
  'bank.accountNumber': 'Account number',
  'bank.ifsc': 'IFSC',
  'bank.branch': 'Branch',
  'invoice.gstRate': 'GST rate (%) — prices are GST-inclusive',
  'invoice.terms': 'Terms & conditions (one per line)',
}

export function SettingsSection({ isOwner }: { isOwner: boolean }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<{ settings: Record<string, string> }>('/api/admin/settings').then((res) => {
      if (res.ok && res.data) setForm(res.data.settings ?? {})
      else toast.error(res.error ?? 'Failed to load settings')
      setLoading(false)
    })
  }, [])

  function setKey(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function save() {
    const gst = (form['invoice.gstRate'] ?? '').trim()
    if (gst !== '' && (Number.isNaN(Number(gst)) || Number(gst) < 0 || Number(gst) > 40)) {
      toast.error('GST rate must be a number between 0 and 40')
      return
    }
    for (const k of NUMERIC_KEYS) {
      const v = (form[k] ?? '').trim()
      if (v === '' || Number.isNaN(Number(v))) {
        toast.error(`${SETTING_LABELS[k] ?? k} must be a valid number`)
        return
      }
    }
    setSaving(true)
    api<{ settings: Record<string, string> }>('/api/admin/settings', { method: 'PATCH', json: { settings: form } }).then((res) => {
      setSaving(false)
      if (res.ok) {
        toast.success('Settings saved — live on the storefront')
        if (res.data?.settings) setForm(res.data.settings)
      } else {
        toast.error(res.error ?? 'Failed to save settings')
      }
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Settings" description="Platform branding, money, shipping and feature toggles" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const textField = (k: string, type = 'text') => (
    <div className="grid gap-1.5">
      <Label htmlFor={`set-${k}`}>{SETTING_LABELS[k] ?? k}</Label>
      <Input
        id={`set-${k}`}
        type={type}
        value={form[k] ?? ''}
        onChange={(e) => setKey(k, e.target.value)}
        disabled={!isOwner}
        className="max-w-xs"
      />
    </div>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Platform branding, money, shipping and feature toggles"
        actions={
          <OwnerButton isOwner={isOwner} onClick={save} disabled={saving} className="bg-orange-600 text-white hover:bg-orange-700">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save settings
          </OwnerButton>
        }
      />

      {!isOwner ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          Read-only: owner permission required. You can review values but not change them.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {textField('site.name')}
            <div className="grid gap-1.5">
              <Label htmlFor="set-announcement">{SETTING_LABELS['site.announcement']}</Label>
              <Textarea
                id="set-announcement"
                rows={2}
                value={form['site.announcement'] ?? ''}
                onChange={(e) => setKey('site.announcement', e.target.value)}
                disabled={!isOwner}
                placeholder="🎉 Big Diwali Sale — up to 70% off!"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Money</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {textField('platform.commissionPercent', 'number')}
            <p className="text-xs text-stone-400">
              Fallback commission for vendor items (product → category → vendor → this value). Affects new orders only.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Shipping</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {textField('shipping.baseFee', 'number')}
            {textField('shipping.freeThreshold', 'number')}
            {textField('shipping.perKg', 'number')}
            {textField('shipping.codFee', 'number')}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Feature toggles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(['product.autoApprove', 'cod.enabled'] as const).map((k) => (
              <div key={k} className="flex items-center justify-between gap-4 rounded-lg border border-stone-100 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-stone-700">{SETTING_LABELS[k]}</p>
                  <p className="text-xs text-stone-400">
                    {k === 'product.autoApprove' ? 'New vendor products go live without review' : 'Allow Cash on Delivery at checkout'}
                  </p>
                </div>
                <Switch
                  checked={(form[k] ?? '') === 'true'}
                  onCheckedChange={(v) => setKey(k, v ? 'true' : 'false')}
                  disabled={!isOwner}
                  aria-label={SETTING_LABELS[k]}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-stone-200 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-stone-700">Business &amp; invoice details</CardTitle>
            <p className="text-xs text-stone-400">
              Printed on tax invoices, proforma invoices, quotations, purchase orders and purchase returns.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {textField('business.legalName')}
              {textField('business.gstin')}
              {textField('business.pan')}
              {textField('business.phone')}
              {textField('business.email', 'email')}
              {textField('invoice.gstRate', 'number')}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="set-business-address">{SETTING_LABELS['business.address']}</Label>
              <Textarea
                id="set-business-address"
                rows={2}
                value={form['business.address'] ?? ''}
                onChange={(e) => setKey('business.address', e.target.value)}
                disabled={!isOwner}
                placeholder="Office no., building, street, area"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {textField('business.city')}
              {textField('business.state')}
              {textField('business.pincode')}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Bank details (on proforma &amp; quotation)</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {textField('bank.accountName')}
                {textField('bank.bankName')}
                {textField('bank.accountNumber')}
                {textField('bank.ifsc')}
                {textField('bank.branch')}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="set-invoice-terms">{SETTING_LABELS['invoice.terms']}</Label>
              <Textarea
                id="set-invoice-terms"
                rows={4}
                value={form['invoice.terms'] ?? ''}
                onChange={(e) => setKey('invoice.terms', e.target.value)}
                disabled={!isOwner}
                placeholder={'Goods once sold will not be taken back except under the return policy.\nSubject to Pune jurisdiction.'}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
