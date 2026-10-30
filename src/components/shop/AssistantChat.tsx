'use client'

//
// AssistantChat — floating "Kart AI" shopping assistant (storefront only).
// Talks to POST /api/assistant which grounds the LLM on the live catalog.
//

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Bot, Loader2, SendHorizonal, Sparkles, X } from 'lucide-react'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Best refurbished laptop under ₹30k?',
  'Bulk discount on 50 phones?',
  'Payment options & COD charges?',
]

export default function AssistantChat() {
  const view = useAppStore((s) => s.view)
  const user = useAppStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Hide on vendor/admin panels
  const isPanel = view === 'vendor-panel' || view === 'admin-panel'

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open, busy])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (isPanel) return null

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || busy) return
    const next: Msg[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-8) }),
      })
      const json = await res.json()
      setMessages([
        ...next,
        { role: 'assistant', content: json?.ok ? json.data.reply : 'Sorry, I could not answer right now. Please try again.' },
      ])
    } catch {
      setMessages([
        ...next,
        { role: 'assistant', content: 'Network hiccup — please try again in a moment.' },
      ])
    } finally {
      setBusy(false)
    }
  }

  const greeting: Msg = {
    role: 'assistant',
    content: `Hi${user ? ' ' + user.name.split(' ')[0] : ''}! 👋 I am Kart AI. Ask me about products, refurbished grades, bulk/B2B quotes or payments.`,
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        className={cn(
          'fixed bottom-20 right-4 z-[60] flex size-12 items-center justify-center rounded-full bg-stone-900 text-white shadow-lg transition-transform hover:scale-105 sm:bottom-6',
          open && 'scale-0 opacity-0'
        )}
      >
        <Sparkles className="size-5" />
      </button>

      {/* Panel */}
      {open ? (
        <div className="fixed bottom-20 right-4 z-[70] flex h-[28rem] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl sm:bottom-6 sm:right-6">
          {/* header */}
          <div className="flex items-center justify-between bg-stone-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-orange-600">
                <Bot className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">Kart AI</p>
                <p className="text-[10px] leading-tight text-stone-300">Shopping assistant · online</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-full p-1.5 text-stone-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="max-h-full flex-1 space-y-3 overflow-y-auto bg-stone-50 p-3">
            {[greeting, ...messages].map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
                    m.role === 'user'
                      ? 'rounded-br-md bg-orange-600 text-white'
                      : 'rounded-bl-md border border-stone-200 bg-white text-stone-700'
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-stone-200 bg-white px-3.5 py-2.5 text-xs text-stone-400">
                  <Loader2 className="size-3.5 animate-spin" /> Kart AI is thinking…
                </div>
              </div>
            ) : null}
            {messages.length === 0 && !busy ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-medium text-stone-600 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* input */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
            className="flex items-center gap-2 border-t border-stone-200 bg-white p-2.5"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about products, quotes, payments…"
              className="flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs outline-none focus:border-orange-400 focus:bg-white"
              aria-label="Message"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send message"
              className="flex size-9 items-center justify-center rounded-full bg-orange-600 text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              <SendHorizonal className="size-4" />
            </button>
          </form>
        </div>
      ) : null}
    </>
  )
}
