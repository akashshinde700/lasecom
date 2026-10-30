/** E-waste categories accepted for pickup (shared by the form, API and admin panel). */
export const EWASTE_CATEGORIES = [
  { key: 'COMPUTERS', label: 'Computers & Laptops' },
  { key: 'MOBILES', label: 'Mobiles & Tablets' },
  { key: 'SERVERS', label: 'Servers & Networking' },
  { key: 'PRINTERS', label: 'Printers & Peripherals' },
  { key: 'DISPLAYS', label: 'Monitors & TVs' },
  { key: 'BATTERIES', label: 'Batteries & UPS' },
  { key: 'APPLIANCES', label: 'Appliances' },
  { key: 'CABLES', label: 'Cables, Boards & Accessories' },
  { key: 'OTHER', label: 'Other' },
] as const

export const EWASTE_CATEGORY_KEYS: string[] = EWASTE_CATEGORIES.map((c) => c.key)

export const EWASTE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  EWASTE_CATEGORIES.map((c) => [c.key, c.label])
)

export const EWASTE_STATUSES = ['NEW', 'SCHEDULED', 'COLLECTED', 'CLOSED', 'REJECTED']
