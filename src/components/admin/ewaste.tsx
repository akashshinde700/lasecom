'use client'

//
// AdminEwasteSection — manage company e-waste pickup requests:
// list with filters, detail expansion, status transitions
// (NEW -> SCHEDULED -> COLLECTED -> CLOSED, or REJECTED) + internal note.
//

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/store'
import { formatDate, formatDateTime, parseJson } from '@/lib/format'
import { EWASTE_CATEGORY_LABEL } from '@/lib/ewaste'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, Loader2, Recycle, RefreshCcw } from 'lucide-react'

type AdminEwaste = {
  id: string
  requestNumber: string
  company: string
  contactName: string
  email: string
  phone: string
  gstin: string
  address: string
  city: string
  state: string
  pincode: string
  categories: string
  quantity: number
  unit: string
  pickupDate: string
  needCertificate: boolean
  message: string
  status: string
  adminNote: string
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  NEW: 'New',
  SCHEDULED: 'Pickup scheduled',
  COLLECTED: 'Collected',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
}

const STATUS_CLASS: Record<string, string> = {
  NEW: 'border-amber-200 bg-amber-50 text-amber-700',
  SCHEDULED: 'border-sky-200 bg-sky-50 text-sky-700',
  COLLECTED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CLOSED: 'border-stone-200 bg-stone-100 text-stone-600',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
}

export function AdminEwasteSection() {
  const [items, setItems] = useState<AdminEwaste[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>('ALL')
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')

  const limit = 20

  const load = useCallback(() => {
    const sp = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (status !== 'ALL') sp.set('status', status)
    if (q.trim()) sp.set('q', q.trim())
    api<{ items: AdminEwaste[]; total: number }>(`/api/admin/ewaste?${sp.toString()}`).then((res) => {
      if (res.ok && res.data) {
        setItems(res.data.items)
        setTotal(res.data.total)
      } else {
        setItems([])
        toast.error(res.error ?? 'Could not load e-waste requests')
      }
    })
  }, [page, status, q])

  useEffect(() => {
    load()
  }, [load])

  const openEdit = (r: AdminEwaste) => {
    setExpanded(r.id)
    setEditNote(r.adminNote ?? '')
  }

  const update = async (r: AdminEwaste, patch: { status?: string; adminNote?: string }) => {
    setBusyId(r.id)
    const res = await api(`/api/admin/ewaste/${r.id}`, { method: 'PATCH', json: patch })
    setBusyId(null)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not update request')
      return
    }
    toast.success('Request updated')
    load()
  }

  const reloadWith = (setter: () => void) => {
    setItems(null)
    setter()
  }

  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900">E-Waste Pickups</h2>
          <p className="text-xs text-stone-400">{total} request(s) from companies</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => reloadWith(load)}>
          <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search number / company / contact / email / city"
          className="w-full max-w-xs"
        />
        <Select value={status} onValueChange={(v) => { reloadWith(() => setPage(1)); setStatus(v) }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Recycle className="h-8 w-8 text-stone-300" />
            <p className="text-sm text-stone-500">No e-waste requests match these filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            const cats = parseJson<string[]>(r.categories, [])
            return (
              <Card key={r.id} className="rounded-xl border shadow-sm">
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => (expanded === r.id ? setExpanded(null) : openEdit(r))}
                    className="flex w-full flex-wrap items-center gap-3 p-4 text-left transition-colors hover:bg-stone-50"
                    aria-expanded={expanded === r.id}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-stone-700">{r.requestNumber}</span>
                        <Badge variant="outline" className={cn('text-[10px]', STATUS_CLASS[r.status] ?? '')}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                        {r.quantity ? (
                          <span className="text-xs font-semibold text-emerald-700">~{r.quantity} {r.unit === 'KG' ? 'kg' : 'units'}</span>
                        ) : null}
                        {r.needCertificate ? (
                          <Badge variant="outline" className="border-teal-200 bg-teal-50 text-[10px] text-teal-700">Certificate</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-stone-800">
                        {r.company} · {r.city} — {cats.map((c) => EWASTE_CATEGORY_LABEL[c] ?? c).join(', ')}
                      </p>
                      <p className="text-[11px] text-stone-400">{r.contactName} · {r.email} · {r.phone} · {formatDateTime(r.createdAt)}</p>
                    </div>
                    <ChevronDown className={cn('size-4 shrink-0 text-stone-400 transition-transform', expanded === r.id && 'rotate-180')} />
                  </button>

                  {expanded === r.id ? (
                    <div className="border-t border-stone-100 p-4">
                      <dl className="mb-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-stone-400">Pickup address</dt>
                          <dd className="text-stone-800">{r.address}, {r.city}{r.state ? `, ${r.state}` : ''} — {r.pincode}</dd>
                        </div>
                        <div>
                          <dt className="text-stone-400">Preferred pickup date</dt>
                          <dd className="text-stone-800">{r.pickupDate ? formatDate(r.pickupDate) : 'Flexible'}</dd>
                        </div>
                        <div>
                          <dt className="text-stone-400">GSTIN</dt>
                          <dd className="font-mono text-stone-800">{r.gstin || '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-stone-400">Recycling certificate</dt>
                          <dd className="text-stone-800">{r.needCertificate ? 'Required' : 'Not required'}</dd>
                        </div>
                      </dl>

                      {r.message ? (
                        <p className="mb-4 rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">“{r.message}”</p>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-stone-500">Note (sent to the company with status updates)</label>
                          <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="e.g. Pickup on 18 Oct, 11 am — truck no. MH12 AB 1234" />
                        </div>
                        <Button
                          size="sm"
                          className="bg-orange-600 text-white hover:bg-orange-700"
                          disabled={busyId === r.id}
                          onClick={() => update(r, { adminNote: editNote })}
                        >
                          {busyId === r.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Save note
                        </Button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.status !== 'SCHEDULED' ? (
                          <Button size="sm" variant="outline" className="border-sky-300 text-sky-700 hover:bg-sky-50" disabled={busyId === r.id} onClick={() => update(r, { status: 'SCHEDULED', adminNote: editNote })}>
                            Schedule pickup
                          </Button>
                        ) : null}
                        {r.status !== 'COLLECTED' ? (
                          <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" disabled={busyId === r.id} onClick={() => update(r, { status: 'COLLECTED', adminNote: editNote })}>
                            Mark collected
                          </Button>
                        ) : null}
                        {r.status !== 'CLOSED' ? (
                          <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => update(r, { status: 'CLOSED', adminNote: editNote })}>
                            Close
                          </Button>
                        ) : null}
                        {r.status !== 'REJECTED' ? (
                          <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" disabled={busyId === r.id} onClick={() => update(r, { status: 'REJECTED', adminNote: editNote })}>
                            Reject
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span className="text-xs text-stone-500">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      ) : null}
    </div>
  )
}
