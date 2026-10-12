import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('V2 runs only the authored-geometry infill and does not modify the paid server tower',()=>{
 const scene=read('src/features/tower/scene.js'),worker=read('src/features/tower/masonry-worker.js');
 const infill=read('packages/tower-game/masonry-v2-authored.mjs');
 assert.match(scene,/mode:enableV2Aim\?'v2':'classic'/);
 assert.doesNotMatch(scene,/if\(enableV2Aim\|\|!masonryWorker/);
 assert.match(worker,/buildV2CertifiedPresentation/);
 assert.match(worker,/mode==='v2'/);
 assert.match(infill,/ROCK_PACK\.small/);
 assert.match(infill,/fitsRealTriangleGap/);
 assert.match(infill,/trianglesCross/);
 assert.doesNotMatch(infill,/BoxGeometry|CylinderGeometry|makeBox|cube_geometry|mortarShell|buildCoreMortar/);
 assert.match(scene,/masonrySourceOnly/);
 assert.match(scene,/data\.unit==='meters'\?1:CELL/);
 assert.doesNotMatch(infill,/mutate_tower|paidAmount\s*[:=]|silver|gold/);
});
test('original stone geometry and shared database are not changed by display correction',()=>{
 const scene=read('src/features/tower/scene.js');
 assert.match(scene,/repairRockDisplayWinding\(originalRockMesh/);
 assert.match(read('packages/tower-game/masonry-v2-presentation.mjs'),/fitV2DisplayMesh/);
 assert.match(read('packages/tower-game/masonry-v2-presentation.mjs'),/bodyForTowerBlock\(original/);
 assert.match(scene,/displayWinding\.reversed/);
 assert.match(scene,/masonryFittedVertices/);
 const worker=read('src/features/tower/masonry-worker.js');assert.match(worker,/packMasonryVolume/);
 assert.match(scene,/const contactMap=enableV2Aim\?new Map\(\):mapContactJoints/);
});
test('scoped tower resource cache is bumped but global app version is unchanged',()=>{
 const router=read('src/app/router.js'),scene=read('src/features/tower/scene.js'),app=read('src/features/tower/index.js');
 assert.match(router,/const TOWER_ASSET_VERSION = "17\.1\.7"/);
 assert.match(router,/const ASSET_VERSION = "16\.8\.0\.16"/);
 assert.match(read('src/shared/styles/lazy/tower.css'),/tower\.css\?v=17\.1\.7/);
 assert.match(scene,/masonry-worker\.js\?v=17\.1\.7/);
 assert.match(app,/scene\.js\?v=17\.1\.7/);
});
