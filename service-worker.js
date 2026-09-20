const VERSION = "16.7.0.9";
const SHELL_CACHE = "alantil-shell-" + VERSION;
const RUNTIME_CACHE = "alantil-runtime-" + VERSION;
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/404.html",
  "/src/app/bootstrap.js?v=16.7.0.9",
  "/src/app/router.js?v=16.7.0.9",
  "/src/app/shell.js?v=16.7.0.9",
  "/src/app/screen-registry.js?v=16.7.0.9",
  "/src/shared/styles/app.css?v=16.7.0.9",
  "/src/features/path/feature.js?v=16.7.0.9",
  "/src/shared/data/word-repository.js?v=16.7.0.9",
  "/src/shared/data/dictionary-store.js?v=16.7.0.9",
  "/assets/icons/ui/path-elbrus-white.png?v=13.15.10.1",
  "/assets/path/story-stele.webp?v=13.15.6"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.allSettled(CORE_ASSETS.map((asset) => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const stale = names.filter((name) => name.startsWith("alantil-") && ![SHELL_CACHE, RUNTIME_CACHE].includes(name));
    await Promise.all(stale.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function cachedShell() {
  const cache = await caches.open(SHELL_CACHE);
  return (await cache.match("/index.html")) || (await cache.match("/"));
}

async function navigationResponse(request) {
  const cached = await cachedShell();
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put("/index.html", response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function cacheFirst(request, cacheName = RUNTIME_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (["image", "font"].includes(request.destination) || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/src/vendor/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (["script", "style", "worker"].includes(request.destination) || url.pathname.startsWith("/src/data/dictionary-snapshot.json")) {
    event.respondWith(url.searchParams.has("v") ? cacheFirst(request) : staleWhileRevalidate(request));
  }
});
