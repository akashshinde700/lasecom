'use client'

// PwaProvider — registers the service worker and shows a smart install banner.
// Android/Chrome: uses the native beforeinstallprompt flow (one-tap install).
// iOS Safari:     shows "Share → Add to Home Screen" guidance (the only iOS install path).

import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'lk-install-banner-dismissed'
const SHOW_DELAY_MS = 4000

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari exposes navigator.standalone when launched from Home Screen
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export default function PwaProvider() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // 1) Register the service worker (all platforms)
    if ('serviceWorker' in navigator) {
      const register = () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
          /* SW is a progressive enhancement — never break the app over it */
        })
      }
      if (document.readyState === 'complete') register()
      else {
        window.addEventListener('load', register, { once: true })
        return () => window.removeEventListener('load', register)
      }
    }
  }, [])

  useEffect(() => {
    // 2) Never show the banner inside an installed app / if dismissed recently
    if (isStandalone()) return
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      /* private mode — fall through */
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    if (isIos()) {
      const t = setTimeout(() => setShowIosHint(true), SHOW_DELAY_MS)
      return () => clearTimeout(t)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setVisible(false)
    setShowIosHint(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') dismiss()
  }

  if (!visible && !showIosHint) return null

  return (
    <div
      role="dialog"
      aria-label="Install Lastrivon Kart app"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-orange-200 bg-white/95 p-3 shadow-xl backdrop-blur animate-in slide-in-from-bottom-4 fade-in duration-300 lg:bottom-4 lg:left-auto lg:right-4 lg:mx-0"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-inner">
        <Smartphone className="h-5 w-5" aria-hidden="true" />
      </div>

      {showIosHint && !installEvent ? (
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-stone-700">
          <span className="font-semibold text-stone-900">Install Lastrivon Kart on iPhone:</span>{' '}
          tap the <span aria-hidden="true">⎋</span> <span className="font-medium">Share</span> icon in Safari, then{' '}
          <span className="font-medium">&ldquo;Add to Home Screen&rdquo;</span>.
        </p>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stone-900">Install Lastrivon Kart</p>
          <p className="text-xs text-stone-500">One-tap shopping, works offline, like an app.</p>
        </div>
      )}

      {installEvent && (
        <Button size="sm" className="shrink-0 rounded-full bg-orange-600 hover:bg-orange-700" onClick={install}>
          Install
        </Button>
      )}

      <button
        onClick={dismiss}
        aria-label="Dismiss install banner"
        className="shrink-0 rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
