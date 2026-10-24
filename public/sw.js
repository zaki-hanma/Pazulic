// Kleiner Service Worker: App-Dateien offline verfügbar, Daten immer frisch aus dem Netz.
const C = "pazulic-v2";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(C).then((ca) => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match("./"))));
});

// ---------- Erinnerungen (Push) ----------
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Pazulic", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Pazulic", {
    body: d.body || "", tag: d.tag, renotify: true, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png",
    vibrate: [200, 100, 200], data: { url: d.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
