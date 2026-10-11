import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('tower uses real camera tween, meadow and depth controls without changing routing',()=>{
 const scene=read('src/features/tower/scene.js');
 assert.ok(scene.indexOf('let flight=null;')<scene.indexOf('let frame;function animate('));
 assert.match(scene,/controls\.addEventListener\('start',cancelFlight\)/);
 assert.match(scene,/function grassTexture\(\)/);
 assert.match(scene,/new THREE\.CanvasTexture\(canvas\)/);
 assert.match(scene,/grid\.material\.opacity=\.12/);
 assert.match(scene,/const contact=new THREE\.Mesh/);
 assert.match(scene,/function screenPosition\(b\)/);
 assert.match(scene,/function sizeHandlePositions\(b\)/);
 assert.match(scene,/sizeHandlePositions,pickAt/);
});

test('all 23 authored variants appear per stone type with native AlanTil bracket tabs',()=>{
 const app=read('src/features/tower/index.js'),css=read('src/features/tower/tower.css');
 assert.match(app,/data-stone-kind/);
 assert.match(app,/ROCK_PACK\[STONE_KIND\[s\.type\]\]\.map\(\(_,variant\)/);
 assert.match(app,/data-variant/);
 assert.match(app,/s\.scene\.thumbnail\(/);
 assert.match(app,/class="bracketNavigation/);
 assert.match(app,/class="btn actionPrimary towerAction"/);
 assert.match(css,/var\(--accent\)/);
 assert.match(css,/var\(--surface-0\)/);
 assert.doesNotMatch(css,/--tower-accent|--tower-ink|--tower-paper/);
 assert.match(css,/\.towerTabs \.bracketNavigation/);
});

test('axis-sized 3D controls replace old stretch and variant toolbar',()=>{
 const app=read('src/features/tower/index.js'),scene=read('src/features/tower/scene.js'),css=read('src/features/tower/tower.css');
 assert.match(app,/data-axis/);
 assert.match(app,/resizeAxis\(axis,step\)/);
 assert.match(app,/sizeHandlePositions\(s\.preview\)/);
 assert.match(app,/setCatalogOpen\(true\)/);
 assert.match(app,/data-quick="cancel"/);
 assert.doesNotMatch(app,/data-quick="stretch"|data-quick="shrink"|data-quick="variant"/);
 assert.match(scene,/sizeHandlePositions/);
 assert.match(css,/\.towerAxisHandles/);
 assert.match(css,/width:44px;min-width:44px;height:44px/);
 assert.match(css,/prefers-reduced-motion/);
});

test('tower uses scoped 17.0.8 asset cache without changing app global version',()=>{
 const router=read('src/app/router.js');
 assert.match(router,/TOWER_ASSET_VERSION = "17\.0\.8"/);
 assert.match(router,/const ASSET_VERSION = "16\.8\.0\.16"/);
 assert.match(read('src/shared/styles/lazy/tower.css'),/tower\.css\?v=17\.0\.8/);
 assert.match(read('src/features/tower/index.js'),/scene\.js\?v=17\.0\.8/);
 assert.match(read('src/features/tower/scene.js'),/masonry-worker\.js\?v=17\.0\.8/);
});
