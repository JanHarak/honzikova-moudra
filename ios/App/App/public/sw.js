const SHELL = "hm-shell-v1";
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
