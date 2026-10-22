/* Mabeet service worker: makes the site installable, shows push notifications, and keeps a friendly
   offline page for when the phone has no signal. Pages themselves are never cached: bookings must be live. */
const CACHE = "mabeet-offline-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener("push", (event) => {
  let message = { title: "Mabeet", body: "", url: "/" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // An empty or malformed push still shows the default notification.
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/icons/192",
      badge: "/icons/96",
      data: { url: message.url },
    }),
  );
});

/** Opens the notification's page, reusing an open Mabeet window. Only pages on this site are opened. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => "focus" in client);
      if (open) return open.navigate(url).then((client) => (client ?? open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
