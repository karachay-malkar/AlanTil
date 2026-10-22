import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read = path => readFile(new URL("../"+path, import.meta.url), "utf8");

test("global CSS declares cascade order and excludes route-specific path and profile rules", async () => {
 const css=await read("src/shared/styles/app.css");
 assert.match(css, /^@layer reset, theme, base, shell, components, features, utilities, typography;/);
 assert.doesNotMatch(css, /features\/path\/(?:path|story-stele|story-word-list|path-navigation)\.css/);
 assert.doesNotMatch(css, /\.profilePrimaryNav|\.isLearningGuideTrigger|--route-wave-amplitude/);
 const path=await read("src/shared/styles/feature/path.css");
 for(const part of ["path.css","story-stele.css","story-word-list.css","path-navigation.css"])assert.ok(path.includes("/"+part+"?"),part);
 for(const selector of [".pathStickyControls",".storyTabs",".stationNode",".stationMeta",".pathView"])assert.ok(path.includes(selector),selector);
 assert.match(path, /@import url\("\.\/learning-guide\.css\?v=16\.7\.14"\);/);
});
test("shared profile navigation and learning guide styles load for all consumers",async()=>{
 const profile=await read("src/shared/styles/feature/profile-navigation.css");
 const guide=await read("src/shared/styles/feature/learning-guide.css");
 assert.match(profile,/\.profilePrimaryNav/);
 assert.match(profile,/\.profilePrimaryTab/);
 assert.match(guide,/\.isLearningGuideTrigger/);
 for(const f of ["profile","settings","friends"]){
  const css=await read("src/shared/styles/feature/"+f+".css");
  assert.match(css, /@import url\("\.\/profile-navigation\.css\?v=16\.7\.14"\);/);
 }
 for(const f of ["path","learn"]){
  const css=await read("src/shared/styles/feature/"+f+".css");
  assert.match(css, /@import url\("\.\/learning-guide\.css\?v=16\.7\.14"\);/);
 }
});
test("path JS/CSS load in parallel once through the feature router",async()=>{
 const router=await read("src/app/router.js");
 assert.match(router,/path: "\/src\/shared\/styles\/feature\/path\.css\?v=16\.7\.14"/);
 assert.match(router,/Promise\.all\(\[loadModule\(feature\), ensureFeatureStyle\(feature\)\]\)/);
 assert.match(router,/if \(loadedStyles\.has\(feature\)\) return loadedStyles\.get\(feature\)/);
});
test("service worker still caches versioned static requests and isolates standalone previews",async()=>{
 const sw=await read("service-worker.js");
 assert.match(sw,/16\.7\.14-route-css-cache/);
 assert.match(sw,/const versioned = new URL\(request\.url\)\.searchParams\.has\("v"\)/);
 assert.match(sw,/if \(cached\) return cached/);
 assert.match(sw,/if \(response\.ok\)/);
 assert.match(sw,/tower-masonry-test/);
 const core=sw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)?.[1]||"";
 assert.doesNotMatch(core,/feature\/path\.css|feature\/masonry\.css/);
});
