import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('17.2 Common100 decodes once while preserving architecture placement',async()=>{
 const lib=await read('src/features/masonry/library.js');
 const scene=await read('src/features/masonry/scene.js');
 const editor=await read('src/features/masonry/index.js');
 assert.match(lib,/common100Promise=readCommon100\(\)\.catch/);
 assert.match(lib,/ARCHITECTURE_IDS/);
 assert.match(scene,/architectureLoader/);
 assert.match(scene,/controls\.addEventListener\('change',invalidate\)/);
 assert.match(scene,/if\(disposed\|\|document\.hidden\)return/);
 assert.match(editor,/IntersectionObserver/);
 assert.match(editor,/queueThumbnail\(entry\.target,generation\)/);
 assert.match(editor,/architectureById/);
});
test('17.2 skips unrelated JS warmups and lazy-loads the stele',async()=>{
 const router=await read('src/app/router.js');
 const stele=await read('src/features/path/story-stele.js');
 const sw=await read('service-worker.js');
 assert.doesNotMatch(router,/scheduleFeatureWarmup/);
 assert.match(router,/MASONRY_ASSET_VERSION = "17\.7-approved-only\.2"/);
 assert.match(stele,/artwork\.src=artwork\.dataset\.src/);
 assert.doesNotMatch(sw,/\/assets\/path\/story-stele\.webp\?v=16\.8\.0\.16/);
});

test('17.2 favicon and versioned static resources load without repeat network fetch',async()=>{
 const index=await read('index.html');
 const worker=await read('service-worker.js');
 assert.match(index,/rel="icon" type="image\/png"/);
 assert.match(index,/targetVersion = "16\.8\.0\.29"/);
 assert.match(worker,/VERSION = "16\.8\.0\.29"/);
 assert.match(worker,/url\.searchParams\.has\("v"\)/);
 assert.match(worker,/versionedCode \? cacheFirst\(request\) : networkFirst\(request/);
});
