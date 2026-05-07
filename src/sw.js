const CACHE = 'zimu-__CACHE_VERSION__';
const PRECACHE_URLS = [
  '.',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-192.svg',
  'icon-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (k !== CACHE) return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Same-origin only
  if (url.origin !== self.location.origin) return;

  // For HTML navigation requests, try network first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(request).then(cached => cached || caches.match('.')))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        caches.open(CACHE).then(cache => cache.put(request, response.clone()));
        return response;
      }).catch(() => {});
      return cached || fetchPromise;
    })
  );
});
