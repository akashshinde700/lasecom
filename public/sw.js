/* Lastrivon Kart India — Service Worker
 * Strategies:
 *  - Navigations (HTML): network-first → cache fallback → /offline.html
 *  - Static assets (_next/static, icons, images): cache-first + background refresh
 *  - /api/home (offline shell data): network-first → cache fallback
 *  - Everything else (POSTs, auth'd APIs): passthrough
 */
const VERSION = 'lk-v2'
const STATIC_CACHE = `${VERSION}-static`
const PAGES_CACHE = `${VERSION}-pages`
const DATA_CACHE = `${VERSION}-data`

const PRECACHE = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

const isStaticAsset = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/icons/') ||
  url.pathname === '/apple-touch-icon.png' ||
  url.pathname.startsWith('/images/') ||
  url.pathname.startsWith('/downloads/') ||
  /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/.test(url.pathname)

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 1) Page navigations: network-first, fall back to cache, then offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(PAGES_CACHE).then((cache) => cache.put('/', copy)).catch(() => {})
          return response
        })
        .catch(async () =>
          (await caches.match(request)) ||
          (await caches.match('/')) ||
          (await caches.match('/offline.html')) ||
          new Response('You are offline', { status: 503, headers: { 'Content-Type': 'text/html' } })
        )
    )
    return
  }

  // 2) Home feed data: network-first with cache fallback (offline home shell)
  if (url.pathname === '/api/home') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(DATA_CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
          return response
        })
        .catch(async () => (await caches.match(request)) || Response.error())
    )
    return
  }

  // 3) Immutable static assets: cache-first with background refresh
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
            }
            return response
          })
          .catch(() => cached)
        return cached || network
      })
    )
  }
  // 4) All other requests (APIs, auth): passthrough — never cached
})
