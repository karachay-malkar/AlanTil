import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(file)=>fs.readFileSync(path.join(ROOT,file),"utf8");

test("cold and warm route CSS loading is owned by Router and blocks mount until ready",()=>{
  const router=read("src/app/router.js");
  const registry=read("src/app/screen-registry.js");
  assert.match(router,/screenStyleDependencies/);
  assert.match(router,/async function prepareRoute\(route\)/);
  assert.match(router,/Promise\.all\(\[loadFeatureModule\(featureOf\(route\)\),ensureRouteStyles\(route\)\]\)/);
  assert.match(router,/if\(loadedStyles\.has\(href\)\)return loadedStyles\.get\(href\)/);
  assert.match(registry,/styles:\s*\["friends",\s*"admin"\]/);
  assert.match(registry,/styles:\s*\["test",\s*"match"\]/);
});

test("transient stylesheet failures do not poison the session cache",()=>{
  const router=read("src/app/router.js");
  assert.match(router,/const STYLE_LOAD_RETRIES = 2/);
  assert.match(router,/STYLE_RETRY_DELAY_MS = 140/);
  assert.match(router,/loadedStyles\.delete\(href\)/);
  assert.match(router,/findStyleLink\(href\)\?\.remove\(\)/);
  assert.match(router,/link\.addEventListener\("error",[\s\S]*link\.remove\(\)/);
  assert.match(router,/href\+\`&retry=\$\{attempt\}\`/);
  assert.doesNotMatch(router,/\?v=\$\{RELEASE_VERSION\}/);
  assert.match(router,/\?v=\$\{ASSET_VERSION\}/);
});

test("every registered lazy style wrapper and imported stylesheet exists",()=>{
  const router=read("src/app/router.js");
  const registry=read("src/app/screen-registry.js");
  const stylePaths=new Map([...router.matchAll(/^\s{2}([a-z]+):\s*"([^"]+\.css)",?$/gm)].map((match)=>[match[1],match[2]]));
  const dependencies=[...registry.matchAll(/styles:\s*\[([^\]]*)\]/g)].flatMap((match)=>[...match[1].matchAll(/"([^"]+)"/g)].map((item)=>item[1]));
  for(const dependency of new Set(dependencies))assert.ok(stylePaths.has(dependency),"missing STYLE_PATHS entry for "+dependency);
  for(const [name,url] of stylePaths){
    const wrapper=path.join(ROOT,url.replace(/^\//,""));
    assert.ok(fs.existsSync(wrapper),"missing wrapper "+name+": "+url);
    const source=fs.readFileSync(wrapper,"utf8");
    const imports=[...source.matchAll(/@import\s+url\("([^"]+)"\)/g)].map((match)=>match[1]);
    assert.ok(imports.length>0,"wrapper has no stylesheet imports: "+url);
    for(const imported of imports){
      const pathname=imported.split("?")[0];
      const target=pathname.startsWith("/")?path.join(ROOT,pathname.slice(1)):path.resolve(path.dirname(wrapper),pathname);
      assert.ok(fs.existsSync(target),"missing imported stylesheet "+imported+" from "+url);
    }
  }
});

test("service-worker upgrades bypass HTTP cache and controlled clients reload once",()=>{
  const bootstrap=read("src/app/bootstrap.js");
  const worker=read("service-worker.js");
  assert.match(bootstrap,/updateViaCache:\s*"none"/);
  assert.match(bootstrap,/registration\.update\(\)/);
  assert.match(bootstrap,/addEventListener\("controllerchange"/);
  assert.match(bootstrap,/window\.location\.reload\(\)/);
  assert.ok(bootstrap.indexOf("registerServiceWorker();")<bootstrap.indexOf("await router.start();"));
  assert.match(worker,/const VERSION = "16\.7\.0\.33"/);
  assert.match(worker,/LEGACY_REFRESH_BEFORE_VERSION = "16\.7\.0\.33"/);
  assert.match(worker,/self\.clients\.claim\(\)/);
  assert.match(worker,/self\.clients\.matchAll\(\{type:"window",includeUncontrolled:true\}\)/);
  assert.match(worker,/client\.navigate\(client\.url\)/);
  assert.match(worker,/url\.pathname==="\/auth\/callback"/);
  assert.match(worker,/fetch\(request, \{ cache: "no-store" \}\)/);
  assert.match(worker,/async function networkFirst/);
  assert.match(worker,/networkFirst\(request, RUNTIME_CACHE, \{ noStore: true \}\)/);
  assert.doesNotMatch(worker,/url\.searchParams\.has\("v"\) \? cacheFirst\(request\)/);
});
