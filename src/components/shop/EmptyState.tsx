'use client'

import type { ReactNode } from 'react'
import { ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
  className?: string
}

/**
 * Shared empty-state panel: dashed card with blurred gradient blobs,
 * icon bubble, title/description and optional primary + secondary actions.
 */
export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-dashed bg-white/60 p-8 text-center sm:p-12',
        className
      )}
    >
      {/* decorative blurred blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-orange-200/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-14 -right-10 h-44 w-44 rounded-full bg-amber-200/40 blur-3xl"
      />

      <div className="relative">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          {icon ?? <ShoppingBag className="h-7 w-7" />}
        </div>
        <h2 className="mt-4 text-base font-semibold text-stone-900">{title}</h2>
        {description ? (
          <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">{description}</p>
        ) : null}
        {actionLabel ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button
              onClick={onAction}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {actionLabel}
            </Button>
            {secondaryLabel ? (
              <Button
                variant="ghost"
                onClick={onSecondary}
                className="text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              >
                {secondaryLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
