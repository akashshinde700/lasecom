/**
 * Seed script - Multi-Vendor Marketplace
 * Run: bunx tsx prisma/seed.ts   (or bun prisma/seed.ts)
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

const db = new PrismaClient()

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------- image pools ----------
const pools: Record<string, string[]> = {}
const poolDir = path.join(process.cwd(), 'seed-assets')
const poolNames = ['phones', 'laptops', 'headphones', 'watches', 'shoes', 'tshirts', 'kurtas', 'sofas', 'lamps', 'kitchens', 'beauty', 'bags', 'banner1', 'banner2', 'banner3']
for (const name of poolNames) {
  const f = path.join(poolDir, `${name}.json`)
  if (existsSync(f)) {
    try {
      const data = JSON.parse(readFileSync(f, 'utf-8'))
      pools[name] = (data.results ?? []).map((r: { original_url: string }) => r.original_url)
    } catch {
      pools[name] = []
    }
  } else {
    pools[name] = []
  }
}

const misc = [...pools.tshirts, ...pools.bags, ...pools.beauty]
function img(pool: string, idx: number): string {
  const p = pools[pool]?.length ? pools[pool] : misc
  if (!p.length) return ''
  return p[idx % p.length]
}
function imgs(pool: string, start: number, count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(img(pool, start + i))
  return out
}
function poolImgCount(pool: string): number {
  return pools[pool]?.length ?? 0
}
function bannerImg(pool: string, idx: number): string {
  const p = pools[pool]?.length ? pools[pool] : [...pools.banner1, ...pools.banner2, ...pools.banner3]
  return p.length ? p[idx % p.length] : ''
}

async function main() {
  console.log('Clearing existing data...')
  await db.auditLog.deleteMany()
  await db.notification.deleteMany()
  await db.stockMovement.deleteMany()
  await db.review.deleteMany()
  await db.vendorLedger.deleteMany()
  await db.settlement.deleteMany()
  await db.refund.deleteMany()
  await db.returnRequest.deleteMany()
  await db.shipmentEvent.deleteMany()
  await db.orderItem.deleteMany()
  await db.subOrder.deleteMany()
  await db.payment.deleteMany()
  await db.order.deleteMany()
  await db.cartItem.deleteMany()
  await db.cart.deleteMany()
  await db.wishlistItem.deleteMany()
  await db.address.deleteMany()
  await db.productVariant.deleteMany()
  await db.product.deleteMany()
  await db.brand.deleteMany()
  await db.category.deleteMany()
  await db.coupon.deleteMany()
  await db.banner.deleteMany()
  await db.setting.deleteMany()
  await db.vendorStaff.deleteMany()
  await db.vendor.deleteMany()
  await db.subscriptionPlan.deleteMany()
  await db.session.deleteMany()
  await db.user.deleteMany()

  // ---------------- Settings ----------------
  const settings: [string, string][] = [
    ['site.name', 'Lastrivon Kart India'],
    ['site.announcement', 'Maha Bharat Sale LIVE - Up to 70% OFF + Extra 10% with code WELCOME10'],
    ['platform.commissionPercent', '10'],
    ['shipping.baseFee', '49'],
    ['shipping.freeThreshold', '499'],
    ['shipping.perKg', '15'],
    ['shipping.codFee', '25'],
    ['product.autoApprove', 'true'],
    ['returns.windowDays', '7'],
    ['cod.enabled', 'true'],
  ]
  for (const [key, value] of settings) await db.setting.create({ data: { key, value } })

  // ---------------- Subscription Plans ----------------
  const planFree = await db.subscriptionPlan.create({ data: { name: 'Free', priceMonthly: 0, listingLimit: 10, commissionDiscountPercent: 0, features: JSON.stringify(['10 product listings', 'Standard analytics', 'Weekly settlements']) } })
  const planBasic = await db.subscriptionPlan.create({ data: { name: 'Basic', priceMonthly: 299, listingLimit: 50, commissionDiscountPercent: 5, features: JSON.stringify(['50 product listings', 'Standard analytics', 'Promotional tools']) } })
  const planAdvanced = await db.subscriptionPlan.create({ data: { name: 'Advanced', priceMonthly: 699, listingLimit: 200, commissionDiscountPercent: 10, features: JSON.stringify(['200 product listings', 'Advanced analytics', 'Sponsored credits', 'Priority support']) } })
  const planPremium = await db.subscriptionPlan.create({ data: { name: 'Premium', priceMonthly: 1499, listingLimit: -1, commissionDiscountPercent: 15, features: JSON.stringify(['Unlimited listings', 'Premium insights', 'Dedicated account manager', 'Lowest commission']) } })

  // ---------------- Users ----------------
  const admin = await db.user.create({ data: { name: 'Arjun Mehta', email: 'admin@lastrivon.in', phone: '9876500001', passwordHash: hashPassword('Admin@123'), role: 'PLATFORM_ADMIN' } })
  await db.user.create({ data: { name: 'Neha Ops', email: 'staff@lastrivon.in', phone: '9876500002', passwordHash: hashPassword('Staff@123'), role: 'PLATFORM_STAFF' } })
  const rahul = await db.user.create({ data: { name: 'Rahul Sharma', email: 'rahul@example.com', phone: '9876511111', passwordHash: hashPassword('Customer@123'), role: 'CUSTOMER' } })
  const priya = await db.user.create({ data: { name: 'Priya Patel', email: 'priya@example.com', phone: '9876522222', passwordHash: hashPassword('Customer@123'), role: 'CUSTOMER' } })

  // ---------------- Vendors ----------------
  async function makeVendor(opts: { name: string; slug: string; email: string; phone: string; ownerName: string; status: string; commission: number; city: string; state: string; gstin: string; description: string; planId: string; rating: number; ratingCount: number }) {
    const owner = await db.user.create({
      data: { name: opts.ownerName, email: opts.email, phone: opts.phone, passwordHash: hashPassword('Vendor@123'), role: 'VENDOR_ADMIN' },
    })
    return db.vendor.create({
      data: {
        name: opts.name, slug: opts.slug, email: opts.email, phone: opts.phone,
        description: opts.description, status: opts.status, commissionPercent: opts.commission,
        gstin: opts.gstin, pan: opts.gstin.slice(2, 7) + '5678K', bankAccountName: opts.ownerName,
        bankAccountNumber: 'XXXXXXXX' + Math.floor(1000 + Math.random() * 8999), bankIfsc: 'HDFC0001234',
        city: opts.city, state: opts.state, rating: opts.rating, ratingCount: opts.ratingCount,
        ownerId: owner.id, planId: opts.planId, logoText: opts.name.slice(0, 2).toUpperCase(),
        pickupAddress: `${opts.name}, Industrial Area, ${opts.city}`,
      },
    })
  }

  const vElectro = await makeVendor({ name: 'Volt Electronics', slug: 'volt-electronics', email: 'electro@lastrivon.in', phone: '9876533331', ownerName: 'Karan Malhotra', status: 'ACTIVE', commission: 8, city: 'Noida', state: 'Uttar Pradesh', gstin: '09ABCDE1234F1Z5', description: 'Authorised electronics retailer. Genuine products with manufacturer warranty and fast NCR dispatch.', planId: planAdvanced.id, rating: 4.5, ratingCount: 1840 })
  const vThreads = await makeVendor({ name: 'Urban Threads', slug: 'urban-threads', email: 'threads@lastrivon.in', phone: '9876533332', ownerName: 'Sana Kapoor', status: 'ACTIVE', commission: 12, city: 'Jaipur', state: 'Rajasthan', gstin: '08FGHIJ5678K1Z2', description: 'Trendy fashion & ethnic wear for the modern Indian wardrobe. Handpicked fabrics.', planId: planPremium.id, rating: 4.3, ratingCount: 920 })
  const vHome = await makeVendor({ name: 'HomeNest Decor', slug: 'homenest-decor', email: 'homenest@lastrivon.in', phone: '9876533333', ownerName: 'Vikram Rao', status: 'ACTIVE', commission: 10, city: 'Bengaluru', state: 'Karnataka', gstin: '29KLMNO9012P1Z8', description: 'Premium home decor, furniture and kitchen essentials crafted to last.', planId: planBasic.id, rating: 4.1, ratingCount: 460 })
  await makeVendor({ name: 'Glow Beauty Co', slug: 'glow-beauty-co', email: 'glow@lastrivon.in', phone: '9876533334', ownerName: 'Ananya Iyer', status: 'PENDING', commission: 10, city: 'Mumbai', state: 'Maharashtra', gstin: '27PQRST3456L1Z9', description: 'Curated skincare and beauty essentials.', planId: planFree.id, rating: 0, ratingCount: 0 })
  await makeVendor({ name: 'FreshKart Mart', slug: 'freshkart-mart', email: 'fresh@lastrivon.in', phone: '9876533335', ownerName: 'Dev Patel', status: 'SUSPENDED', commission: 10, city: 'Ahmedabad', state: 'Gujarat', gstin: '24UVWXY7890M1Z3', description: 'Daily essentials supermarket.', planId: planFree.id, rating: 3.2, ratingCount: 88 })

  const electroStaffUser = await db.user.create({ data: { name: 'Manav Orders', email: 'staff.electro@lastrivon.in', passwordHash: hashPassword('Staff@123'), role: 'VENDOR_STAFF' } })
  await db.vendorStaff.create({ data: { userId: electroStaffUser.id, vendorId: vElectro.id, staffRole: 'ORDER_MANAGER' } })

  // ---------------- Categories ----------------
  const catElectronics = await db.category.create({ data: { name: 'Electronics', slug: 'electronics', icon: 'Smartphone', sortOrder: 1 } })
  const catMobiles = await db.category.create({ data: { name: 'Mobiles', slug: 'mobiles', parentId: catElectronics.id, sortOrder: 2 } })
  const catLaptops = await db.category.create({ data: { name: 'Laptops', slug: 'laptops', parentId: catElectronics.id, sortOrder: 3 } })
  const catAudio = await db.category.create({ data: { name: 'Audio & Wearables', slug: 'audio-wearables', parentId: catElectronics.id, sortOrder: 4 } })
  const catFashion = await db.category.create({ data: { name: 'Fashion', slug: 'fashion', icon: 'Shirt', sortOrder: 5 } })
  const catFootwear = await db.category.create({ data: { name: 'Footwear', slug: 'footwear', parentId: catFashion.id, sortOrder: 6, commissionPercent: 12 } })
  const catMen = await db.category.create({ data: { name: "Men's Clothing", slug: 'mens-clothing', parentId: catFashion.id, sortOrder: 7 } })
  const catEthnic = await db.category.create({ data: { name: "Women's Ethnic", slug: 'womens-ethnic', parentId: catFashion.id, sortOrder: 8 } })
  const catHome = await db.category.create({ data: { name: 'Home & Kitchen', slug: 'home-kitchen', icon: 'Sofa', sortOrder: 9 } })
  const catBeauty = await db.category.create({ data: { name: 'Beauty & Personal Care', slug: 'beauty', icon: 'Sparkles', sortOrder: 10 } })
  const catBags = await db.category.create({ data: { name: 'Bags & Luggage', slug: 'bags-luggage', icon: 'Backpack', sortOrder: 11 } })

  // ---------------- Brands ----------------
  const mkBrand = (name: string) => db.brand.create({ data: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') } })
  const bTechNova = await mkBrand('TechNova')
  const bZentech = await mkBrand('Zentech')
  const bUrbanEdge = await mkBrand('UrbanEdge')
  const bStepsy = await mkBrand('Stepsy')
  const bCozyNest = await mkBrand('CozyNest')
  const bGlowEssence = await mkBrand('GlowEssence')
  const bTrailpack = await mkBrand('Trailpack')
  const bKitchMate = await mkBrand('KitchMate')

  // ---------------- Products ----------------
  type P = {
    title: string; cat: string; brand: string; vendorId?: string; sellerType?: string; status?: string;
    price: number; mrp: number; cost?: number; stock: number; images: string[];
    desc: string; specs?: Record<string, string>; badge?: string; featured?: boolean;
    sponsored?: boolean; weight?: number; freeShipping?: boolean; rating?: number; reviewCount?: number;
    sold?: number; variants?: { name: string; price?: number; stock: number }[];
    condition?: 'REFURBISHED'; refurbGrade?: 'EXCELLENT' | 'GOOD' | 'FAIR'; refurbNote?: string;
  }

  const nPhones = poolImgCount('phones')
  const products: P[] = [
    // ---- PLATFORM OWNED (1P) ----
    { title: 'TechNova Pulse X5 5G (8GB RAM, 128GB, Cosmic Black)', cat: 'mobiles', brand: 'TechNova', sellerType: 'PLATFORM', price: 15999, mrp: 19999, cost: 12800, stock: 42, images: imgs('phones', 0, 3), badge: 'BESTSELLER', featured: true, rating: 4.4, reviewCount: 2, sold: 320, weight: 400, desc: 'Flagship-grade performance with 120Hz AMOLED display, 50MP AI camera and 5000mAh battery with 67W fast charging.', specs: { Display: '6.67" FHD+ AMOLED 120Hz', Processor: 'Snapdragon 7 Gen 3', Camera: '50MP + 8MP | 16MP front', Battery: '5000mAh, 67W', Warranty: '1 Year' } },
    { title: 'Zentech AirBook 14 (Intel i5 13th Gen, 16GB/512GB SSD)', cat: 'laptops', brand: 'Zentech', sellerType: 'PLATFORM', price: 52990, mrp: 65990, cost: 44000, stock: 18, images: imgs('laptops', 0, 3), featured: true, rating: 4.3, reviewCount: 1, sold: 95, weight: 1400, desc: 'Slim metal-body laptop with 14" 2.8K display, backlit keyboard, fingerprint login and all-day battery.', specs: { Display: '14" 2.8K OLED', CPU: 'Intel Core i5-1340P', RAM: '16GB LPDDR5', Storage: '512GB NVMe SSD', OS: 'Windows 11 Home' } },
    { title: 'TechNova Buds Pro 2 ANC Earbuds', cat: 'audio-wearables', brand: 'TechNova', sellerType: 'PLATFORM', price: 2499, mrp: 4999, cost: 1500, stock: 120, images: imgs('headphones', 0, 2), badge: 'DEAL', rating: 4.1, reviewCount: 1, sold: 850, weight: 100, freeShipping: true, desc: 'Active noise cancellation up to 35dB, 40hr total playback, low-latency gaming mode.', specs: { ANC: 'Up to 35dB', Playback: '40 hours total', Bluetooth: 'v5.3', Water: 'IPX5' } },
    { title: 'Stepsy CloudRun Pro Running Shoes', cat: 'footwear', brand: 'Stepsy', sellerType: 'PLATFORM', price: 1799, mrp: 2999, cost: 950, stock: 60, images: imgs('shoes', 0, 3), badge: 'NEW_ARRIVAL', featured: true, weight: 600, desc: 'Feather-light knit upper with responsive foam midsole. Built for daily runs and gym sessions.', variants: [{ name: 'UK 7 / Black', stock: 15 }, { name: 'UK 8 / Black', price: 1849, stock: 20 }, { name: 'UK 9 / Black', stock: 15 }, { name: 'UK 8 / Grey', price: 1899, stock: 10 }], specs: { Upper: 'Engineered knit mesh', Sole: 'EVA + Rubber', Closure: 'Lace-up', Care: 'Wipe with damp cloth' } },
    { title: 'CozyNest Aurora 3-Seater Fabric Sofa (Graphite)', cat: 'home-kitchen', brand: 'CozyNest', sellerType: 'PLATFORM', price: 24999, mrp: 37999, cost: 18000, stock: 8, images: imgs('sofas', 0, 2), weight: 32000, desc: 'Deep-seated 3-seater sofa in premium weave fabric with solid sheesham frame. 3-year warranty.', specs: { Frame: 'Solid Sheesham wood', Fabric: 'Premium weave', Seats: '3', Warranty: '3 years' } },
    { title: 'GlowEssence Vitamin C Face Serum 30ml', cat: 'beauty', brand: 'GlowEssence', sellerType: 'PLATFORM', price: 449, mrp: 799, cost: 210, stock: 200, images: imgs('beauty', 0, 2), badge: 'DEAL', rating: 4.5, reviewCount: 1, sold: 2100, weight: 120, freeShipping: true, desc: '20% Vitamin C with hyaluronic acid for radiant, even-toned skin. Dermatologically tested.', specs: { Volume: '30ml', Key: '20% Vitamin C + HA', Skin: 'All types', Shelf: '24 months' } },
    { title: 'Trailpack Voyager 35L Laptop Backpack', cat: 'bags-luggage', brand: 'Trailpack', sellerType: 'PLATFORM', price: 1199, mrp: 2199, cost: 620, stock: 85, images: imgs('bags', 0, 3), badge: 'BESTSELLER', rating: 4.2, reviewCount: 1, sold: 640, weight: 700, freeShipping: true, desc: 'Water-resistant 35L backpack with padded 15.6" laptop sleeve, USB charging port and rain cover.', specs: { Capacity: '35L', Laptop: 'Up to 15.6"', Material: 'Polyester 600D', Extras: 'Rain cover, USB port' } },
    { title: 'KitchMate BrewPro 12-Cup Coffee Maker', cat: 'home-kitchen', brand: 'KitchMate', sellerType: 'PLATFORM', price: 3299, mrp: 5499, cost: 2100, stock: 35, images: imgs('kitchens', 0, 2), weight: 2200, desc: 'Drip coffee maker with reusable filter, keep-warm plate and anti-drip design.', specs: { Capacity: '12 cups', Power: '900W', Features: 'Keep warm, Anti-drip', Warranty: '2 years' } },

    // ---- VOLT ELECTRONICS (3P) ----
    { title: 'TechNova Pulse X5 Pro 5G (12GB/256GB, Aurora Silver)', cat: 'mobiles', brand: 'TechNova', vendorId: vElectro.id, price: 21999, mrp: 26999, stock: 30, images: imgs('phones', 1, 3), badge: 'BESTSELLER', featured: true, rating: 4.6, reviewCount: 2, sold: 540, weight: 420, desc: 'The Pro upgrade: 100W charging, telephoto lens and vapour cooling for marathon gaming.', specs: { Display: '6.7" AMOLED 144Hz', RAM: '12GB LPDDR5', Storage: '256GB UFS 4.0', Charging: '100W HyperCharge', Warranty: '1 Year' } },
    { title: 'Zentech Glide Note 5G (6GB/128GB, Ocean Blue)', cat: 'mobiles', brand: 'Zentech', vendorId: vElectro.id, price: 11999, mrp: 15499, stock: 55, images: imgs('phones', 2, 2), rating: 4.0, sold: 410, weight: 390, desc: 'Big 6.7" display, clean stock Android and 2-day battery life on a budget.', specs: { Display: '6.7" HD+ 90Hz', Battery: '6000mAh', Camera: '50MP dual', RAM: '6GB' } },
    { title: 'TechNova SonicBoom 40H Bluetooth Headphones', cat: 'audio-wearables', brand: 'TechNova', vendorId: vElectro.id, price: 3499, mrp: 5999, stock: 45, images: imgs('headphones', 1, 2), badge: 'DEAL', featured: true, rating: 4.4, reviewCount: 1, sold: 720, weight: 300, desc: 'Over-ear headphones with 40hr battery, deep bass drivers and foldable design.', specs: { Playback: '40 hours', Drivers: '45mm', Bluetooth: 'v5.2', Weight: '230g' } },
    { title: 'Zentech Watch Fit 2 AMOLED Smartwatch', cat: 'audio-wearables', brand: 'Zentech', vendorId: vElectro.id, price: 2999, mrp: 4999, stock: 65, images: imgs('watches', 0, 2), badge: 'NEW_ARRIVAL', sponsored: true, rating: 4.2, sold: 380, weight: 150, freeShipping: true, desc: '1.85" AMOLED always-on display, SpO2, 100+ sports modes and 14-day battery.', specs: { Display: '1.85" AMOLED', Battery: '14 days', Sports: '100+ modes', Water: '5ATM' } },
    { title: 'TechNova Pad 11 Tablet (Snapdragon, 8GB/128GB)', cat: 'laptops', brand: 'TechNova', vendorId: vElectro.id, price: 18999, mrp: 24999, stock: 22, images: imgs('laptops', 1, 2), rating: 4.1, sold: 140, weight: 480, desc: '11" 2K display tablet with quad speakers, stylus support and kids mode.', specs: { Display: '11" 2K', RAM: '8GB', Storage: '128GB', Battery: '8000mAh' } },

    // ---- URBAN THREADS (3P) ----
    { title: 'UrbanEdge Classic Cotton Round Neck T-Shirt', cat: 'mens-clothing', brand: 'UrbanEdge', vendorId: vThreads.id, price: 499, mrp: 999, stock: 150, images: imgs('tshirts', 0, 3), badge: 'BESTSELLER', featured: true, rating: 4.2, reviewCount: 1, sold: 1300, weight: 250, desc: '100% combed cotton, bio-washed for extra softness. A wardrobe staple in classic fits.', variants: [{ name: 'S / Navy', stock: 30 }, { name: 'M / Navy', stock: 40 }, { name: 'L / Navy', stock: 40 }, { name: 'M / Black', stock: 40 }], specs: { Fabric: '100% Combed Cotton', Fit: 'Regular', Sleeve: 'Half', Wash: 'Machine wash cold' } },
    { title: 'UrbanEdge Oversized Drop-Shoulder Tee', cat: 'mens-clothing', brand: 'UrbanEdge', vendorId: vThreads.id, price: 649, mrp: 1299, stock: 90, images: imgs('tshirts', 1, 2), badge: 'NEW_ARRIVAL', rating: 4.3, sold: 240, weight: 280, desc: 'Heavy 240 GSM French terry with dropped shoulders for the perfect streetwear silhouette.', variants: [{ name: 'M / Off-White', stock: 30 }, { name: 'L / Off-White', stock: 30 }, { name: 'XL / Off-White', stock: 30 }], specs: { Fabric: '240 GSM French Terry', Fit: 'Oversized', Neck: 'Ribbed round' } },
    { title: 'Sana Collection Chikankari Straight Kurta', cat: 'womens-ethnic', brand: 'UrbanEdge', vendorId: vThreads.id, price: 899, mrp: 1899, stock: 60, images: imgs('kurtas', 0, 3), badge: 'BESTSELLER', featured: true, rating: 4.5, reviewCount: 2, sold: 560, weight: 300, desc: 'Hand-embroidered Lucknowi chikankari kurta in breathable cotton. Festive-ready elegance.', variants: [{ name: 'S / White', stock: 15 }, { name: 'M / White', stock: 20 }, { name: 'L / White', stock: 15 }, { name: 'M / Peach', stock: 10 }], specs: { Fabric: 'Cotton Cambric', Work: 'Chikankari embroidery', Length: 'Calf length', Occasion: 'Festive & office' } },
    { title: 'Sana Collection Anarkali Gown with Dupatta', cat: 'womens-ethnic', brand: 'UrbanEdge', vendorId: vThreads.id, price: 1899, mrp: 3499, stock: 40, images: imgs('kurtas', 1, 2), rating: 4.4, sold: 180, weight: 500, desc: 'Floor-length anarkali in flowy georgette with zari border and matching dupatta.', specs: { Fabric: 'Georgette', Work: 'Zari border', Includes: 'Dupatta', Care: 'Dry clean' } },
    { title: 'Stepsy StreetChunk Casual Sneakers', cat: 'footwear', brand: 'Stepsy', vendorId: vThreads.id, price: 1399, mrp: 2799, stock: 70, images: imgs('shoes', 1, 3), badge: 'DEAL', sponsored: true, rating: 4.0, sold: 290, weight: 650, desc: 'Chunky-sole sneakers with memory foam insole — street style meets all-day comfort.', variants: [{ name: 'UK 7 / White', stock: 20 }, { name: 'UK 8 / White', stock: 25 }, { name: 'UK 9 / White', stock: 25 }], specs: { Sole: 'Chunky EVA', Insole: 'Memory foam', Style: 'Sneaker' } },

    // ---- HOMENEST (3P) ----
    { title: 'CozyNest Nordic Bedside Table Lamp (Walnut)', cat: 'home-kitchen', brand: 'CozyNest', vendorId: vHome.id, price: 1299, mrp: 2199, stock: 48, images: imgs('lamps', 0, 2), featured: true, rating: 4.3, reviewCount: 1, sold: 210, weight: 1200, desc: 'Hand-finished walnut base with linen shade. Warm, glare-free light for bedrooms and study nooks.', specs: { Material: 'Walnut + Linen', Bulb: 'E27 included', Height: '45cm', Switch: 'Inline' } },
    { title: 'CozyNest Luma Floor Lamp (Tripod, Oak Finish)', cat: 'home-kitchen', brand: 'CozyNest', vendorId: vHome.id, price: 2299, mrp: 3999, stock: 25, images: imgs('lamps', 1, 2), badge: 'NEW_ARRIVAL', rating: 4.2, sold: 90, weight: 3500, desc: 'Mid-century tripod floor lamp that turns any corner into a cosy reading spot.', specs: { Height: '150cm', Finish: 'Oak', Bulb: 'E27', Cord: '1.8m' } },
    { title: 'KitchMate AirFry Max 4.5L Digital Air Fryer', cat: 'home-kitchen', brand: 'KitchMate', vendorId: vHome.id, price: 5499, mrp: 8999, stock: 30, images: imgs('kitchens', 1, 2), badge: 'BESTSELLER', sponsored: true, rating: 4.5, reviewCount: 1, sold: 330, weight: 5000, desc: 'Fry, bake, roast and grill with 90% less oil. 8 presets and digital touch panel.', specs: { Capacity: '4.5L', Power: '1400W', Presets: '8', Warranty: '2 years' } },
    { title: 'CozyNest Cloud Comfort 2-Seater Loveseat (Ivory)', cat: 'home-kitchen', brand: 'CozyNest', vendorId: vHome.id, price: 17999, mrp: 27999, stock: 6, images: imgs('sofas', 1, 2), rating: 4.0, sold: 45, weight: 26000, desc: 'Compact loveseat with cloud-soft cushions — perfect for apartments.', specs: { Frame: 'Engineered hardwood', Fabric: 'Boucle', Seats: '2', Assembly: 'Carpenter provided' } },
    { title: 'Trailpack Urbanite 20L Daypack', cat: 'bags-luggage', brand: 'Trailpack', vendorId: vHome.id, price: 749, mrp: 1499, stock: 110, images: imgs('bags', 1, 2), rating: 4.1, sold: 480, weight: 400, freeShipping: true, desc: 'Lightweight everyday daypack with bottle pocket and anti-theft back zip.', specs: { Capacity: '20L', Material: 'Water-repellent polyester', Laptop: 'Up to 14"' } },

    // ---- PENDING REVIEW (vendor product with autoApprove off demo path) ----
    { title: 'Zentech Studio 34" Curved Ultrawide Monitor', cat: 'laptops', brand: 'Zentech', vendorId: vElectro.id, price: 21999, mrp: 31999, stock: 15, images: imgs('laptops', 2, 1), status: 'ACTIVE', rating: 4.3, sold: 60, weight: 6000, desc: '100Hz curved ultrawide for immersive work and play.', specs: { Panel: 'VA 100Hz', Resolution: '3440x1440', Curvature: '1500R', Ports: 'HDMI, DP' } as any, featured: false },

    // ---- REFURBISHED / RENEWED (platform + vendors) ----
    { title: 'TechNova Pulse X5 5G (Refurbished, 8GB/128GB, Cosmic Black)', cat: 'mobiles', brand: 'TechNova', sellerType: 'PLATFORM', price: 11499, mrp: 19999, cost: 9200, stock: 14, images: imgs('phones', 3, 3), badge: 'DEAL', condition: 'REFURBISHED', refurbGrade: 'EXCELLENT', rating: 4.1, reviewCount: 1, sold: 210, weight: 400, refurbNote: '6-month Lastrivon refurbished warranty. Charger, cable and pre-applied screen guard included; original box not included.', desc: 'Certified refurbished Pulse X5 with minimum 85% battery health. Fully inspected across 21 checkpoints and backed by a 6-month warranty.', specs: { Display: '6.67" FHD+ AMOLED 120Hz', Processor: 'Snapdragon 7 Gen 3', Battery: '5000mAh, 67W', Condition: 'Excellent — like new', Warranty: '6 months (refurb)' } },
    { title: 'Zentech AirBook 14 (Refurbished, i5 13th Gen, 16GB/512GB)', cat: 'laptops', brand: 'Zentech', sellerType: 'PLATFORM', price: 39990, mrp: 65990, cost: 32000, stock: 7, images: imgs('laptops', 3, 2), condition: 'REFURBISHED', refurbGrade: 'GOOD', rating: 4.2, sold: 45, weight: 1400, refurbNote: '3-month Lastrivon refurbished warranty. Original charger included; light scuffs on the lid, screen is flawless.', desc: 'Corporate-lease return, professionally re-imaged with genuine Windows 11. Keyboard, trackpad, battery and all ports tested.', specs: { Display: '14" 2.8K OLED', CPU: 'Intel Core i5-1340P', RAM: '16GB LPDDR5', Storage: '512GB NVMe SSD', Condition: 'Good — light signs of use', Warranty: '3 months (refurb)' } },
    { title: 'TechNova SonicBoom 40H Bluetooth Headphones (Refurbished)', cat: 'audio-wearables', brand: 'TechNova', vendorId: vElectro.id, price: 2199, mrp: 5999, stock: 22, images: imgs('headphones', 2, 2), badge: 'DEAL', condition: 'REFURBISHED', refurbGrade: 'GOOD', rating: 4.0, sold: 130, weight: 300, refurbNote: '6-month Volt Electronics warranty. Freshly replaced ear cushions; carry pouch included.', desc: 'Refurbished SonicBoom with 40hr battery and deep bass drivers — fully tested and re-packaged by Volt Electronics.', specs: { Playback: '40 hours', Drivers: '45mm', Bluetooth: 'v5.2', Condition: 'Good' } },
    { title: 'Zentech Watch Fit 2 AMOLED Smartwatch (Refurbished, Excellent)', cat: 'audio-wearables', brand: 'Zentech', vendorId: vElectro.id, price: 1999, mrp: 4999, stock: 18, images: imgs('watches', 1, 2), condition: 'REFURBISHED', refurbGrade: 'EXCELLENT', rating: 4.3, sold: 95, weight: 150, freeShipping: true, refurbNote: 'Like-new with brand-new strap. 6-month warranty and charging cable included.', desc: 'Renewed Watch Fit 2 with 1.85" AMOLED display, SpO2 and 100+ sports modes — factory-tested with a fresh strap.', specs: { Display: '1.85" AMOLED', Battery: '14 days', Sports: '100+ modes', Condition: 'Excellent — like new' } },
    { title: 'TechNova Pad 11 Tablet (Refurbished, 8GB/128GB)', cat: 'laptops', brand: 'TechNova', vendorId: vElectro.id, price: 13499, mrp: 24999, stock: 12, images: imgs('laptops', 4, 2), condition: 'REFURBISHED', refurbGrade: 'GOOD', rating: 4.0, sold: 60, weight: 480, refurbNote: '6-month warranty. USB-C cable included; stylus and cover not included.', desc: 'Refurbished Pad 11 with 11" 2K display and quad speakers — screen, stylus layer and battery all quality checked.', specs: { Display: '11" 2K', RAM: '8GB', Storage: '128GB', Condition: 'Good' } },
    { title: 'KitchMate BrewPro 12-Cup Coffee Maker (Refurbished)', cat: 'home-kitchen', brand: 'KitchMate', vendorId: vHome.id, price: 1899, mrp: 5499, stock: 9, images: imgs('kitchens', 2, 1), condition: 'REFURBISHED', refurbGrade: 'FAIR', rating: 3.9, sold: 35, weight: 2200, refurbNote: 'Deep-cleaned, descaled and brew-tested. 3-month warranty; glass carafe included.', desc: 'Return-restored BrewPro coffee maker — fully descaled, brew cycle verified and safety tested. Cosmetic marks on the housing.', specs: { Capacity: '12 cups', Power: '900W', Features: 'Keep warm, Anti-drip', Condition: 'Fair — visible signs of use' } },
  ]

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)
  const catMap: Record<string, string> = { mobiles: catMobiles.id, laptops: catLaptops.id, 'audio-wearables': catAudio.id, footwear: catFootwear.id, 'mens-clothing': catMen.id, 'womens-ethnic': catEthnic.id, 'home-kitchen': catHome.id, beauty: catBeauty.id, 'bags-luggage': catBags.id }
  const brandMap: Record<string, string> = { TechNova: bTechNova.id, Zentech: bZentech.id, UrbanEdge: bUrbanEdge.id, Stepsy: bStepsy.id, CozyNest: bCozyNest.id, GlowEssence: bGlowEssence.id, Trailpack: bTrailpack.id, KitchMate: bKitchMate.id }

  const createdProducts: Record<string, { id: string; price: number; vendorId: string | null; title: string; image: string; stock: number; freeShipping: boolean; cost: number | null; categoryCommission: number | null }> = {}

  for (const p of products) {
    const sellerType = p.sellerType ?? (p.vendorId ? 'VENDOR' : 'PLATFORM')
    const prod = await db.product.create({
      data: {
        title: p.title, slug: slugify(p.title), description: p.desc,
        specs: p.specs ? JSON.stringify(p.specs) : null,
        sellerType, vendorId: sellerType === 'VENDOR' ? p.vendorId : null,
        categoryId: catMap[p.cat], brandId: brandMap[p.brand],
        images: JSON.stringify(p.images), price: p.price, mrp: p.mrp, cost: p.cost ?? null,
        stock: p.stock, status: (p as any).status ?? 'ACTIVE',
        isFeatured: !!p.featured, badge: p.badge ?? null, sponsored: !!p.sponsored,
        condition: p.condition === 'REFURBISHED' ? 'REFURBISHED' : 'NEW',
        refurbGrade: p.condition === 'REFURBISHED' ? (p.refurbGrade ?? 'GOOD') : null,
        refurbNote: p.condition === 'REFURBISHED' ? (p.refurbNote ?? null) : null,
        rating: p.rating ?? 0, reviewCount: p.reviewCount ?? 0, soldCount: p.sold ?? 0,
        weightGrams: p.weight ?? 500, freeShipping: !!p.freeShipping,
      },
    })
    if (p.variants) {
      let vi = 0
      for (const v of p.variants) {
        vi += 1
        await db.productVariant.create({
          data: { productId: prod.id, name: v.name, sku: `${prod.id.slice(-6)}-V${vi}`, price: v.price ?? null, stock: v.stock },
        })
      }
    }
    await db.stockMovement.create({ data: { productId: prod.id, delta: p.stock, reason: 'SEED', actorName: 'seed' } })
    createdProducts[p.title] = {
      id: prod.id, price: p.price, vendorId: (p as any).vendorId ?? null,
      title: p.title, image: p.images[0] ?? '', stock: p.stock,
      freeShipping: !!p.freeShipping, cost: p.cost ?? null,
      categoryCommission: p.cat === 'footwear' ? 12 : null,
    }
  }

  // ---------------- Coupons ----------------
  await db.coupon.create({ data: { code: 'WELCOME10', description: '10% off on orders above ₹499 (max ₹200)', type: 'PERCENT', value: 10, minOrder: 499, maxDiscount: 200, usageLimit: 1000, usedCount: 0 } })
  await db.coupon.create({ data: { code: 'SAVE500', description: 'Flat ₹500 off on orders above ₹4,999', type: 'FLAT', value: 500, minOrder: 4999, usageLimit: 500, usedCount: 0 } })
  await db.coupon.create({ data: { code: 'FESTIVE20', description: '20% off on orders above ₹1,999 (max ₹1,000)', type: 'PERCENT', value: 20, minOrder: 1999, maxDiscount: 1000, usageLimit: 300, usedCount: 0 } })

  // ---------------- Banners ----------------
  await db.banner.create({ data: { title: 'Maha Bharat Sale - Up to 70% OFF', imageUrl: bannerImg('banner1', 0), link: 'listing:deals', position: 'HERO', sortOrder: 1 } })
  await db.banner.create({ data: { title: 'Big Gadget Days - Electronics Fiesta', imageUrl: bannerImg('banner2', 0), link: 'listing:electronics', position: 'HERO', sortOrder: 2 } })
  await db.banner.create({ data: { title: 'Fashion Carnival - New Season Styles', imageUrl: bannerImg('banner3', 0), link: 'listing:fashion', position: 'HERO', sortOrder: 3 } })
  await db.banner.create({ data: { title: 'Home Makeover Fest', imageUrl: bannerImg('banner1', 1), link: 'listing:home-kitchen', position: 'PROMO', sortOrder: 1 } })
  await db.banner.create({ data: { title: 'Beauty Bonanza', imageUrl: bannerImg('banner3', 1), link: 'listing:beauty', position: 'PROMO', sortOrder: 2 } })
  await db.banner.create({ data: { title: 'Renewed Store — Certified Refurbished from ₹1,899', imageUrl: bannerImg('banner2', 1), link: 'listing:renewed', position: 'HERO', sortOrder: 4 } })

  // ---------------- Addresses ----------------
  await db.address.create({ data: { userId: rahul.id, fullName: 'Rahul Sharma', phone: '9876511111', line1: 'B-402, Sunrise Apartments', line2: 'Powai', city: 'Mumbai', state: 'Maharashtra', pincode: '400076', type: 'HOME', isDefault: true } })
  await db.address.create({ data: { userId: rahul.id, fullName: 'Rahul Sharma (Office)', phone: '9876511111', line1: 'Tech Park One, 4th Floor', line2: 'Andheri East', city: 'Mumbai', state: 'Maharashtra', pincode: '400069', type: 'WORK' } })
  await db.address.create({ data: { userId: priya.id, fullName: 'Priya Patel', phone: '9876522222', line1: '12, Green Park Society', line2: 'Satellite', city: 'Ahmedabad', state: 'Gujarat', pincode: '380015', type: 'HOME', isDefault: true } })

  // ---------------- Wishlist ----------------
  const phone1 = createdProducts['TechNova Pulse X5 5G (8GB RAM, 128GB, Cosmic Black)']
  const lamp1 = createdProducts['CozyNest Nordic Bedside Table Lamp (Walnut)']
  const kurta1 = createdProducts['Sana Collection Chikankari Straight Kurta']
  await db.wishlistItem.createMany({ data: [{ userId: rahul.id, productId: lamp1.id }, { userId: rahul.id, productId: kurta1.id }, { userId: priya.id, productId: phone1.id }] })

  // ---------------- Orders (historical, for dashboards) ----------------
  const shipAddrRahul = JSON.stringify({ fullName: 'Rahul Sharma', phone: '9876511111', line1: 'B-402, Sunrise Apartments', line2: 'Powai', city: 'Mumbai', state: 'Maharashtra', pincode: '400076' })

  const defaultCommission = 10
  const settingsMap2: Record<string, string> = {}
  for (const [k, v] of settings) settingsMap2[k] = v
  const freeThreshold = parseFloat(settingsMap2['shipping.freeThreshold'])
  const baseFee = parseFloat(settingsMap2['shipping.baseFee'])

  async function seededOrder(opts: {
    orderNumber: string; user: string; daysAgo: number;
    items: { key: string; qty: number; variantName?: string }[];
    couponCode?: string; paymentMethod?: string; delivered: boolean; paymentStatus?: string;
  }) {
    const userId = opts.user
    const daysAgoMs = opts.daysAgo * 86400000
    const createdAt = new Date(Date.now() - daysAgoMs)

    const resolved = opts.items.map((i) => ({ ...createdProducts[i.key], qty: i.qty, variantName: i.variantName }))
    const itemsTotal = round2(resolved.reduce((s, r) => s + r.price * r.qty, 0))

    let couponDiscount = 0
    if (opts.couponCode) {
      const c = await db.coupon.findUnique({ where: { code: opts.couponCode } })
      if (c && itemsTotal >= c.minOrder) {
        couponDiscount = c.type === 'PERCENT' ? Math.min(round2((itemsTotal * c.value) / 100), c.maxDiscount ?? Infinity) : c.value
        await db.coupon.update({ where: { id: c.id }, data: { usedCount: { increment: 1 } } })
      }
    }
    const discountTotal = couponDiscount

    // group by vendor
    const groups = new Map<string | null, typeof resolved>()
    for (const r of resolved) {
      const k = r.vendorId ?? null
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(r)
    }
    let shippingTotal = 0
    const shipPerGroup = new Map<string | null, number>()
    for (const [vid, items] of groups) {
      const sub = round2(items.reduce((s, i) => s + i.price * i.qty, 0))
      const anyFree = items.some((i) => i.freeShipping)
      const fee = anyFree || sub >= freeThreshold ? 0 : baseFee
      shipPerGroup.set(vid, fee)
      shippingTotal += fee
    }
    const grandTotal = round2(itemsTotal - discountTotal + shippingTotal)

    const order = await db.order.create({
      data: {
        orderNumber: opts.orderNumber, userId,
        status: opts.delivered ? 'DELIVERED' : opts.paymentMethod === 'COD' ? 'CONFIRMED' : 'SHIPPED',
        paymentStatus: opts.paymentStatus ?? (opts.paymentMethod === 'COD' ? 'COD_PENDING' : 'PAID'),
        paymentMethod: opts.paymentMethod ?? 'UPI',
        itemsTotal, discountTotal, shippingTotal, grandTotal,
        couponCode: opts.couponCode ?? null, couponDiscount,
        shippingAddress: shipAddrRahul,
        createdAt, updatedAt: createdAt,
      },
    })

    for (const [vid, items] of groups) {
      const subTotal = round2(items.reduce((s, i) => s + i.price * i.qty, 0))
      const fee = shipPerGroup.get(vid) ?? 0
      const vendor = vid ? await db.vendor.findUnique({ where: { id: vid } }) : null
      const plan = vendor?.planId ? await db.subscriptionPlan.findUnique({ where: { id: vendor.planId } }) : null
      let commissionTotal = 0
      let vendorEarning = 0
      const sub = await db.subOrder.create({
        data: {
          orderId: order.id, vendorId: vid,
          status: opts.delivered ? 'DELIVERED' : 'SHIPPED',
          itemsTotal: subTotal, shippingFee: fee,
          createdAt, updatedAt: createdAt,
        },
      })
      for (const it of items) {
        const lineTotal = round2(it.price * it.qty)
        const discountShare = itemsTotal > 0 ? round2((couponDiscount * lineTotal) / itemsTotal) : 0
        const effectiveTotal = round2(lineTotal - discountShare)
        const prod = await db.product.findUnique({ where: { id: it.id }, include: { category: true, vendor: true } })
        let rate = defaultCommission
        if (prod?.commissionPercent != null) rate = prod.commissionPercent
        else if (prod?.category?.commissionPercent != null) rate = prod.category.commissionPercent
        else if (vendor?.commissionPercent != null) rate = vendor.commissionPercent
        if (rate > 0 && plan && plan.commissionDiscountPercent > 0) {
          rate = Math.max(0, rate - plan.commissionDiscountPercent)
        }
        const commissionAmount = vid ? round2((effectiveTotal * rate) / 100) : 0
        const earning = round2(effectiveTotal - commissionAmount)
        commissionTotal += commissionAmount
        vendorEarning += earning
        await db.orderItem.create({
          data: {
            subOrderId: sub.id, productId: it.id, titleSnapshot: it.title,
            variantName: it.variantName ?? null, imageSnapshot: it.image,
            unitPrice: it.price, qty: it.qty, lineTotal, discountShare, effectiveTotal,
            commissionRate: vid ? rate : 0, commissionAmount, vendorEarning: vid ? earning : 0,
            costSnapshot: it.cost, isPlatformOwned: !vid,
            status: opts.delivered ? 'DELIVERED' : 'ACTIVE',
          },
        })
        await db.product.update({ where: { id: it.id }, data: { stock: { decrement: it.qty }, soldCount: { increment: it.qty } } })
        await db.stockMovement.create({ data: { productId: it.id, delta: -it.qty, reason: 'ORDER', refId: order.orderNumber, actorName: 'seed', createdAt } })
      }
      commissionTotal = round2(commissionTotal)
      vendorEarning = round2(vendorEarning)
      await db.subOrder.update({ where: { id: sub.id }, data: { commissionTotal, vendorEarning } })

      if (vid) {
        await db.vendorLedger.create({ data: { vendorId: vid, subOrderId: sub.id, type: 'SALE_CREDIT', direction: 'CREDIT', amount: subTotal, notes: `Sale ${order.orderNumber}`, settled: false, createdAt } })
        if (commissionTotal > 0) {
          await db.vendorLedger.create({ data: { vendorId: vid, subOrderId: sub.id, type: 'COMMISSION_DEBIT', direction: 'DEBIT', amount: commissionTotal, notes: `Commission ${order.orderNumber}`, settled: false, createdAt } })
        }
        await db.vendorLedger.create({ data: { vendorId: vid, subOrderId: sub.id, type: 'SALE_CREDIT', direction: 'CREDIT', amount: fee, notes: `Shipping collected ${order.orderNumber}`, settled: false, createdAt } })
      }

      await db.shipmentEvent.create({ data: { subOrderId: sub.id, status: 'CONFIRMED', note: 'Order confirmed', createdAt } })
      await db.shipmentEvent.create({ data: { subOrderId: sub.id, status: 'SHIPPED', note: `Shipped via ${vid ? vendor?.name : 'Lastrivon Express'}`, createdAt: new Date(createdAt.getTime() + 86400000) } })
      if (opts.delivered) {
        await db.shipmentEvent.create({ data: { subOrderId: sub.id, status: 'DELIVERED', note: 'Delivered successfully', createdAt: new Date(createdAt.getTime() + 3 * 86400000) } })
      }
    }

    await db.payment.create({
      data: {
        orderId: order.id, method: opts.paymentMethod ?? 'UPI', amount: grandTotal,
        status: opts.paymentMethod === 'COD' ? 'COD_PENDING' : 'SUCCESS',
        gatewayRef: opts.paymentMethod === 'COD' ? null : `pay_seed_${randomBytes(6).toString('hex')}`,
        feeAmount: opts.paymentMethod === 'COD' ? 0 : round2(grandTotal * 0.02),
        createdAt,
      },
    })
    return order
  }

  const o1 = await seededOrder({ orderNumber: 'SK-100001', user: rahul.id, daysAgo: 12, delivered: true, couponCode: 'WELCOME10', items: [{ key: 'TechNova Pulse X5 Pro 5G (12GB/256GB, Aurora Silver)', qty: 1 }, { key: 'Sana Collection Chikankari Straight Kurta', qty: 2, variantName: 'M / White' }] })
  await seededOrder({ orderNumber: 'SK-100002', user: rahul.id, daysAgo: 8, delivered: false, items: [{ key: 'KitchMate AirFry Max 4.5L Digital Air Fryer', qty: 1 }, { key: 'TechNova Buds Pro 2 ANC Earbuds', qty: 1 }] })
  await seededOrder({ orderNumber: 'SK-100003', user: priya.id, daysAgo: 6, delivered: true, paymentMethod: 'COD', items: [{ key: 'UrbanEdge Classic Cotton Round Neck T-Shirt', qty: 3, variantName: 'L / Navy' }] })
  await seededOrder({ orderNumber: 'SK-100004', user: priya.id, daysAgo: 3, delivered: false, couponCode: 'SAVE500', items: [{ key: 'Zentech AirBook 14 (Intel i5 13th Gen, 16GB/512GB SSD)', qty: 1 }] })
  await seededOrder({ orderNumber: 'SK-100005', user: rahul.id, daysAgo: 1, delivered: false, paymentMethod: 'CARD', items: [{ key: 'Zentech Watch Fit 2 AMOLED Smartwatch', qty: 1 }, { key: 'GlowEssence Vitamin C Face Serum 30ml', qty: 2 }] })

  // ---------------- Reviews (verified for delivered items) ----------------
  const reviews: { userName: string; productKey: string; rating: number; title?: string; comment: string; daysAgo: number }[] = [
    { userName: rahul.id, productKey: 'TechNova Pulse X5 Pro 5G (12GB/256GB, Aurora Silver)', rating: 5, title: 'Flagship killer!', comment: 'Blazing fast, camera is superb in daylight. Battery easily lasts a day of heavy use.', daysAgo: 9 },
    { userName: priya.id, productKey: 'TechNova Pulse X5 Pro 5G (12GB/256GB, Aurora Silver)', rating: 4, title: 'Great value', comment: 'Charging is insanely fast. Slightly heavy but totally worth the price.', daysAgo: 7 },
    { userName: rahul.id, productKey: 'Sana Collection Chikankari Straight Kurta', rating: 5, title: 'Beautiful embroidery', comment: 'Fabric quality is premium, embroidery is neat. Fits true to size.', daysAgo: 8 },
    { userName: priya.id, productKey: 'Sana Collection Chikankari Straight Kurta', rating: 4, comment: 'Loved the colour and comfort. Delivery took a day extra.', daysAgo: 6 },
    { userName: rahul.id, productKey: 'GlowEssence Vitamin C Face Serum 30ml', rating: 5, comment: 'Visible glow in 3 weeks. Non-sticky and absorbs fast.', daysAgo: 2 },
    { userName: priya.id, productKey: 'UrbanEdge Classic Cotton Round Neck T-Shirt', rating: 4, comment: 'Good cotton quality for the price. Stitching is tidy.', daysAgo: 5 },
    { userName: rahul.id, productKey: 'KitchMate AirFry Max 4.5L Digital Air Fryer', rating: 5, title: 'Game changer', comment: 'Crispy fries with almost no oil. Basket is easy to clean.', daysAgo: 6 },
  ]
  for (const r of reviews) {
    const prod = createdProducts[r.productKey]
    await db.review.create({
      data: { productId: prod.id, userId: r.userName, rating: r.rating, title: r.title ?? null, comment: r.comment, verified: true, status: 'APPROVED', createdAt: new Date(Date.now() - r.daysAgo * 86400000) },
    })
  }

  // ---------------- Settlement (one historical payout for Volt) ----------------
  const unsettled = await db.vendorLedger.findMany({ where: { vendorId: vElectro.id, settled: false } })
  const balance = round2(unsettled.reduce((s, e) => s + (e.direction === 'CREDIT' ? e.amount : -e.amount), 0))
  if (balance > 0) {
    const st = await db.settlement.create({ data: { vendorId: vElectro.id, amount: balance, status: 'PROCESSED', reference: `PAYOUT-${randomBytes(4).toString('hex').toUpperCase()}`, notes: 'Weekly settlement', processedAt: new Date(Date.now() - 2 * 86400000) } })
    await db.vendorLedger.updateMany({ where: { id: { in: unsettled.map((e) => e.id) } }, data: { settled: true, settlementId: st.id } })
    await db.vendorLedger.create({ data: { vendorId: vElectro.id, type: 'SETTLEMENT_PAYOUT', direction: 'DEBIT', amount: balance, settled: true, settlementId: st.id, notes: 'Payout transferred', createdAt: new Date(Date.now() - 2 * 86400000) } })
  }

  // ---------------- Notifications ----------------
  await db.notification.createMany({
    data: [
      { userId: rahul.id, title: 'Order SK-100005 confirmed', body: 'Your order has been confirmed and is being packed.', type: 'ORDER' },
      { userId: rahul.id, title: 'Order SK-100002 shipped', body: 'Your order is on the way. Track it from My Orders.', type: 'ORDER' },
      { userId: priya.id, title: 'Welcome to Lastrivon Kart!', body: 'Use code WELCOME10 for 10% off your first order.', type: 'SYSTEM' },
      { userId: admin.id, title: 'New vendor awaiting approval', body: 'Glow Beauty Co has completed registration and awaits KYC approval.', type: 'VENDOR' },
    ],
  })

  // ---------------- Audit ----------------
  await db.auditLog.create({ data: { actorId: admin.id, actorName: 'Arjun Mehta', action: 'SEED', entity: 'SYSTEM', detail: 'Initial marketplace data seeded' } })

  console.log('Seed complete!')
  console.log('Products created:', Object.keys(createdProducts).length)
  console.log('Image pool sizes:', Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length])))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
