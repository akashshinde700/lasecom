'use client'

//
// B2BView — "Lastrivon Business" landing page: bulk buying benefits, volume
// discount tiers, process, testimonials, FAQ and CTA into the quote flow.
//

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  FileText,
  Headset,
  Laptop,
  PackageCheck,
  Percent,
  Quote as QuoteIcon,
  Recycle,
  Rocket,
  ShieldCheck,
  Smartphone,
  Truck,
  Wallet,
} from 'lucide-react'

const TIERS = [
  { range: '5 – 19 units', discount: '3%', note: 'Starter bulk savings' },
  { range: '20 – 49 units', discount: '7%', note: 'Growing teams' },
  { range: '50 – 99 units', discount: '12%', note: 'Department rollouts' },
  { range: '100+ units', discount: 'Custom', note: 'Enterprise contracts' },
]

const BENEFITS = [
  { icon: Percent, title: 'Volume pricing', desc: 'Tiered discounts that beat list price — the more you buy, the more you save.' },
  { icon: FileText, title: 'GST invoicing', desc: 'Input-tax-credit ready GST invoices on every order, with your company details.' },
  { icon: Headset, title: 'Dedicated manager', desc: 'One point of contact for quotations, samples, dispatch and after-sales.' },
  { icon: Truck, title: 'Priority dispatch', desc: 'B2B orders jump the queue with tracked, insured bulk shipping pan-India.' },
  { icon: Recycle, title: 'Refurbished fleet deals', desc: 'Quality-checked renewed laptops & phones — cut CapEx up to 40% vs new.' },
  { icon: Wallet, title: 'Easy payments', desc: 'Razorpay (UPI/cards/netbanking), bank transfer and COD for eligible accounts.' },
]

const STEPS = [
  { n: 1, title: 'Tell us your requirement', desc: 'Use the quote form — search products, set quantities and target prices, or just describe what you need.' },
  { n: 2, title: 'Get a custom quotation', desc: 'Our B2B desk responds within 24 business hours with pricing, stock and delivery timelines.' },
  { n: 3, title: 'Confirm & pay', desc: 'Accept the quote and pay via Razorpay, bank transfer or negotiated terms. GST invoice included.' },
  { n: 4, title: 'Track to your doorstep', desc: 'Priority dispatch with tracking; your account manager stays with you till delivery.' },
]

const TESTIMONIALS = [
  {
    quote: 'Equipped our new office with 60 renewed ThinkPads through a single quote. Saved nearly 38% versus buying new — GST paperwork was flawless.',
    name: 'IT Procurement Head', org: 'Fintech startup, Bengaluru',
  },
  {
    quote: 'The B2B desk replies the same day. Monthly phone orders with custom pricing and priority dispatch — exactly how procurement should work.',
    name: 'Purchase Manager', org: 'Retail chain, Pune',
  },
]

const FAQS = [
  { q: 'What is the minimum order quantity for B2B pricing?', a: 'Volume discounts start at just 5 units of any product. For 100+ units we build a custom enterprise quotation with dedicated stock allocation.' },
  { q: 'Do you provide GST invoices?', a: 'Yes. Every B2B order ships with a GST invoice using your registered GSTIN, ready for input tax credit. Share your GSTIN in the quote form.' },
  { q: 'Are refurbished units covered by warranty?', a: 'Absolutely. Refurbished devices are graded (Excellent / Good / Fair), pass a 21-point quality check, and come with a 6–12 month seller warranty depending on the grade.' },
  { q: 'What payment options are available for businesses?', a: 'Pay online via Razorpay (UPI, cards, netbanking, wallets), via bank transfer, or Cash on Delivery for eligible repeat accounts. Large contracts can discuss credit terms with your account manager.' },
  { q: 'Can you source products not listed on the site?', a: 'Yes — describe the item in a custom quote line and our sourcing team will find it and include it in your quotation.' },
]

export default function B2BView() {
  const navigate = useAppStore((s) => s.navigate)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-stone-900 via-stone-800 to-teal-900 px-6 py-10 text-white sm:px-10 sm:py-14">
        <div className="max-w-2xl">
          <Badge className="mb-3 gap-1 bg-teal-500 text-white hover:bg-teal-500">
            <Briefcase className="size-3" /> Lastrivon Business
          </Badge>
          <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            Bulk buying, built for Indian businesses
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-stone-200 sm:text-base">
            From 5 laptops to 5,000 phones — get volume pricing, GST invoicing, priority dispatch and a
            dedicated account manager. New and refurbished stock, one quotation away.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => navigate('quote', { kind: 'b2b' })}
              size="lg"
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              Request a bulk quote <ArrowRight className="ml-1 size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => navigate('listing')}
            >
              Browse the catalog
            </Button>
          </div>
          <p className="mt-4 text-xs text-stone-300">Response within 24 business hours · No commitment required</p>
        </div>
      </section>

      {/* Stats strip */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { v: '24 hrs', l: 'Quote turnaround' },
          { v: '₹4 Cr+', l: 'B2B GMV served' },
          { v: '1,200+', l: 'Business buyers' },
          { v: 'up to 40%', l: 'CapEx saved (renewed)' },
        ].map((s) => (
          <Card key={s.l} className="rounded-xl border shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xl font-black text-stone-900">{s.v}</p>
              <p className="mt-0.5 text-[11px] font-medium text-stone-500">{s.l}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Benefits */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight text-stone-900">Why businesses buy on Lastrivon Kart</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <Card key={b.title} className="rounded-xl border shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <b.icon className="size-5" />
                </span>
                <h3 className="text-sm font-semibold text-stone-900">{b.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">{b.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight text-stone-900">Volume discount tiers</h2>
        <p className="mt-1 text-sm text-stone-500">Applied automatically in your quotation — mix any products to reach a tier.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t, i) => (
            <Card key={t.range} className={`rounded-xl border shadow-sm ${i === 3 ? 'border-teal-300 bg-teal-50/50' : ''}`}>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{t.range}</p>
                <p className="mt-1 text-2xl font-black text-teal-700">{t.discount}</p>
                <p className="mt-1 text-[11px] text-stone-500">{t.note}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight text-stone-900">How it works</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-xl border bg-white p-5 shadow-sm">
              <span className="absolute -top-3 left-4 flex size-7 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white shadow">
                {s.n}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-stone-900">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {TESTIMONIALS.map((t) => (
          <Card key={t.org} className="rounded-xl border shadow-sm">
            <CardContent className="p-5">
              <QuoteIcon className="mb-2 size-5 text-teal-600" />
              <p className="text-sm leading-relaxed text-stone-700">“{t.quote}”</p>
              <p className="mt-3 text-xs font-semibold text-stone-900">
                {t.name} <span className="font-normal text-stone-400">· {t.org}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Category chips + CTA */}
      <section className="mt-10 rounded-2xl border bg-stone-50 p-6 text-center sm:p-8">
        <h2 className="text-xl font-bold tracking-tight text-stone-900">What do teams usually buy?</h2>
        <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
          {[
            { icon: Laptop, label: 'Laptops & MacBooks' },
            { icon: Smartphone, label: 'Phones & Tablets' },
            { icon: PackageCheck, label: 'Accessories in bulk' },
            { icon: Recycle, label: 'Refurbished fleets' },
            { icon: Building2, label: 'Office electronics' },
          ].map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600">
              <c.icon className="size-3.5 text-teal-600" /> {c.label}
            </span>
          ))}
        </div>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={() => navigate('quote', { kind: 'b2b' })} size="lg" className="w-full bg-orange-600 text-white hover:bg-orange-700 sm:w-auto">
            Start a bulk quote <ArrowRight className="ml-1 size-4" />
          </Button>
          <p className="text-xs text-stone-400">or email business@lastrivon.in</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight text-stone-900">B2B FAQ</h2>
        <Accordion type="single" collapsible className="mt-4">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-sm font-medium text-stone-800">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-stone-500">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Trust line */}
      <section className="mt-8 mb-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-medium text-stone-400">
        <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5 text-emerald-500" /> Secure Razorpay checkout</span>
        <span className="inline-flex items-center gap-1"><BadgeCheck className="size-3.5 text-emerald-500" /> GST-registered seller</span>
        <span className="inline-flex items-center gap-1"><Rocket className="size-3.5 text-emerald-500" /> Priority B2B dispatch</span>
      </section>
    </div>
  )
}
