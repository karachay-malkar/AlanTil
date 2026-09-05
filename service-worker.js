const VERSION = "13.15.12.6";
const SHELL_CACHE = `alantil-shell-${VERSION}`;
const RUNTIME_CACHE = `alantil-runtime-${VERSION}`;
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/404.html",
  "/src/app/bootstrap.js?v=13.15.12",
  "/src/shared/styles/app.css?v=13.15.12.7",
  "/src/features/onboarding/index.js?v=13.15.12",
  "/src/features/onboarding/onboarding.css?v=13.10.12",
  "/src/data/starter-dictionary.js?v=13.10.2",
  "/assets/icons/auth/google.svg",
  "/assets/icons/ui/path-elbrus-white.png?v=13.15.10.1",
  "/assets/path/story-stele.webp?v=13.15.6",
];

const NETWORK_FIRST_PATHS = new Set([
  "/src/config/analytics.js",
  "/src/config/supabase.js",
  "/src/config/words.js",
  "/src/features/profile/index.js",
  "/src/shared/data/word-repository.js",
  "/src/shared/domain/alan-display.js",
  "/src/shared/domain/word-structure-compat.js",
  "/src/shared/domain/word-normalizer.js",
  "/src/shared/i18n/index.js",
  "/src/shared/progress/progress-queue.js",
  "/src/shared/progress/progress-repository.js",
  "/src/shared/progress/progress-sync.js",
  "/src/shared/settings/user-settings-store.js",
  "/src/shared/ui/profile-navigation.js",
]);

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
    const staleAlanTilCaches = names.filter((name) => name.startsWith("alantil-") && ![SHELL_CACHE, RUNTIME_CACHE].includes(name));
    await Promise.all(staleAlanTilCaches.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function freshIndexResponse() {
  try {
    const response = await fetch("/index.html", { cache: "no-store", credentials: "same-origin" });
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put("/index.html", response.clone());
      return response;
    }
  } catch {
    // Fall through to the cached shell.
  }
  return (await caches.match("/index.html")) || (await caches.match("/")) || Response.error();
}

async function navigationResponse(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
      return response;
    }
    if (response.status === 404) return freshIndexResponse();
    return response;
  } catch {
    return (await caches.match(request)) || freshIndexResponse();
  }
}

async function networkFirstStaticResponse(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
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
      await cache.put(request, response.clone());
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

  if (url.pathname.startsWith("/src/shared/auth/")
      || url.pathname.startsWith("/src/shared/admin/")
      || url.pathname.startsWith("/src/shared/profile/")
      || url.pathname.startsWith("/src/shared/settings/")
      || url.pathname.startsWith("/src/features/admin/")
      || url.pathname.startsWith("/src/features/account/")
      || url.pathname.startsWith("/src/features/settings/")
      || NETWORK_FIRST_PATHS.has(url.pathname)) {
    event.respondWith(networkFirstStaticResponse(request));
    return;
  }
  if (url.pathname.startsWith("/src/") && ["script", "style", "worker"].includes(request.destination)) {
    event.respondWith(networkFirstStaticResponse(request));
    return;
  }
  if (["image", "font"].includes(request.destination) || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/src/vendor/")) {
    event.respondWith(staticResponse(request));
  }
});