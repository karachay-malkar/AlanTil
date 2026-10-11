import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('camera tween state exists before the renderer begins its first frame',()=>{
 const scene=read('src/features/tower/scene.js');
 assert.ok(scene.indexOf('let flight=null;')<scene.indexOf('let frame;function animate('));
 assert.match(scene,/controls\.addEventListener\('start',cancelFlight\)/);
});

test('meadow scene, subdued grid and responsive shadow budget',()=>{
 const scene=read('src/features/tower/scene.js');
 assert.match(scene,/function grassTexture\(\)/);
 assert.match(scene,/new THREE\.CanvasTexture\(canvas\)/);
 assert.match(scene,/grid\.material\.opacity=\.12/);
 assert.match(scene,/Stylized rocky gorge/);
 assert.match(scene,/sun\.shadow\.mapSize\.set\(matchMedia/);
 assert.match(scene,/const contact=new THREE\.Mesh/);
 assert.match(scene,/function screenPosition\(b\)/);
});

test('tower catalog produces true 3D thumbnails and reusable interactions',()=>{
 const app=read('src/features/tower/index.js');
 const css=read('src/features/tower/tower.css');
 assert.match(app,/s\.scene\.thumbnail\(/);
 assert.match(app,/towerQuickTools/);
 assert.match(app,/resizeStone\(direction\)/);
 assert.match(app,/data-quick="cancel"/);
 assert.match(app,/status\(''\);updatePreview\(\)/);
 assert.match(app,/actionBar\.classList\.toggle\('is-visible',!!b\)/);
 assert.match(css,/\.towerActionBar\.towerContextual/);
 assert.match(css,/\.towerQuickTools button/);
 assert.match(css,/min-height:44px/);
});

test('tower uses scoped cache generation without changing other feature cache',()=>{
 const router=read('src/app/router.js');
 assert.match(router,/TOWER_ASSET_VERSION = "17\.0\.5"/);
 assert.match(router,/const ASSET_VERSION = "16\.8\.0\.16"/);
 assert.match(read('src/shared/styles/lazy/tower.css'),/tower\.css\?v=17\.0\.5/);
 assert.match(read('src/features/tower/index.js'),/scene\.js\?v=17\.0\.5/);
});

