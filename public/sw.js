const SHELL = "hm-shell-v2";
const PUBLIC = "hm-public-v1";
const SHELL_FILES = [
  "/",
  "/manifest.webmanifest",
  "/owl.svg",
  "/icon-192.png",
  "/icon-512.png",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![SHELL, PUBLIC].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }
  if (url.pathname.startsWith("/functions/") || url.pathname.includes("/rest/"))
    return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok)
            caches
              .open(SHELL)
              .then((cache) => cache.put(event.request, response.clone()));
          return response;
        }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {}
  const title = data.title || "Honzíkova moudra";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Dnešní moudro na tebe čeká.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { path: data.path || "/denni" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.path || "/denni";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const client = clients.find((item) => "focus" in item);
      if (client) {
        client.navigate(new URL(path, self.location.origin).href);
        return client.focus();
      }
      return self.clients.openWindow(new URL(path, self.location.origin).href);
    }),
  );
});
