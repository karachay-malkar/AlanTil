import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";

async function edit(path,fn){
 const before=await readFile(path,"utf8");
 const after=fn(before);
 assert.notEqual(after,before,"No modifications to "+path);
 await writeFile(path,after);
 console.log("PATCH",path,before.length,"=>",after.length);
}
function once(source,needle,replacement){
 const count=source.split(needle).length-1;
 assert.equal(count,1,"Expected exactly one occurrence ("+count+"): "+needle.slice(0,100));
 return source.replace(needle,replacement);
}

await edit("src/app/bootstrap.js",source=>{
 let s=source;
 const old=[
'  const hadController = Boolean(navigator.serviceWorker.controller);',
'  let controllerHandled = false;',
'  navigator.serviceWorker.addEventListener("controllerchange", () => {',
'    if (!hadController || controllerHandled) return;',
'    controllerHandled = true;',
'    const key = "alantil_sw_controller_reload_v1";',
'    try {',
'      if (sessionStorage.getItem(key) === ASSET_VERSION) return;',
'      sessionStorage.setItem(key, ASSET_VERSION);',
'    } catch {}',
'    window.location.reload();',
'  }, { once: true });',
''
].join("\n");
 s=once(s,old,'  // A new worker controls subsequent navigations; do not tear down a visible session.\n');
 s=once(s,
'  window.addEventListener("alantil:scope-ready", () => {\n    if (router.getCurrent().route === "path.home") return;\n    void router.refresh({ background: true, reason: "storage_scope" });\n  });',
'  window.addEventListener("alantil:scope-ready", () => {\n    const route = router.getCurrent().route;\n    // Account handles auth changes itself; the path patches progress in-place.\n    if (route === "path.home" || route === "account.home") return;\n    void router.refresh({ background: true, reason: "storage_scope" });\n  });'
);
 s=once(s,
'    void authInitialization.then(async () => { await linkRestoredAccountVisit(); await router.refresh({ background: true, reason: "auth_ready" }); });',
'    // Auth initialization was awaited before router.start(); no second screen mount.\n    void authInitialization.then(linkRestoredAccountVisit);'
);
 return s;
});

await edit("src/app/router.js",s=>once(s,
'    navigating = true;\n    try { if (queuedNavigation) return false; currentModule?.unmount?.(); currentModule = null; const module = await prepareRoute(current.route); await mountCurrentRoute(module); return true; }',
'    navigating = true;\n    try {\n      if (queuedNavigation) return false;\n      if (options.background && targetsEqual(refreshTarget,current) && typeof currentModule?.refreshData === "function") {\n        await currentModule.refreshData({ ...context, router: api }, options);\n        return true;\n      }\n      currentModule?.unmount?.(); currentModule = null;\n      const module = await prepareRoute(current.route); await mountCurrentRoute(module);\n      return true;\n    }'
));

await edit("src/shared/profile/profile-service.js",source=>{
 let s=once(source,
'const PROFILE_COLUMNS = "user_id,nickname,avatar_gender,created_at,updated_at";',
'const PROFILE_COLUMNS = "user_id,nickname,avatar_gender,created_at,updated_at";\nconst PROFILE_VIEW_CACHE_PREFIX = "alantil_profile_display_v1:";\nconst PROFILE_VIEW_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;\n\nexport function getCachedProfile(userId) {\n  if (!userId) return null;\n  try {\n    const value = JSON.parse(localStorage.getItem(PROFILE_VIEW_CACHE_PREFIX + userId) || "null");\n    if (value?.user_id !== userId || !value.nickname || Date.now() - Number(value.saved_at) > PROFILE_VIEW_CACHE_MAX_AGE_MS) return null;\n    return { user_id: userId, nickname: value.nickname };\n  } catch { return null; }\n}\nfunction rememberProfile(profile) {\n  if (!profile?.user_id || !profile?.nickname) return;\n  try {\n    localStorage.setItem(PROFILE_VIEW_CACHE_PREFIX + profile.user_id, JSON.stringify({\n      user_id: profile.user_id, nickname: profile.nickname, saved_at: Date.now(),\n    }));\n  } catch { /* Storage may be unavailable or full. */ }\n}'
 );
 s=once(s,'  return data || null;\n}\n\nexport async function isNicknameAvailable', '  rememberProfile(data);\n  return data || null;\n}\n\nexport async function isNicknameAvailable');
 s=once(s,'  if (result?.data) return result.data;', '  if (result?.data) { rememberProfile(result.data); return result.data; }');
 s=once(s,'  return result.data;\n}\n\nexport async function updateProfileNickname','  rememberProfile(result.data);\n  return result.data;\n}\n\nexport async function updateProfileNickname');
 s=once(s,'  if (error) throwProfileError("update_profile", error, "update_profile");\n  return data;','  if (error) throwProfileError("update_profile", error, "update_profile");\n  rememberProfile(data);\n  return data;');
 return s;
});

await edit("src/features/profile/index.js",source=>{
 let s=source;
 s=once(s,'import { getProfile } from "../../shared/profile/profile-service.js?v=16.8.0.3";',
 'import { getProfile, getCachedProfile } from "../../shared/profile/profile-service.js?v=16.8.0.3";');
 s=once(s,'let controller = null;','let controller = null;\nlet progressGeneration = 0;');
 s=once(s,'async function renderProfileHome(context, auth, profile) {','function renderProfileHome(context, auth, profile) {');
 s=once(s,'    const progress = await loadStoryProgress();\n','');
 s=once(s,'        \${progress ? storyProgressRows(progress.route, progress.path) : unavailableStoryProgress()}',
 '        <div data-profile-progress></div>');
 const anchor='function renderProfileLoading(context) {';
 const inserted=[
'export async function refreshData(context) {',
'  const signal = controller?.signal;',
'  const slot = context.root.querySelector("[data-profile-progress]");',
'  if (!slot || !signal || signal.aborted) return false;',
'  const generation = ++progressGeneration;',
'  const progress = await loadStoryProgress();',
'  if (signal.aborted || generation !== progressGeneration || !slot.isConnected) return false;',
'  const html = progress ? storyProgressRows(progress.route, progress.path) : unavailableStoryProgress();',
'  if (slot.innerHTML === html) return true;',
'  slot.innerHTML = html;',
'  slot.querySelectorAll("[data-profile-story]").forEach(button => {',
'    button.addEventListener("click", () => context.router.navigate("path.home", { storyType: button.dataset.profileStory }), { signal });',
'  });',
'  return true;',
'}',
''
].join("\n");
 s=once(s,anchor,inserted+anchor);
 const old=[
'  renderProfileLoading(context);',
'  bindProfileNavigation(context, signal);',
'  bindAccountNavigation(context, signal);',
'  void loadProfile(auth).then(async (profile) => {',
'    if (signal.aborted) return;',
'    await renderProfileHome(context, auth, profile);',
'    if (signal.aborted) return;',
'    bindProfileActions(context, auth, signal);',
'  });'
].join("\n");
 const replacement=[
'  // The display-only nickname cache never substitutes for account-completion checks.',
'  const cached = getCachedProfile(auth.user.id);',
'  if (cached) {',
'    renderProfileHome(context, auth, cached);',
'    bindProfileActions(context, auth, signal);',
'    void refreshData(context);',
'  } else {',
'    renderProfileLoading(context);',
'    bindProfileNavigation(context, signal);',
'    bindAccountNavigation(context, signal);',
'  }',
'  void loadProfile(auth).then(profile => {',
'    if (signal.aborted) return;',
'    if (cached && (!profile || cached.nickname === profile.nickname)) return;',
'    renderProfileHome(context, auth, profile);',
'    bindProfileActions(context, auth, signal);',
'    if (profile) void refreshData(context);',
'  });'
].join("\n");
 s=once(s,old,replacement);
 // A refresh from cloud must never tear down profile statistics while the user reads them.
 s=once(s,'  controller?.abort();\n  controller = null;\n}', '  controller?.abort();\n  progressGeneration++;\n  controller = null;\n}');
 return s;
});

await edit("service-worker.js",source=>{
 let s=once(source,'const RUNTIME_CACHE = "alantil-runtime-" + VERSION;', 'const RUNTIME_CACHE = "alantil-runtime-" + VERSION;\n// Images are content-addressed by their ?v= URL, not by the application release.\nconst IMAGE_CACHE = "alantil-path-images-v1";');
 const old='    const stale = names.filter((name) => name.startsWith("alantil-") && ![SHELL_CACHE, RUNTIME_CACHE].includes(name));\n    await Promise.all(stale.map((name) => caches.delete(name)));';
 const replacement=[
'    // Carry previously loaded station images over from old versioned runtime caches.',
'    const sharedImages = await caches.open(IMAGE_CACHE);',
'    for (const name of names.filter(name => name.startsWith("alantil-runtime-") && name !== RUNTIME_CACHE)) {',
'      const oldCache = await caches.open(name);',
'      for (const request of await oldCache.keys()) {',
'        if (!new URL(request.url).pathname.startsWith("/assets/icons/sets/")) continue;',
'        if (await sharedImages.match(request)) continue;',
'        const response = await oldCache.match(request);',
'        if (response) { try { await sharedImages.put(request, response); } catch {} }',
'      }',
'    }',
'    const stale = names.filter((name) => name.startsWith("alantil-") && ![SHELL_CACHE, RUNTIME_CACHE, IMAGE_CACHE].includes(name));',
'    await Promise.all(stale.map((name) => caches.delete(name)));'
].join("\n");
 s=once(s,old,replacement);
 s=once(s,
'  if (["image", "font"].includes(request.destination) || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/src/vendor/")) {',
'  if (url.pathname.startsWith("/assets/icons/sets/")) {\n    event.respondWith(cacheFirst(request, IMAGE_CACHE));\n    return;\n  }\n  if (["image", "font"].includes(request.destination) || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/src/vendor/")) {'
);
 return s;
});

await edit("src/features/path/feature.js",source=>{
 let s=once(source,
'const SET_ICON_ASSET_VERSION = "16.8.0.14";',
'const SET_ICON_ASSET_VERSION = "16.8.0.14";\nconst ROUTE_IMAGE_CACHE = "alantil-path-images-v1";\nconst ROUTE_IMAGE_MARKER = "alantil_route_images_ready_v1:" + SET_ICON_ASSET_VERSION + ":";\nlet eagerCachedRouteImages = false;'
);
 const anchor='function stationButton(station, index, progressSnapshot) {';
 const functions=[
'function routeImageUrls(story) {',
'  return [...new Set((story?.stations || []).map(station => beginnerSetIconName(station) || intermediateSetIconName(station))',
'    .filter(Boolean).map(icon => "/assets/icons/sets/" + encodeURIComponent(icon) + "?v=" + SET_ICON_ASSET_VERSION))];',
'}',
'function routeImagesPreviouslyCached(story, storyType) {',
'  const urls = routeImageUrls(story);',
'  if (!urls.length) return false;',
'  try { return localStorage.getItem(ROUTE_IMAGE_MARKER + storyType) === urls.join("|"); } catch { return false; }',
'}',
'function warmRouteImages(story, storyType, signal) {',
'  const urls = routeImageUrls(story);',
'  if (!urls.length || globalThis.navigator?.connection?.saveData) return;',
'  const marker = ROUTE_IMAGE_MARKER + storyType;',
'  const signature = urls.join("|");',
'  void (async () => {',
'    try {',
'      const visible = [...document.querySelectorAll(".pathView img[data-beginner-diorama-image]")].filter(img => img.loading === "eager").slice(0, 4);',
'      await Promise.allSettled(visible.map(img => img.decode()));',
'      if (signal.aborted) return;',
'      await new Promise(resolve => {',
'        if (typeof requestIdleCallback === "function") requestIdleCallback(resolve, { timeout: 2000 });',
'        else setTimeout(resolve, 600);',
'      });',
'      if (signal.aborted) return;',
'      const shared = await caches.open(ROUTE_IMAGE_CACHE);',
'      // Small serial batches give the visible UI and study pages precedence.',
'      for (const url of urls) {',
'        if (signal.aborted) return;',
'        if (await shared.match(url)) continue;',
'        const old = await caches.match(url);',
'        if (old) { await shared.put(url, old); continue; }',
'        const response = await fetch(url, { cache: "force-cache", signal });',
'        if (!response.ok) return;',
'        await shared.put(url, response.clone());',
'      }',
'      if (signal.aborted) return;',
'      const allPresent = (await Promise.all(urls.map(url => shared.match(url)))).every(Boolean);',
'      if (allPresent) localStorage.setItem(marker, signature);',
'    } catch (error) {',
'      // Quota limits, privacy mode and offline visits must not prevent rendering.',
'      console.warn("Path image warmup unavailable", error);',
'    }',
'  })();',
'}',
'function revealCachedRouteImages(context, signal) {',
'  if (!eagerCachedRouteImages) return;',
'  const visible = [...context.root.querySelectorAll(".pathView img[data-beginner-diorama-image]")].filter(img => img.loading === "eager").slice(0, 4);',
'  const decoded = Promise.allSettled(visible.map(img => img.decode()));',
'  void Promise.race([decoded, new Promise(resolve => setTimeout(resolve, 1500))]).then(() => {',
'    if (!signal.aborted) delete context.root.dataset.pathImageBatch;',
'  });',
'}',
''
].join("\n");
 s=once(s,anchor,functions+anchor);
 s=once(s,'const loading = index < 4 ? "eager" : "lazy";','const loading = eagerCachedRouteImages || index < 4 ? "eager" : "lazy";');
 const old='if(screen==="home"){const progressSnapshot=createRouteProgressSnapshot();if(String(params.storyType||"")!==activeStory)context.router.canonicalize?.("path.home",{storyType:activeStory});renderRoute(context,route,activeStory,progressSnapshot,storyIntro);refreshSetMetadataAsync(context,route,activeStory,signal);return;}';
 const replacement='if(screen==="home"){const progressSnapshot=createRouteProgressSnapshot();if(String(params.storyType||"")!==activeStory)context.router.canonicalize?.("path.home",{storyType:activeStory});eagerCachedRouteImages=routeImagesPreviouslyCached(route.stories[activeStory],activeStory);if(eagerCachedRouteImages)context.root.dataset.pathImageBatch="pending";else delete context.root.dataset.pathImageBatch;renderRoute(context,route,activeStory,progressSnapshot,storyIntro);revealCachedRouteImages(context,signal);warmRouteImages(route.stories[activeStory],activeStory,signal);refreshSetMetadataAsync(context,route,activeStory,signal);return;}';
 s=once(s,old,replacement);
 return s;
});

await edit("src/features/path/path.css",s=>s+'\n/* On a warm visit, reveal cached thumbnails together instead of one at a time. */\n[data-path-image-batch="pending"] .beginnerDioramaImage{visibility:hidden}\n');
await edit("src/shared/styles/lazy/path.css",s=>once(s,'path.css?v=16.8.0.17','path.css?v=17.2.4'));

await edit("scripts/release/sync-version.mjs",s=>{
 const needle="await set('src/features/path/story-stele.js',s=>{";
 const addition="await set('src/shared/styles/lazy/path.css',s=>replaceOne(s,/(features\\/path\\/path\\.css\\?v=)[0-9.]+/,'$1'+version,'src/shared/styles/lazy/path.css'));\n";
 return once(s,needle,addition+needle);
});

const releasePath="release.json";
const rel=JSON.parse(await readFile(releasePath,"utf8"));
assert.equal(rel.branch,"17.2");
assert.equal(rel.version,"17.2.3");
assert.equal(rel.android_version_code,46);
rel.version="17.2.4";
rel.android_version_code=47;
await writeFile(releasePath,JSON.stringify(rel,null,2)+"\n");
console.log("Prepared isolated 17.2.4 release.");
