'use client'

import { useAppStore } from '@/lib/store'
import { formatINR } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import {
  ChevronRight, Info, Mail, MessageCircle, Phone, ShieldCheck,
  Download, Apple, Smartphone, Share2, CheckCircle2,
} from 'lucide-react'

const PAGES: Record<string, { title: string }> = {
  about: { title: 'About Lastrivon Kart' },
  faq: { title: 'Frequently Asked Questions' },
  contact: { title: 'Contact Us' },
  shipping: { title: 'Shipping Policy' },
  returns: { title: 'Returns & Refunds' },
  privacy: { title: 'Privacy Policy' },
  terms: { title: 'Terms of Service' },
  app: { title: 'Get the Lastrivon Kart App' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h3 className="mb-2 text-base font-bold text-stone-900">{title}</h3>
      <div className="space-y-3 text-sm leading-relaxed text-stone-600">{children}</div>
    </section>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
      <span>{children}</span>
    </li>
  )
}

function AboutPage() {
  return (
    <>
      <Section title="Our story">
        <p>
          Lastrivon Kart India started in 2024 with a simple question: why should great online shopping be
          limited to a handful of metros? Today we connect thousands of sellers — from family-run
          businesses in Jaipur to established electronics distributors in Delhi NCR — with more than
          two million shoppers across every PIN code in India.
        </p>
        <p>
          We run a <strong>hybrid 1P + 3P marketplace model</strong>. That means Lastrivon Kart directly
          retails a curated range of high-demand essentials (our 1P &ldquo;Lastrivon Retail&rdquo;
          assortment, quality-checked and stocked in our own warehouses), while independent verified
          sellers run their own storefronts alongside us (3P). You get the scale and pricing of a
          large retailer with the selection and specialisation only small merchants can offer.
        </p>
      </Section>
      <Section title="How the hybrid model works">
        <ul className="space-y-2">
          <Bullet>
            <strong>1P (Lastrivon Retail):</strong> items sold and fulfilled directly by Lastrivon Kart.
            These carry our own quality guarantee, same-day dispatch from our warehouses, and
            pooled shipping across items.
          </Bullet>
          <Bullet>
            <strong>3P (Marketplace sellers):</strong> verified businesses list their catalogue,
            set their prices, and ship using our courier partners. Lastrivon Kart handles payments,
            buyer protection, and dispute resolution; commissions fund the platform, fraud checks,
            and marketing for sellers.
          </Bullet>
          <Bullet>
            Every product page clearly shows who is selling — look for the{' '}
            <strong>&ldquo;Sold by&rdquo;</strong> badge. Multi-seller carts are split into separate
            shipments, each tracked independently.
          </Bullet>
        </ul>
      </Section>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { n: '2M+', l: 'Happy shoppers' },
          { n: '8,500+', l: 'Verified sellers' },
          { n: '19,000+', l: 'PIN codes served' },
          { n: '48 hrs', l: 'Avg. dispatch time' },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
            <p className="text-xl font-extrabold text-orange-600">{s.n}</p>
            <p className="mt-0.5 text-[11px] font-medium text-stone-500">{s.l}</p>
          </div>
        ))}
      </div>
      <Section title="What we stand for">
        <ul className="space-y-2">
          <Bullet><strong>Customer-first policies</strong> — 7-day easy returns, transparent pricing, no hidden fees at checkout.</Bullet>
          <Bullet><strong>Fair to sellers</strong> — clear commissions, weekly settlements, and dashboards that show exactly what you earn.</Bullet>
          <Bullet><strong>Made for Bharat</strong> — UPI-first payments, COD everywhere feasible, and support in English and Hindi.</Bullet>
        </ul>
      </Section>
    </>
  )
}

function FaqPage() {
  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: 'How do I place an order?',
      a: 'Add items to your cart, proceed to checkout, and enter (or select a saved) delivery address. Choose UPI, Card, Net Banking or Cash on Delivery. Guests can check out without an account — though creating one lets you track all orders in one place.',
    },
    {
      q: 'Why is my order split into multiple shipments?',
      a: 'Lastrivon Kart is a multi-vendor marketplace. When you buy from more than one seller, each seller ships their own items separately so nothing waits on the slowest warehouse. Each shipment gets its own tracking number, visible on the order detail page.',
    },
    {
      q: 'What are the delivery charges?',
      a: `Delivery is FREE for seller carts over ${formatINR(499)}. Below that, a flat ${formatINR(49)} per seller applies. Products flagged "Free Shipping" always ship free, regardless of cart value. Cash on Delivery orders carry a ${formatINR(25)} handling fee.`,
    },
    {
      q: 'How long does delivery take?',
      a: 'Metro cities typically receive orders in 2–3 days; the rest of India within 3–7 days. 1P items dispatch same or next business day. You will see an estimated delivery window on your order confirmation.',
    },
    {
      q: 'What is the return policy?',
      a: 'Most items can be returned within 7 days of delivery if they are unused, in original packaging, and include all tags and accessories. Open the order, pick the item, choose a reason and submit. Once the seller approves, a free pickup is scheduled and refunds are issued to your original payment method after QC.',
    },
    {
      q: 'Which payment methods do you accept?',
      a: 'UPI (GPay, PhonePe, Paytm, BHIM), all major credit and debit cards (Visa, Mastercard, RuPay, Amex), net banking from 50+ Indian banks, and Cash on Delivery in serviceable PIN codes. All online payments are processed over encrypted, PCI-DSS compliant gateways.',
    },
    {
      q: 'My payment failed but money was deducted. What now?',
      a: 'In most cases the bank auto-reverses it within 5–7 working days. Your order stays in "Payment Pending" so you can safely retry. If the amount is not refunded within 7 days, contact support@lastrivon.in with the order number and bank reference.',
    },
    {
      q: 'How does Lastrivon Kart work for sellers, and what is the commission?',
      a: 'Sellers register free, choose a plan (Free, Basic, Advanced or Premium) and list products after a quick review. Commission depends on the category — typically 5–15% of the item value after any coupon share — and is deducted automatically at checkout. Higher plans earn commission discounts and higher listing limits. Settlements are processed weekly to your registered bank account.',
    },
  ]
  return (
    <Accordion type="single" collapsible className="mt-2 w-full">
      {faqs.map((f, i) => (
        <AccordionItem key={i} value={`faq-${i}`}>
          <AccordionTrigger className="text-left text-sm font-semibold text-stone-800 hover:no-underline hover:text-orange-700">
            {f.q}
          </AccordionTrigger>
          <AccordionContent className="text-sm leading-relaxed text-stone-600">
            {f.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

function ContactPage() {
  return (
    <>
      <p className="text-sm leading-relaxed text-stone-600">
        Questions about an order, a return, or selling on Lastrivon Kart? Our team is available Monday to
        Saturday, 9 AM – 7 PM IST. We reply within 24 hours — most tickets close much faster.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <Mail className="mb-3 h-6 w-6 text-orange-600" />
            <h4 className="text-sm font-bold text-stone-900">Email support</h4>
            <p className="mt-1 text-xs text-stone-500">For order issues, returns and refunds</p>
            <a href="mailto:support@lastrivon.in" className="mt-2 block text-sm font-semibold text-orange-600 hover:text-orange-700">
              support@lastrivon.in
            </a>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <Phone className="mb-3 h-6 w-6 text-orange-600" />
            <h4 className="text-sm font-bold text-stone-900">Customer care</h4>
            <p className="mt-1 text-xs text-stone-500">Mon–Sat, 9 AM – 7 PM IST</p>
            <a href="tel:+911800123456" className="mt-2 block text-sm font-semibold text-orange-600 hover:text-orange-700">
              1800-123-456 (toll-free)
            </a>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <MessageCircle className="mb-3 h-6 w-6 text-orange-600" />
            <h4 className="text-sm font-bold text-stone-900">WhatsApp</h4>
            <p className="mt-1 text-xs text-stone-500">Quick order &amp; delivery queries</p>
            <p className="mt-2 text-sm font-semibold text-stone-700">+91 90000 12345</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-5">
            <ShieldCheck className="mb-3 h-6 w-6 text-orange-600" />
            <h4 className="text-sm font-bold text-stone-900">Seller support</h4>
            <p className="mt-1 text-xs text-stone-500">For vendors selling on Lastrivon Kart</p>
            <a href="mailto:sellers@lastrivon.in" className="mt-2 block text-sm font-semibold text-orange-600 hover:text-orange-700">
              sellers@lastrivon.in
            </a>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 rounded-lg bg-orange-50 p-4 text-xs leading-relaxed text-orange-800">
        <strong>Registered office:</strong> Lastrivon Commerce Pvt. Ltd., 4th Floor, Trade Crest,
        Andheri East, Mumbai, Maharashtra 400069. CIN: U52100MH2024PTC123456.
      </div>
    </>
  )
}

function ShippingPage() {
  const zones = [
    { zone: 'Metro cities (Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Pune, Kolkata)', time: '2–3 business days', fee: `Free above ${formatINR(499)}, else ${formatINR(49)} per seller` },
    { zone: 'Tier 2 & Tier 3 cities', time: '3–5 business days', fee: `Free above ${formatINR(499)}, else ${formatINR(49)} per seller` },
    { zone: 'Remote & North-East PIN codes', time: '5–7 business days', fee: `Free above ${formatINR(499)}, else ${formatINR(49)} per seller` },
    { zone: 'Cash on Delivery', time: 'Same as zone', fee: `+ ${formatINR(25)} handling fee; available on serviceable PIN codes up to ${formatINR(10000)} order value` },
  ]
  return (
    <>
      <Section title="Delivery charges">
        <p>
          Shipping is calculated per seller, because each seller packs and dispatches independently.
          You are only ever charged one shipping fee per seller in a single order — adding more items
          from the same seller never increases shipping.
        </p>
      </Section>
      <div className="mt-6 overflow-hidden rounded-xl border border-stone-200">
        {zones.map((z, i) => (
          <div key={z.zone} className={`flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:gap-4 ${i % 2 === 0 ? 'bg-stone-50' : 'bg-white'} ${i > 0 ? 'border-t border-stone-100' : ''}`}>
            <div className="flex-1">
              <p className="font-medium text-stone-800">{z.zone}</p>
            </div>
            <div className="text-xs text-stone-500 sm:w-40">{z.time}</div>
            <div className="text-xs font-medium text-stone-700 sm:w-64">{z.fee}</div>
          </div>
        ))}
      </div>
      <Section title="Dispatch & tracking">
        <ul className="space-y-2">
          <Bullet>Orders placed before 4 PM on business days are usually dispatched the same or next day.</Bullet>
          <Bullet>You receive a notification with courier name and tracking number as soon as a shipment leaves the seller.</Bullet>
          <Bullet>Track every shipment live from <strong>My Orders → View details</strong>.</Bullet>
          <Bullet>Items marked &ldquo;Free Shipping&rdquo; always ship free, regardless of cart value.</Bullet>
        </ul>
      </Section>
      <Section title="Undeliverable shipments">
        <p>
          Couriers attempt delivery up to three times. If the order is still undelivered (incorrect
          address, unreachable consignee), it is returned to the seller. Prepaid amounts are refunded
          automatically; for COD orders no payment is collected.
        </p>
      </Section>
    </>
  )
}

function ReturnsPage() {
  const steps = [
    { t: 'Start a return', d: 'Open My Orders → View details, and tap Return on the delivered item within 7 days of delivery. Choose a reason and add photos/comments if relevant.' },
    { t: 'Seller review', d: 'The seller reviews your request, usually within 48 hours. You get a notification the moment it is approved or rejected.' },
    { t: 'Free pickup', d: 'Once approved, our courier partner picks up the item from your address — typically within 2 business days. Keep the item in its original packaging with tags intact.' },
    { t: 'Quality check & refund', d: 'After the item passes QC at the seller or returns hub, your refund is initiated to the original payment method (2–5 business days) or as Lastrivon Kart store credit (instant). COD refunds are transferred to your bank account or UPI ID.' },
  ]
  return (
    <>
      <Section title="7-day easy returns">
        <p>
          If an item arrives damaged, defective, incorrect, or simply is not what you expected, you
          can return it within <strong>7 days of delivery</strong>. Returns are free — we arrange
          the pickup at no cost to you.
        </p>
      </Section>
      <div className="mt-6 space-y-0">
        {steps.map((s, i) => (
          <div key={s.t} className="relative flex gap-4 pb-6">
            {i < steps.length - 1 ? <div className="absolute left-[13px] top-8 h-full w-0.5 bg-stone-200" /> : null}
            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
              {i + 1}
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-900">{s.t}</h4>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{s.d}</p>
            </div>
          </div>
        ))}
      </div>
      <Section title="Non-returnable items">
        <ul className="space-y-2">
          <Bullet>Innerwear, lingerie, socks and beauty/cosmetic products once opened (for hygiene reasons).</Bullet>
          <Bullet>Perishables and grocery items.</Bullet>
          <Bullet>Items damaged due to misuse or missing original tags/packaging.</Bullet>
        </ul>
      </Section>
      <Section title="Refund timelines">
        <ul className="space-y-2">
          <Bullet><strong>UPI / Cards / Net Banking:</strong> 2–5 business days after QC pass (bank-dependent).</Bullet>
          <Bullet><strong>Lastrivon Kart store credit:</strong> instant, and never expires.</Bullet>
          <Bullet><strong>COD orders:</strong> NEFT to your bank account or UPI ID within 3–5 business days of sharing account details.</Bullet>
        </ul>
      </Section>
    </>
  )
}

function PrivacyPage() {
  return (
    <>
      <p className="rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-500">
        Last updated: January 2025 · This policy is drafted in line with the Digital Personal Data
        Protection (DPDP) Act, 2023.
      </p>
      <Section title="1. Information we collect">
        <ul className="space-y-2">
          <Bullet><strong>Account data:</strong> name, email, phone number and password (stored only as a cryptographic hash).</Bullet>
          <Bullet><strong>Order data:</strong> delivery addresses, order history, invoices and returns.</Bullet>
          <Bullet><strong>Payment data:</strong> we never store card numbers or UPI credentials. Payments are processed by PCI-DSS compliant gateways; we retain only masked references and transaction status.</Bullet>
          <Bullet><strong>Usage data:</strong> device type, app interactions and pages visited, used to improve the marketplace experience.</Bullet>
        </ul>
      </Section>
      <Section title="2. How we use your data">
        <ul className="space-y-2">
          <Bullet>Processing orders, payments, deliveries, returns and refunds.</Bullet>
          <Bullet>Service notifications — order confirmations, shipment tracking, payment receipts.</Bullet>
          <Bullet>Fraud prevention, dispute resolution and enforcing marketplace policies.</Bullet>
          <Bullet>Improving search, recommendations and seller quality — using aggregated, de-identified data where possible.</Bullet>
        </ul>
      </Section>
      <Section title="3. Sharing with third parties">
        <p>
          We share the minimum data necessary only with: sellers (your name, address and phone —
          solely to fulfil your order), logistics partners (address and contact for delivery),
          payment gateways, and legal/law-enforcement authorities where required by Indian law.
          We never sell your personal data.
        </p>
      </Section>
      <Section title="4. Your rights (DPDP Act, 2023)">
        <ul className="space-y-2">
          <Bullet>Access, correct or delete your personal data from Account settings, or by writing to our Grievance Officer.</Bullet>
          <Bullet>Withdraw consent for marketing communications at any time.</Bullet>
          <Bullet>Nominate another individual to exercise your data rights, as permitted by the Act.</Bullet>
        </ul>
      </Section>
      <Section title="5. Data retention & security">
        <p>
          Order and invoice records are retained for 10 years as required by Indian tax law; other
          personal data is retained only as long as your account is active. Data is encrypted in
          transit (TLS 1.2+) and access inside Lastrivon Kart is role-restricted and audit-logged.
        </p>
      </Section>
      <Section title="6. Grievance Officer">
        <p>
          Grievance Officer — Data Protection, Lastrivon Commerce Pvt. Ltd., 4th Floor, Trade Crest,
          Andheri East, Mumbai 400069 · grievance@lastrivon.in · We respond within 72 hours.
        </p>
      </Section>
    </>
  )
}

function TermsPage() {
  return (
    <>
      <p className="rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-500">
        Effective date: January 2025 · These terms govern your use of the Lastrivon Kart India marketplace,
        whether you shop, browse, or sell.
      </p>
      <Section title="1. The marketplace model">
        <p>
          Lastrivon Kart is a platform that facilitates transactions between buyers and independent sellers,
          in addition to its own retail (1P) assortment. For 3P purchases, the seller is the party of
          record for the sale; Lastrivon Kart provides the platform, payment collection, and buyer
          protection. For 1P items (&ldquo;Sold by Lastrivon Retail&rdquo;), Lastrivon Commerce Pvt.
          Ltd. is the seller.
        </p>
      </Section>
      <Section title="2. Accounts & eligibility">
        <ul className="space-y-2">
          <Bullet>You must be 18+ or use the platform under guardian supervision.</Bullet>
          <Bullet>One person may maintain a single customer account; duplicate or fraudulent accounts may be suspended.</Bullet>
          <Bullet>You are responsible for keeping credentials confidential. Notify us immediately of unauthorised use.</Bullet>
        </ul>
      </Section>
      <Section title="3. Orders, pricing & payment">
        <ul className="space-y-2">
          <Bullet>Listing prices are inclusive of GST unless stated otherwise; the final amount (with shipping and COD fees) is shown at checkout before you pay.</Bullet>
          <Bullet>An order is a purchase offer; it becomes binding when the order is confirmed (payment success or COD acceptance).</Bullet>
          <Bullet>Coupons cannot be exchanged for cash; one coupon applies per order unless stated otherwise.</Bullet>
        </ul>
      </Section>
      <Section title="4. Seller obligations & commissions">
        <ul className="space-y-2">
          <Bullet>Sellers must be legally registered businesses with valid GSTIN (where applicable), list accurate stock and prices, and dispatch within their stated handling time.</Bullet>
          <Bullet>Lastrivon Kart charges a commission per completed sale — category-based (typically 5–15%) and reduced by the seller&apos;s plan benefits. The applicable rate is shown in the seller dashboard before listing.</Bullet>
          <Bullet>Settlements of seller earnings are processed weekly, after deducting commissions, refunds and chargebacks, to the seller&apos;s registered bank account.</Bullet>
          <Bullet>Sellers bear the cost of returns caused by inaccurate listings, wrong items or quality issues.</Bullet>
        </ul>
      </Section>
      <Section title="5. Returns & refunds">
        <p>
          Buyers may return eligible items within 7 days of delivery as described in our Returns
          Policy. Approved refunds are credited to the original payment method. Lastrivon Kart may withhold
          refunds pending quality-check outcomes in cases of suspected abuse.
        </p>
      </Section>
      <Section title="6. Prohibited conduct">
        <ul className="space-y-2">
          <Bullet>Listing counterfeit, prohibited or restricted goods; manipulating ratings or reviews.</Bullet>
          <Bullet>Placing orders to resell at scale without a written agreement, or using automated tools to scrape or purchase.</Bullet>
          <Bullet>Circumventing the platform to complete payments outside Lastrivon Kart.</Bullet>
        </ul>
      </Section>
      <Section title="7. Liability & governing law">
        <p>
          To the maximum extent permitted by law, Lastrivon Kart&apos;s aggregate liability for any claim
          related to an order is limited to the order value. The marketplace is provided &ldquo;as
          is&rdquo;; we do not warrant uninterrupted availability. These terms are governed by the
          laws of India, with exclusive jurisdiction of the courts of Mumbai, Maharashtra.
        </p>
      </Section>
    </>
  )
}

const APK = {
  url: '/downloads/lastrivon-kart-india.apk',
  version: '1.0.0',
  sizeKB: 58,
  sha256: '5084a6d1ce9c0e0d36904f248b1d34548ed10073a38f05c56eb88a0849a38f4e',
}

function AppPage() {
  return (
    <>
      <div className="rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 p-5 text-white sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-3xl" aria-hidden="true">
            🛍️
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight">Lastrivon Kart, right on your phone</p>
            <p className="mt-1 text-sm text-orange-100">
              Install the app for one-tap shopping, offline browsing and instant deals. Android users get the
              APK below; iPhone users can install the PWA from Safari in two taps.
            </p>
          </div>
        </div>
      </div>

      {/* ANDROID */}
      <section className="mt-8" aria-labelledby="android-heading">
        <h3 id="android-heading" className="mb-3 flex items-center gap-2 text-base font-bold text-stone-900">
          <Smartphone className="h-5 w-5 text-orange-600" aria-hidden="true" /> Android — direct APK download
        </h3>
        <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-stone-900">Lastrivon Kart v{APK.version}</p>
              <p className="mt-0.5 text-xs text-stone-500">
                {APK.sizeKB} KB · Android 7.0+ (API 24) · Signed APK
              </p>
              <p className="mt-1 truncate font-mono text-[10px] text-stone-400" title={APK.sha256}>
                sha256: {APK.sha256.slice(0, 24)}…{APK.sha256.slice(-8)}
              </p>
            </div>
            <a
              href={APK.url}
              download="lastrivon-kart-india.apk"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-orange-600 px-6 text-sm font-semibold text-white shadow-md shadow-orange-600/25 transition-all hover:bg-orange-700 hover:shadow-lg active:scale-[0.98]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download APK
            </a>
          </div>
          <ol className="mt-4 space-y-2 border-t border-stone-200 pt-4 text-sm text-stone-600">
            {[
              'Tap "Download APK" above and open the downloaded file.',
              'If asked, allow "Install unknown apps" for your browser — Android shows this for direct downloads outside the Play Store, it is normal.',
              'Tap Install. On first launch, enter this website\u2019s URL (the address you are browsing now) to connect the app.',
              'Done — your cart, orders and B2B quotes stay in sync with the website.',
            ].map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-700">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* iOS */}
      <section className="mt-8" aria-labelledby="ios-heading">
        <h3 id="ios-heading" className="mb-3 flex items-center gap-2 text-base font-bold text-stone-900">
          <Apple className="h-5 w-5 text-stone-700" aria-hidden="true" /> iPhone / iPad — install as an app (PWA)
        </h3>
        <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 sm:p-5">
          <p className="text-sm text-stone-600">
            Apple doesn&apos;t allow direct APK installs, but this website is a full{' '}
            <strong className="text-stone-900">Progressive Web App</strong> — installing it from Safari gives
            you the same experience: home-screen icon, full-screen window, offline support.
          </p>
          <ol className="mt-4 space-y-2">
            {[
              'Open this website in Safari on your iPhone or iPad.',
              'Tap the Share button (square with an arrow) in the toolbar.',
              'Scroll and tap "Add to Home Screen", then tap Add.',
            ].map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[11px] font-bold text-stone-700">
                  {i + 1}
                </span>
                <span className="text-sm text-stone-600">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-orange-50 p-3 text-xs text-orange-800">
            <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>An &ldquo;Install Lastrivon Kart&rdquo; banner also appears automatically in Safari after a few seconds of browsing.</span>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="mt-8" aria-labelledby="features-heading">
        <h3 id="features-heading" className="mb-3 text-base font-bold text-stone-900">What&apos;s inside the app</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            'Full shop: products, cart, checkout with Razorpay & COD',
            'Works offline — browse recently loaded pages without internet',
            'Home-screen shortcuts: Deals, Refurbished, Cart',
            'B2B quotes & bulk pricing on the go',
            'Live order tracking & notifications',
            'Tiny 58 KB APK — updates come straight from the website',
          ].map((f) => (
            <li key={f} className="flex items-start gap-2 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex items-start gap-2 rounded-lg border border-stone-200 bg-white p-3 text-xs text-stone-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" />
        <span>
          The APK is built and signed by Lastrivon Kart India (APK Signature Scheme v2+v3). Verify the SHA-256
          checksum before installing if you received this file from a third party.
        </span>
      </div>
    </>
  )
}

export default function StaticView() {
  const params = useAppStore((s) => s.params)
  const navigate = useAppStore((s) => s.navigate)

  const page = params.page && PAGES[params.page] ? params.page : 'about'
  const { title } = PAGES[page]

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-stone-400">
        <button onClick={() => navigate('home')} className="hover:text-orange-600">Home</button>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-stone-600">{title}</span>
      </nav>

      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50">
          <Info className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
          <p className="mt-0.5 text-xs text-stone-400">Lastrivon Kart India · Help &amp; Information</p>
        </div>
      </div>

      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-6 sm:p-8">
          {page === 'about' && <AboutPage />}
          {page === 'app' && <AppPage />}
          {page === 'faq' && <FaqPage />}
          {page === 'contact' && <ContactPage />}
          {page === 'shipping' && <ShippingPage />}
          {page === 'returns' && <ReturnsPage />}
          {page === 'privacy' && <PrivacyPage />}
          {page === 'terms' && <TermsPage />}
        </CardContent>
      </Card>

      <div className="mt-6 text-center">
        <Button variant="outline" size="sm" onClick={() => navigate('home')}>
          Back to shopping
        </Button>
      </div>
    </div>
  )
}
