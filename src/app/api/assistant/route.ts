import { NextRequest } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { ok, handleError, HttpError } from '@/lib/api'

/**
 * POST /api/assistant — AI Shopping Assistant (server-side only).
 * Body: { messages: [{ role: 'user' | 'assistant', content: string }] }
 *
 * Uses z-ai-web-dev-sdk chat completions with a live catalog snapshot in the
 * system prompt, so the assistant can recommend real products (including
 * refurbished), explain B2B/quote flow and payment options. Never exposes the
 * SDK to the client; falls back to a helpful canned reply if the model fails.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      messages?: { role?: string; content?: string }[]
    }
    const history = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => (m.content ?? '').trim().length > 0)
      .slice(-8)
      .map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: String(m.content).slice(0, 1200),
      }))
    if (history.length === 0) throw new HttpError('Message is required', 400)

    // Build a compact catalog snapshot for grounding
    const products = await db.product.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ soldCount: 'desc' }, { rating: 'desc' }],
      take: 40,
      select: {
        title: true,
        slug: true,
        price: true,
        mrp: true,
        stock: true,
        condition: true,
        refurbGrade: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
      },
    })
    const catalog = products
      .map(
        (p) =>
          `- ${p.title} | ${p.category?.name ?? 'Misc'} | ${p.brand?.name ?? 'Generic'} | ₹${p.price} (MRP ₹${p.mrp}) | ${
            p.condition === 'REFURBISHED' ? `Refurbished (${p.refurbGrade ?? 'GOOD'})` : 'New'
          } | Stock: ${p.stock}`
      )
      .join('\n')

    const categories = await db.category.findMany({
      where: { active: true, parentId: null },
      select: { name: true },
      orderBy: { sortOrder: 'asc' },
      take: 12,
    })

    const systemPrompt = `You are "Kart AI", the friendly shopping assistant for Lastrivon Kart India — a multi-vendor marketplace for new AND refurbished electronics & lifestyle products.

CATALOG SNAPSHOT (top products by popularity):
${catalog || '(catalog unavailable right now)'}

MAIN CATEGORIES: ${categories.map((c) => c.name).join(', ') || 'Electronics, Fashion, Home'}

PLATFORM FACTS you can rely on:
- Products come in two conditions: Brand New and Refurbished (graded Excellent / Good / Fair, quality-checked with warranty).
- Payments: Razorpay (UPI, cards, netbanking, wallets), other UPI/card/netbanking options, and Cash on Delivery (small handling fee). Free delivery above ₹499.
- B2B / bulk buyers: businesses can request bulk quotes with GST invoicing via the "For Business" page or the "Request Bulk Quote" button on any product; admins respond with a custom quotation.
- Customers can track orders, request returns within 7 days of delivery, and save items to a wishlist.

RULES:
- LANGUAGE (very important): ALWAYS reply in the SAME language the customer's latest message uses. English → English. Hindi/Hinglish (Roman script) → Hinglish. Hindi (Devanagari) → Hindi. NEVER reply in Chinese or any other language unless the customer writes in it.
- Keep replies SHORT (2-5 sentences or a compact list) and mobile-friendly.
- When recommending, mention at most 3 products with their price and condition, and nudge: "open the Products page and search '<keyword>'".
- For big/unknown quantities, price negotiations, or GST invoices, suggest the B2B quote request.
- Never invent products that are not in the snapshot; if unsure, say you will connect them to search/filter instead.
- Never make up order statuses — for order questions, point the customer to My Orders.`

    const zai = await ZAI.create()
    // System prompt MUST go as role 'system' — sending it as 'assistant' makes
    // the model treat it as past conversation, weakening language/format rules.
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt } as { role: 'system'; content: string },
        ...history,
      ],
      thinking: { type: 'disabled' },
    })
    const reply = completion.choices[0]?.message?.content?.trim()
    if (!reply) throw new Error('Empty AI response')

    return ok({ reply })
  } catch (err) {
    // Graceful fallback — the assistant must never hard-fail the UI
    console.error('[assistant-error]', err)
    if (err instanceof HttpError) return handleError(err)
    return ok({
      reply:
        'Sorry, I am having trouble connecting right now. Please try again in a moment — or use the search bar and the Products page to explore items. For bulk/B2B needs, the For Business page has a quote request form.',
    })
  }
}
