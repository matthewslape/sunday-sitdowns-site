// Sunday Sit Downs service worker — Web Push only, no caching (the site
// should always load fresh; this worker exists so devices can receive
// new-episode notifications).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch {}
  const title = data.title || "Sunday Sit Downs";
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || "A new episode is ready.",
    icon: "/apple-touch-icon.png",
    badge: "/apple-touch-icon.png",
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if ("focus" in w) { try { await w.focus(); return; } catch {} }
    }
    await self.clients.openWindow(url);
  })());
});
