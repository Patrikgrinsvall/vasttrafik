// sw.js – Västtrafik Delays Service Worker
const CACHE_NAME = 'vasttrafik-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

// ─── Install ───────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

// ─── Activate ──────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch (cache-first for static, network-first for API) ─────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Pass through API calls
  if (url.hostname.includes('vasttrafik') || url.hostname.includes('corsproxy')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(res => {
        if (res.ok && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      });
    }).catch(() => caches.match('/index.html'))
  );
});

// ─── Push Events (from push server if VAPID is configured) ────────
self.addEventListener('push', event => {
  let data = { title: 'Västtrafik', body: 'Ny trafikhändelse!' };
  try {
    data = event.data?.json() || data;
  } catch (e) {
    data.body = event.data?.text() || data.body;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'vasttrafik-delay',
      vibrate: [200, 100, 200],
      data: { url: data.url || 'https://www.vasttrafik.se' },
      actions: [
        { action: 'open', title: '🔍 Visa' },
        { action: 'close', title: '✕ Stäng' },
      ],
    })
  );
});

// ─── Notification Click ────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ─── Background Sync (poll when back online) ──────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'poll-delays') {
    event.waitUntil(pollAndNotify());
  }
});

// ─── Periodic Background Sync (requires permission + HTTPS) ───────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'poll-delays-periodic') {
    event.waitUntil(pollAndNotify());
  }
});

async function pollAndNotify() {
  const API = 'https://www.vasttrafik.se/api/trafficsituations/all';
  const PROXY = `https://corsproxy.io/?${encodeURIComponent(API)}`;

  let data;
  try {
    let res = await fetch(API).catch(() => null);
    if (!res?.ok) res = await fetch(PROXY);
    if (!res?.ok) return;
    data = await res.json();
  } catch (e) {
    return;
  }

  const items = Array.isArray(data) ? data : (data.trafficSituations || data.situations || []);
  const oneHourAgo = Date.now() - 3600_000;
  const recent = items.filter(item => {
    const start = item.startTime || item.creationTime || item.starttime || item.created;
    if (!start) return false;
    const t = new Date(start).getTime();
    return t >= oneHourAgo && t <= Date.now();
  });

  if (recent.length === 0) return;

  // Open a cache to check what we've seen
  const cache = await caches.open('vasttrafik-seen-ids');
  const seenRes = await cache.match('/seen-ids').catch(() => null);
  const seen = seenRes ? new Set(await seenRes.json()) : new Set();

  const newItems = recent.filter(item => {
    const id = item.situationNumber || item.id || JSON.stringify(item).slice(0, 60);
    return !seen.has(id);
  });

  if (newItems.length === 0) return;

  // Update seen cache
  newItems.forEach(item => {
    const id = item.situationNumber || item.id || JSON.stringify(item).slice(0, 60);
    seen.add(id);
  });
  await cache.put('/seen-ids', new Response(JSON.stringify([...seen])));

  const title = newItems.length === 1
    ? (newItems[0].title || 'Ny trafikhändelse')
    : `${newItems.length} nya trafikhändelser`;

  await self.registration.showNotification(`🚌 Västtrafik: ${title}`, {
    body: newItems.length === 1
      ? (newItems[0].description || 'Se appen för detaljer')
      : 'Se appen för detaljer',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'vasttrafik-delay',
    vibrate: [200, 100, 200],
    data: { url: '/' },
  });
}
