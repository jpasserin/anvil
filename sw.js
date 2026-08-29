// Anvil service worker — network-first for the document, cache-first for the shell.
// Bump CACHE on every change (keep it equal to APP_VERSION in index.html) so
// clients pick up the new build on the next reload.
const CACHE = "anvil-4";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icon.svg", "./icon-maskable.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // let cross-origin through untouched

  // The HTML document goes network-first so a reload while online always lands
  // on the newest build; falls back to cache when offline.
  const isDoc = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isDoc) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // Everything else (icons, manifest) is cache-first.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
