import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=async path=>readFile(new URL("../"+path,import.meta.url),"utf8");
test("background profile refresh preserves mounted DOM",async()=>{
 const boot=await read("src/app/bootstrap.js"); const router=await read("src/app/router.js"); const profile=await read("src/features/profile/index.js");
 assert.doesNotMatch(boot,/router\.refresh\(\{ background: true, reason: "auth_ready"/);
 assert.doesNotMatch(boot,/window\.location\.reload\(\)/);
 assert.match(router,/typeof currentModule\?\.refreshData === "function"/);
 assert.match(profile,/export async function refreshData/);
 assert.match(profile,/getCachedProfile\(auth\.user\.id\)/);
 assert.match(profile,/data-profile-progress/);
});
test("station images persist across SW upgrades and cached routes start eager",async()=>{
 const sw=await read("service-worker.js");const path=await read("src/features/path/feature.js");const css=await read("src/features/path/path.css");
 assert.match(sw,/const IMAGE_CACHE = "alantil-path-images-v1"/);
 assert.match(sw,/sharedImages\.put/);
 assert.match(sw,/cacheFirst\(request, IMAGE_CACHE\)/);
 assert.match(path,/eagerCachedRouteImages \|\| index < 4/);
 assert.match(path,/warmRouteImages\(route\.stories\[activeStory\]/);
 assert.match(css,/data-path-image-batch="pending"/);
});
