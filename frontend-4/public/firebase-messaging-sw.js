// HealthSaathi AI - Firebase Cloud Messaging Service Worker
// Handles background push notifications when the web app is closed or in another tab

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { notification: { title: 'HealthSaathi Alert', body: event.data.text() } };
    }
  }

  const title = payload.notification?.title || payload.title || 'HealthSaathi Health Alert';
  const body = payload.notification?.body || payload.body || 'You have an important health update.';
  const data = payload.data || {};

  const options = {
    body,
    icon: '/images/ai-assistant.png',
    badge: '/images/ai-assistant.png',
    tag: data.notificationId || `healthsaathi-${Date.now()}`,
    data,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open_app', title: 'Open HealthSaathi' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
