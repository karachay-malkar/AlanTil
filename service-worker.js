const VERSION = "16.7.0.19";
const SHELL_CACHE = "alantil-shell-" + VERSION;
const RUNTIME_CACHE = "alantil-runtime-" + VERSION;
const LEGACY_REFRESH_BEFORE_VERSION = "16.7.0.19";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/404.html",
  "/src/app/bootstrap.js?v=16.7.0.19",
  "/src/app/router.js?v=16.7.0.19",
  "/src/app/shell.js?v=16.7.0.19",
  "/src/app/screen-registry.js?v=16.7.0.19",
  "/src/shared/styles/app.css?v=16.7.0.19",
  "/src/features/path/feature.js?v=16.7.0.19",
  "/src/shared/data/word-repository.js?v=16.7.0.19",
  "/src/shared/data/dictionary-store.js?v=16.7.0.19",
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

function compareVersions(left, right) {
  const a=String(left||"").split(".").map((part)=>Number.parseInt(part,10)||0);
  const b=String(right||"").split(".").map((part)=>Number.parseInt(part,10)||0);
  const length=Math.max(a.length,b.length);
  for(let index=0;index<length;index+=1){const delta=(a[index]||0)-(b[index]||0);if(delta)return delta;}
  return 0;
}

function cacheVersion(name) {
  const match=/^alantil-shell-(.+)$/.exec(String(name||""));
  return match?.[1]||"";
}

function shouldRefreshLegacyClient(clientUrl) {
  try {
    const url=new URL(clientUrl);
    if(url.origin!==self.location.origin)return false;
    if(url.pathname==="/auth/callback")return false;
    const authKeys=["code","error","error_code","error_description"];
    if(authKeys.some((key)=>url.searchParams.has(key)))return false;
    const hash=new URLSearchParams(String(url.hash||"").replace(/^#/,""));
    return !authKeys.some((key)=>hash.has(key));
  } catch {
    return false;
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const legacyUpgrade = names.some((name) => {
      const version=cacheVersion(name);
      return version && compareVersions(version,LEGACY_REFRESH_BEFORE_VERSION)<0;
    });
    const stale = names.filter((name) => name.startsWith("alantil-") && ![SHELL_CACHE, RUNTIME_CACHE].includes(name));
    await Promise.all(stale.map((name) => caches.delete(name)));
    await self.clients.claim();
    if (!legacyUpgrade) return;
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    await Promise.allSettled(windows.filter((client)=>shouldRefreshLegacyClient(client.url)).map((client)=>client.navigate(client.url)));
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
