/* Golden Bites — service worker for push notifications (courier app).
 *
 * Only push: no fetch handler and no caching, so it never changes how the
 * app loads. The server sends JSON { title, body, tag, url, requireInteraction }
 * (GB-BE push-notifications.service.ts). */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Golden Bites', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Golden Bites';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || undefined,
      // A repeated call with the same tag rings again instead of updating silently.
      renotify: Boolean(data.tag),
      requireInteraction: Boolean(data.requireInteraction),
      vibrate: data.requireInteraction ? [400, 150, 400, 150, 400, 150, 400] : [200, 100, 200],
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: data.url || '/domiciliario' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/domiciliario';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).pathname.startsWith(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
