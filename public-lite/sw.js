const CACHE_NAME = "whites-public-lite-offline3";
const SHELL_ASSETS = [
  "./",
  "index.html",
  "faq.html",
  "rules.html",
  "privacy.html",
  "styles.css?v=20260705-offline3",
  "app.js?v=20260705-offline3",
  "reports.sample.json",
  "vendor/leaflet/leaflet.css?v=1.9.4",
  "vendor/leaflet/leaflet.js?v=1.9.4",
  "vendor/leaflet/images/marker-icon.png",
  "vendor/leaflet/images/marker-icon-2x.png",
  "vendor/leaflet/images/marker-shadow.png"
];

const NETWORK_FIRST_PATHS = new Set(["/reports.json", "/reports.sample.json"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key)))))
      .then(() => self.clients.claim())
  );
});

function isPrivateOrMutable(url, request) {
  return request.method !== "GET"
    || url.pathname.includes("/api/")
    || url.pathname.includes("/submissions/");
}

function relativePath(url) {
  const scope = new URL(self.registration.scope);
  return url.pathname.startsWith(scope.pathname)
    ? `/${url.pathname.slice(scope.pathname.length)}`
    : url.pathname;
}

async function networkFirst(request, fallbackRequest) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request))
      || (fallbackRequest ? await cache.match(fallbackRequest) : null)
      || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || isPrivateOrMutable(url, request)) {
    return;
  }

  const path = relativePath(url);
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "index.html"));
    return;
  }

  if (NETWORK_FIRST_PATHS.has(path)) {
    event.respondWith(networkFirst(request, "reports.sample.json"));
    return;
  }

  event.respondWith(cacheFirst(request));
});
