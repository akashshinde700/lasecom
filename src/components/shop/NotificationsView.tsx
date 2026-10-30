'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAppStore, api } from '@/lib/store'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle, Bell, BellOff, CheckCheck, CreditCard, Info, Loader2, Package, Store,
} from 'lucide-react'

type Notification = {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  createdAt: string
}

function typeIcon(type: string) {
  switch (type) {
    case 'ORDER':
      return { Icon: Package, cls: 'bg-orange-100 text-orange-600' }
    case 'PAYMENT':
      return { Icon: CreditCard, cls: 'bg-emerald-100 text-emerald-600' }
    case 'VENDOR':
      return { Icon: Store, cls: 'bg-violet-100 text-violet-600' }
    case 'STOCK':
      return { Icon: AlertTriangle, cls: 'bg-amber-100 text-amber-600' }
    default:
      return { Icon: Info, cls: 'bg-stone-100 text-stone-500' }
  }
}

export default function NotificationsView() {
  const user = useAppStore((s) => s.user)
  const authLoading = useAppStore((s) => s.authLoading)
  const navigate = useAppStore((s) => s.navigate)
  const params = useAppStore((s) => s.params)
  const setUnreadCount = useAppStore((s) => s.setUnreadCount)

  const [items, setItems] = useState<Notification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  /* Auth gate */
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Please login to view notifications')
      navigate('auth', { redirect: params.redirect ?? 'notifications' })
    }
  }, [authLoading, user, navigate, params.redirect])

  const load = useCallback(() => {
    api<{ items: Notification[]; unread: number }>('/api/notifications').then((res) => {
      if (!res.ok || !res.data) {
        setError(res.error ?? 'Could not load notifications')
        setItems([])
        return
      }
      setItems(res.data.items)
      setUnreadCount(res.data.unread)
    })
  }, [setUnreadCount])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const markAllRead = async () => {
    setMarkingAll(true)
    const res = await api<{ unread: number }>('/api/notifications', { method: 'POST', json: {} })
    setMarkingAll(false)
    if (!res.ok || !res.data) {
      toast.error(res.error ?? 'Could not mark as read')
      return
    }
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev)
    setUnreadCount(res.data.unread)
    toast.success('All notifications marked as read')
  }

  const markOneRead = async (n: Notification) => {
    if (n.read) return
    // optimistic update
    setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? prev)
    const res = await api<{ unread: number }>('/api/notifications', {
      method: 'POST',
      json: { ids: [n.id] },
    })
    if (res.ok && res.data) {
      setUnreadCount(res.data.unread)
    } else {
      load() // rollback on failure
    }
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-8">
        <Skeleton className="h-8 w-56" />
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    )
  }
  if (!user) return null

  const unreadLocal = (items ?? []).filter((n) => !n.read).length

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Bell className="h-6 w-6 text-orange-600" />
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Notifications</h1>
          {unreadLocal > 0 ? (
            <span className="rounded-full bg-orange-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {unreadLocal} new
            </span>
          ) : null}
        </div>
        {unreadLocal > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={markAllRead}
            disabled={markingAll}
            className="border-orange-600 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
          >
            {markingAll ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-1.5 h-3.5 w-3.5" />}
            Mark all read
          </Button>
        ) : null}
      </div>

      {error ? (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-stone-600">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </CardContent>
        </Card>
      ) : items === null ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white py-20 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-orange-50">
            <BellOff className="h-9 w-9 text-orange-400" />
          </div>
          <p className="font-medium text-stone-800">No notifications yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-stone-500">
            Order updates, payment receipts and delivery alerts will appear here.
          </p>
          <Button onClick={() => navigate('home')} className="mt-5 bg-orange-600 text-white hover:bg-orange-700">
            Start shopping
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((n) => {
            const { Icon, cls } = typeIcon(n.type)
            return (
              <button
                key={n.id}
                onClick={() => markOneRead(n)}
                aria-label={`${n.title}${n.read ? '' : ' (unread)'}`}
                className={cn(
                  'flex w-full items-start gap-3.5 rounded-xl border p-4 text-left shadow-sm transition-colors',
                  n.read ? 'border-stone-200 bg-white hover:border-stone-300' : 'border-orange-200 bg-orange-50/70 hover:border-orange-300'
                )}
              >
                <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', cls)}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={cn('text-sm', n.read ? 'font-medium text-stone-700' : 'font-bold text-stone-900')}>
                      {n.title}
                    </span>
                    {!n.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-orange-600" /> : null}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">{n.body}</span>
                  <span className="mt-1.5 block text-[11px] text-stone-400">{formatDateTime(n.createdAt)}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
