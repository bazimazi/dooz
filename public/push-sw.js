/* global self, clients */
/**
 * Push and notification handlers, imported into the generated service worker
 * (see `workbox.importScripts` in vite.config.ts), so precaching and offline
 * play stay exactly as Workbox builds them.
 *
 * A push is shown unless the app is already on screen and focused - then the
 * in-app notice covers it and a system banner on top would be noise. Tapping a
 * notification focuses an open window and takes it to the notice's screen, or
 * opens one. Only same-origin, relative paths are ever followed.
 */

function safePath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/';
}

function text(value, fallback, limit) {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, limit) : fallback;
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some((client) => client.visibilityState === 'visible' && client.focused)) return;

      await self.registration.showNotification(text(data.title, 'dooz', 120), {
        body: text(data.body, '', 300),
        tag: text(data.tag, text(data.kind, 'dooz', 40), 40),
        icon: '/brand/icon-192.png',
        badge: '/brand/icon-192.png',
        data: { url: safePath(data.url) },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    safePath(event.notification.data && event.notification.data.url),
    self.location.origin,
  );

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Sequential on purpose: the first window that can be reused wins.
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          // oxlint-disable-next-line no-await-in-loop
          await client.focus();
          // oxlint-disable-next-line no-await-in-loop
          if ('navigate' in client) await client.navigate(target.href);
          return;
        } catch {
          // An uncontrolled window cannot be navigated; open a fresh one below.
        }
      }
      await clients.openWindow(target.href);
    })(),
  );
});
