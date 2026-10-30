'use client'

//
// AdminQuotesSection — manage customer RFQs and B2B inquiries:
// list with filters, detail expansion, status transitions
// (OPEN -> QUOTED -> ACCEPTED/CLOSED), quoted total + note.
//

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/store'
import { formatINR, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, Download, FileSearch, Loader2, RefreshCcw } from 'lucide-react'
import { openDocument, type DocRequestKind } from '@/lib/documents'

type AdminQuote = {
  id: string
  quoteNumber: string
  kind: string
  name: string
  company: string
  email: string
  phone: string
  gstin: string
  message: string
  status: string
  quotedTotal: number | null
  quoteNote: string | null
  createdAt: string
  items: { id: string; titleSnapshot: string; condition: string; qty: number; unitPrice: number; targetPrice: number | null }[]
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  QUOTED: 'Quoted',
  ACCEPTED: 'Accepted',
  CLOSED: 'Closed',
}

const STATUS_CLASS: Record<string, string> = {
  OPEN: 'border-amber-200 bg-amber-50 text-amber-700',
  QUOTED: 'border-sky-200 bg-sky-50 text-sky-700',
  ACCEPTED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CLOSED: 'border-stone-200 bg-stone-100 text-stone-600',
}

export function AdminQuotesSection() {
  const [items, setItems] = useState<AdminQuote[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>('ALL')
  const [kind, setKind] = useState<string>('ALL')
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editTotal, setEditTotal] = useState('')
  const [editNote, setEditNote] = useState('')

  const limit = 20

  const load = useCallback(() => {
    const sp = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (status !== 'ALL') sp.set('status', status)
    if (kind !== 'ALL') sp.set('kind', kind)
    if (q.trim()) sp.set('q', q.trim())
    api<{ items: AdminQuote[]; total: number }>(`/api/admin/quotes?${sp.toString()}`).then((res) => {
      if (res.ok && res.data) {
        setItems(res.data.items)
        setTotal(res.data.total)
      } else {
        setItems([])
        toast.error(res.error ?? 'Could not load quotes')
      }
    })
  }, [page, status, kind, q])

  useEffect(() => {
    load()
  }, [load])

  const openEdit = (quote: AdminQuote) => {
    setExpanded(quote.id)
    setEditTotal(quote.quotedTotal !== null ? String(quote.quotedTotal) : '')
    setEditNote(quote.quoteNote ?? '')
  }

  const update = async (quote: AdminQuote, patch: { status?: string; quotedTotal?: number; quoteNote?: string }) => {
    setBusyId(quote.id)
    const res = await api<{ quote: AdminQuote }>(`/api/admin/quotes/${quote.id}`, { method: 'PATCH', json: patch })
    setBusyId(null)
    if (!res.ok || !res.data) {
      toast.error(res.error ?? 'Could not update quote')
      return
    }
    toast.success('Quote updated')
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
          <h2 className="text-lg font-bold text-stone-900">Quotes & B2B Inquiries</h2>
          <p className="text-xs text-stone-400">{total} request(s) — respond within 24 hrs SLA</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => reloadWith(() => {})}>
          <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search number / name / company / email / phone"
          className="w-full max-w-xs"
        />
        <Select value={status} onValueChange={(v) => { reloadWith(() => setPage(1)); setStatus(v) }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="QUOTED">Quoted</SelectItem>
            <SelectItem value="ACCEPTED">Accepted</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(v) => { reloadWith(() => setPage(1)); setKind(v) }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All kinds</SelectItem>
            <SelectItem value="CUSTOMER">Customer RFQ</SelectItem>
            <SelectItem value="B2B">B2B inquiry</SelectItem>
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
            <FileSearch className="h-8 w-8 text-stone-300" />
            <p className="text-sm text-stone-500">No quote requests match these filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((quote) => (
            <Card key={quote.id} className="rounded-xl border shadow-sm">
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => (expanded === quote.id ? setExpanded(null) : openEdit(quote))}
                  className="flex w-full flex-wrap items-center gap-3 p-4 text-left transition-colors hover:bg-stone-50"
                  aria-expanded={expanded === quote.id}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-stone-700">{quote.quoteNumber}</span>
                      <Badge
                        variant="outline"
                        className={cn('text-[10px]', quote.kind === 'B2B' ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-stone-200 bg-stone-50 text-stone-600')}
                      >
                        {quote.kind === 'B2B' ? 'B2B' : 'Customer'}
                      </Badge>
                      <Badge variant="outline" className={cn('text-[10px]', STATUS_CLASS[quote.status] ?? '')}>
                        {STATUS_LABEL[quote.status] ?? quote.status}
                      </Badge>
                      {quote.quotedTotal !== null ? (
                        <span className="text-xs font-semibold text-emerald-700">{formatINR(quote.quotedTotal)}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-stone-800">
                      {quote.name}{quote.company ? ` · ${quote.company}` : ''} — {quote.items.length > 0 ? `${quote.items.length} item(s), ${quote.items.reduce((s, i) => s + i.qty, 0)} units` : 'general inquiry'}
                    </p>
                    <p className="text-[11px] text-stone-400">{quote.email} · {quote.phone} · {formatDateTime(quote.createdAt)}</p>
                  </div>
                  <ChevronDown className={cn('size-4 shrink-0 text-stone-400 transition-transform', expanded === quote.id && 'rotate-180')} />
                </button>

                {expanded === quote.id ? (
                  <div className="border-t border-stone-100 p-4">
                    {/* items */}
                    {quote.items.length > 0 ? (
                      <div className="mb-4 overflow-x-auto rounded-lg border border-stone-200">
                        <table className="w-full text-xs">
                          <thead className="bg-stone-50 text-left text-stone-500">
                            <tr>
                              <th className="px-3 py-2 font-medium">Product</th>
                              <th className="px-3 py-2 font-medium">Condition</th>
                              <th className="px-3 py-2 text-right font-medium">Qty</th>
                              <th className="px-3 py-2 text-right font-medium">List ₹</th>
                              <th className="px-3 py-2 text-right font-medium">Target ₹</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quote.items.map((it) => (
                              <tr key={it.id} className="border-t border-stone-100">
                                <td className="max-w-[240px] truncate px-3 py-2 text-stone-800">{it.titleSnapshot}</td>
                                <td className="px-3 py-2">
                                  {it.condition === 'REFURBISHED' ? (
                                    <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">♻ Refurb</span>
                                  ) : (
                                    <span className="text-stone-500">New</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-medium">{it.qty}</td>
                                <td className="px-3 py-2 text-right text-stone-500">{it.unitPrice ? formatINR(it.unitPrice) : '—'}</td>
                                <td className="px-3 py-2 text-right text-stone-500">{it.targetPrice ? formatINR(it.targetPrice) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {quote.message ? (
                      <p className="mb-4 rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">“{quote.message}”</p>
                    ) : null}

                    {/* quote editor */}
                    <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-stone-500">Quoted total (₹)</label>
                        <Input value={editTotal} onChange={(e) => setEditTotal(e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 499000" inputMode="decimal" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-stone-500">Note to customer</label>
                        <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="e.g. Includes GST + insured shipping, valid 7 days" />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-orange-600 text-white hover:bg-orange-700"
                          disabled={busyId === quote.id}
                          onClick={() =>
                            update(quote, {
                              quotedTotal: editTotal ? Number(editTotal) : 0,
                              quoteNote: editNote,
                            })
                          }
                        >
                          {busyId === quote.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Save
                        </Button>
                      </div>
                    </div>

                    {/* documents */}
                    {quote.quotedTotal !== null && quote.quotedTotal > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-medium text-stone-500">Documents:</span>
                        {([
                          ['quotation', 'Quotation'],
                          ['quote-proforma', 'Proforma Invoice'],
                          ['customer-po', 'Customer PO'],
                        ] as [DocRequestKind, string][]).map(([kind, label]) => (
                          <Button
                            key={kind}
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={kind !== 'quotation' && !['QUOTED', 'ACCEPTED'].includes(quote.status)}
                            onClick={async () => {
                              const res = await openDocument(kind, quote.id)
                              if (!res.ok) toast.error(res.error ?? 'Could not generate the document')
                            }}
                          >
                            <Download className="h-3 w-3" /> {label}
                          </Button>
                        ))}
                      </div>
                    ) : null}

                    {/* status actions */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {quote.status !== 'QUOTED' ? (
                        <Button size="sm" variant="outline" className="border-sky-300 text-sky-700 hover:bg-sky-50" disabled={busyId === quote.id} onClick={() => update(quote, { status: 'QUOTED' })}>
                          Mark Quoted
                        </Button>
                      ) : null}
                      {quote.status !== 'ACCEPTED' ? (
                        <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" disabled={busyId === quote.id} onClick={() => update(quote, { status: 'ACCEPTED' })}>
                          Mark Accepted
                        </Button>
                      ) : null}
                      {quote.status !== 'CLOSED' ? (
                        <Button size="sm" variant="outline" disabled={busyId === quote.id} onClick={() => update(quote, { status: 'CLOSED' })}>
                          Close
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
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
