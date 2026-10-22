import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";

const filename="src/features/path/feature.js";
const original=await readFile(filename,"utf8");
assert.equal(original.split('loading="eager" decoding="async" fetchpriority="high"').length,2,"Unexpected original image source");
const releaseFile="release.json";
const rel=JSON.parse(await readFile(releaseFile,"utf8"));
assert.equal(rel.branch,"17.2");
assert.equal(rel.version,"17.2.2","Release must start from proven 17.2.2 version");
assert.equal(rel.android_version_code,45);
execFileSync(process.execPath,["scripts/qa/prepare-visible-first-icons.mjs"],{stdio:"inherit"});
const after=await readFile(filename,"utf8");
assert.ok(after.includes('const loading = index < 4 ? "eager" : "lazy";'));
assert.ok(after.includes('const priority = index < 4 ? "high" : "low";'));
const testFile="scripts/qa/verify-path-metadata-browser.mjs";
let test=await readFile(testFile,"utf8");
const oldWait='  await until(async () => { const s=await evaluate(statsExpr); return s?.loaded >= 26 && s?.labeled >= 26; }, "26 illustrated, labeled stations");\n  const hydrated = await evaluate(statsExpr);';
assert.equal(test.split(oldWait).length,2,"Navigation verifier changed");
const newWait=[
'  // Native lazy icons are loaded as their stations enter the scroll viewport.',
'  await until(async () => { const s=await evaluate(statsExpr); return s?.illustrated === 26 && s?.labeled === 26 && s?.loaded >= 1; }, "illustrated labeled map");',
'  for (let i=0;i<26;i++){',
'    const item = await evaluate(\'(() => { const b=document.querySelectorAll(".pathView button[data-station-key]")[\'+i+\']; if(!b)return false; b.scrollIntoView({block:"center",behavior:"instant"}); return true; })()\');',
'    assert.ok(item, "Missing station "+i);',
'    await until(async () => await evaluate(\'(() => { const b=document.querySelectorAll(".pathView button[data-station-key]")[\'+i+\'];const img=b?.querySelector("img[data-beginner-diorama-image]");return Boolean(img?.complete && img?.naturalWidth>0); })()\'), "station image "+i, 25000);',
'  }',
'  const hydrated = await evaluate(statsExpr);',
'  assert.equal(hydrated.loaded, 26, "Every stage image must load after visiting it");'
].join("\n");
test=test.replace(oldWait,newWait);
const oldBack='  await until(async () => (await evaluate(statsExpr))?.loaded >= 26, "return from station to map");';
assert.equal(test.split(oldBack).length,2);
test=test.replace(oldBack,'  await until(async () => {const s=await evaluate(statsExpr);return s?.illustrated===26 && s?.labeled===26 && s?.loaded>=1;}, "return from station to map");');
const oldWarm='      return reloaded && (await evaluate(statsExpr))?.loaded >= 26;';
assert.equal(test.split(oldWarm).length,2);
test=test.replace(oldWarm,'      const s=await evaluate(statsExpr);return reloaded && s?.illustrated===26 && s?.labeled===26 && s?.loaded>=1;');
await writeFile(testFile,test);
const testText=[
'import test from "node:test";',
'import assert from "node:assert/strict";',
'import {readFile} from "node:fs/promises";',
'test("only the nearest four illustrated stages are eager",async()=>{',
'  const s=await readFile(new URL("../src/features/path/feature.js",import.meta.url),"utf8");',
'  assert.match(s,/const loading = index < 4 \\? "eager" : "lazy"/);',
'  assert.match(s,/const priority = index < 4 \\? "high" : "low"/);',
'  assert.ok(s.includes("fetchpriority="));',
'});',
''
].join("\n");
await writeFile("tests/path-visible-first-17-2.test.mjs",testText);
rel.version="17.2.3";
rel.android_version_code=46;
await writeFile(releaseFile,JSON.stringify(rel,null,2)+"\n");
const syncFile="scripts/release/sync-version.mjs";
let sync=await readFile(syncFile,"utf8");
const oldList="for(const path of ['/src/app/bootstrap.js','/src/app/router.js','/src/shared/styles/app.css','/src/features/path/feature.js']){";
assert.equal(sync.split(oldList).length,2,"Service Worker release map changed");
sync=sync.replace(oldList,"for(const path of ['/src/app/bootstrap.js','/src/app/router.js','/src/shared/styles/app.css','/src/features/path/feature.js','/src/data/path-set-metadata.js','/src/features/path/story-stele.js']){");
await writeFile(syncFile,sync);
console.log("Prepared complete verified visible-first source with 17.2.3 release and lazy-image Chrome E2E checks.");
