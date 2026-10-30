const VERSION = "17.2.46";
const SHELL_CACHE = "alantil-shell-" + VERSION;
const RUNTIME_CACHE = "alantil-runtime-" + VERSION;
// Images are content-addressed by their ?v= URL, not by the application release.
const IMAGE_CACHE = "alantil-path-images-v1";
const LEGACY_REFRESH_BEFORE_VERSION = "16.8.0.16";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/404.html",
  "/src/app/bootstrap.js?v=17.2.46",
  "/src/app/router.js?v=17.2.46",
  "/src/app/shell.js?v=16.8.0.16",
  "/src/app/screen-registry.js?v=16.8.0.17",
  "/src/shared/ui/bracket-tabs.js?v=16.8.0.16",
  "/src/shared/styles/bracket-tabs.css?v=16.8.0.16",
  "/src/shared/styles/app.css?v=17.2.46",
  "/src/shared/styles/learning-preview.css?v=16.8.0.16",
  "/src/features/path/feature.js?v=17.2.46",
  "/src/data/path-set-metadata.js?v=17.2.46",
  "/src/features/path/story-stele.js?v=17.2.46",
  "/src/shared/data/word-repository.js?v=16.8.0.16",
  "/src/shared/data/dictionary-store.js?v=16.8.0.16",
  "/assets/icons/ui/path-elbrus-white.png?v=16.8.0.16",
  "/assets/icons/ui/favicon-32.png?v=17.2.46",
  "/assets/icons/ui/favicon-192.png?v=17.2.46",
  "/assets/icons/ui/favicon-512.png?v=17.2.46"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(CORE_ASSETS.map((asset) => cache.add(new Request(asset, { cache: "reload" }))));
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
    // Carry previously loaded station images over from old versioned runtime caches.
    const sharedImages = await caches.open(IMAGE_CACHE);
    for (const name of names.filter(name => name.startsWith("alantil-runtime-") && name !== RUNTIME_CACHE)) {
      const oldCache = await caches.open(name);
      for (const request of await oldCache.keys()) {
        if (!new URL(request.url).pathname.startsWith("/assets/icons/sets/")) continue;
        if (await sharedImages.match(request)) continue;
        const response = await oldCache.match(request);
        if (response) { try { await sharedImages.put(request, response); } catch {} }
      }
    }
    const stale = names.filter((name) => name.startsWith("alantil-") && ![SHELL_CACHE, RUNTIME_CACHE, IMAGE_CACHE].includes(name));
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
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) await cache.put("/index.html", response.clone());
    return response;
  } catch {
    return (await cache.match("/index.html")) || (await cache.match("/")) || Response.error();
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

async function networkFirst(request, cacheName = RUNTIME_CACHE, { noStore = false } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, noStore ? { cache: "no-store" } : undefined);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
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

  if (url.pathname.startsWith("/assets/icons/sets/")) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }
  if (["image", "font"].includes(request.destination) || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/src/vendor/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (["script", "style", "worker"].includes(request.destination) || ["/src/data/dictionary-snapshot.json", "/src/data/path-route-index.json", "/src/data/path-route-index.json.gz"].includes(url.pathname)) {
    // Cache-busted immutable code: a new ?v= URL changes when the application is released.
    // Keep configuration and unversioned resources network-first.
    const versionedCode=(["script","style"].includes(request.destination)
      && url.searchParams.has("v")
      && !url.pathname.startsWith("/src/config/"))
      || (["/src/data/dictionary-snapshot.json", "/src/data/path-route-index.json", "/src/data/path-route-index.json.gz"].includes(url.pathname)
        && url.searchParams.has("v"));
    event.respondWith(versionedCode ? cacheFirst(request) : networkFirst(request, RUNTIME_CACHE, { noStore: true }));
  }
});
