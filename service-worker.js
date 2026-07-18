const VERSION = "13.10.8";
const SHELL_CACHE = `alantil-shell-${VERSION}`;
const RUNTIME_CACHE = `alantil-runtime-${VERSION}`;
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/404.html",
  "/src/app/bootstrap.js?v=13.10.7",
  "/src/shared/styles/app.css?v=13.10.7",
  "/src/features/onboarding/index.js?v=13.10.8",
  "/src/features/onboarding/onboarding.css?v=13.10.8",
  "/src/data/starter-dictionary.js?v=13.10.2",
  "/assets/icons/auth/google.svg",
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
    await Promise.all(names
      .filter((name) => name.startsWith("alantil-") && ![SHELL_CACHE, RUNTIME_CACHE].includes(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function navigationResponse(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match("/index.html")) || (await caches.match("/"));
  }
}

async function networkFirstStaticResponse(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

async function staticResponse(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
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

  // Application code and styles are always checked against the network first.
  // This prevents an older query string from pinning an obsolete module.
  if (url.pathname.startsWith("/src/") && ["script", "style", "worker"].includes(request.destination)) {
    event.respondWith(networkFirstStaticResponse(request));
    return;
  }
  if (url.pathname.startsWith("/src/shared/auth/") || url.pathname.startsWith("/src/features/account/") || url.pathname === "/src/config/supabase.js") {
    event.respondWith(networkFirstStaticResponse(request));
    return;
  }
  if (["image", "font"].includes(request.destination) || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/src/vendor/")) {
    event.respondWith(staticResponse(request));
  }
});
