
const CACHE_SHELL = 'storymap-shell-v3';
const CACHE_DYNAMIC = 'storymap-dynamic-v3';
const CACHE_TILES = 'storymap-tiles-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './bundle.js',
  './src/styles/main.css',
  './src/utils/api.js',
  './src/utils/idb.js',
  './src/utils/push.js',
  './src/utils/router.js',
  './src/utils/helpers.js',
  './src/pages/home.js',
  './src/pages/explore.js',
  './src/pages/detail.js',
  './src/pages/add-story.js',
  './src/pages/favorites.js',
  './src/pages/auth.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_SHELL).then(async (cache) => {
      const results = await Promise.allSettled(
        SHELL_FILES.map(url => cache.add(url))
      );
      const failed = results
        .map((r, i) => r.status === 'rejected' ? SHELL_FILES[i] : null)
        .filter(Boolean);
      if (failed.length) {
        console.warn('[SW] Files failed to cache:', failed);
      } else {
        console.log('[SW] All shell files cached successfully');
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_SHELL && k !== CACHE_DYNAMIC && k !== CACHE_TILES)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!['http:', 'https:'].includes(url.protocol)) return;

  if (url.hostname === 'story-api.dicoding.dev') {
    event.respondWith(networkFirstWithFallback(request, CACHE_DYNAMIC));
    return;
  }

  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(cacheFirstWithNetwork(request, CACHE_TILES));
    return;
  }

  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    event.respondWith(cacheFirstWithNetwork(request, CACHE_DYNAMIC));
    return;
  }

  event.respondWith(cacheFirstWithOfflineFallback(request));
});

async function networkFirstWithFallback(request, cacheName) {
  try {
    const networkRes = await fetch(request, { signal: AbortSignal.timeout(8000) });
    if (networkRes.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: true, message: 'Offline - data tidak tersedia', listStory: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkRes = await fetch(request);
    if (networkRes.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function cacheFirstWithOfflineFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkRes = await fetch(request);
    if (networkRes.ok) {
      const cache = await caches.open(CACHE_SHELL);
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'StoryMap', body: event.data?.text() || 'Ada cerita baru!' };
  }

  const title = payload.title || 'StoryMap 🗺️';
  const storyId = payload.storyId || payload.options?.data?.storyId || null;

  const options = {
    body: payload.body || payload.options?.body || '✨ Ada cerita baru yang baru dibagikan!',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    image: payload.image || payload.options?.image || null,
    tag: `storymap-${storyId || Date.now()}`,
    data: {
      storyId,
      url: storyId ? `/#/stories/${storyId}` : '/',
    },
    actions: [
      { action: 'view', title: '👁 Lihat Cerita' },
      { action: 'dismiss', title: '✕ Tutup' },
    ],
    vibrate: [200, 100, 200],
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked, action:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const { storyId } = event.notification.data || {};
  const targetPath = storyId ? `/stories/${storyId}` : '/';
  const targetUrl = `${self.location.origin}/#${targetPath}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', payload: targetPath });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-stories') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        clientList.forEach(c => c.postMessage({ type: 'SYNC_OFFLINE' }));
      })
    );
  }
});

console.log('[SW] Service Worker v3 loaded');
