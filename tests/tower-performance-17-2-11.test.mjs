import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
test("Approved tower layout stylesheet exists, route loads it by current release URL",async()=>{
 const [css,lazy,router]=await Promise.all([read("src/features/tower/tower.css"),read("src/shared/styles/lazy/tower.css"),read("src/app/router.js")]);
 assert.match(css,/\.towerGame\{/);
 assert.match(css,/\.towerStage\{/);
 assert.match(css,/\.towerCatalog\{/);
 assert.match(lazy,/tower\.css\?v=17\.2\.13/);
 assert.match(router,/TOWER_ASSET_VERSION = "17\.2\.13"/);
});
test("Rendering is invalidated by changes and is stopped when nothing changes",async()=>{
 const s=await read("src/features/tower/prefab-scene.js");
 assert.match(s,/function scheduleDraw\(\)/);
 assert.match(s,/if\(!disposed&&!document\.hidden&&!frame\)frame=requestAnimationFrame\(draw\)/);
 assert.match(s,/controls\.addEventListener\('change',cameraChanged\)/);
 assert.match(s,/document\.removeEventListener\('visibilitychange',onVisibility\)/);
 assert.match(s,/if\(needsRender\)\{needsRender=false;renderer\.render\(scene,camera\);\}/);
 assert.doesNotMatch(s,/frame=requestAnimationFrame\(draw\);controls\.update\(\)/);
});
test("Stable prefab meshes and joint tiles are reused on incremental rebuild",async()=>{
 const s=await read("src/features/tower/prefab-scene.js");
 assert.match(s,/renderedById=new Map\(\),renderedJoints=new Map\(\)/);
 assert.match(s,/entry\.signature!==signature/);
 assert.match(s,/function rebindGroup\(group,block\)/);
 assert.match(s,/renderedJoints\.get\(key\)/);
 assert.match(s,/targets\.length=0/);
 assert.doesNotMatch(s,/function clearPrevious\(\)/);
});
test("PBR loads in parallel with scene preparation, without changing authored meshes",async()=>{
 const [scene,surface,library]=await Promise.all([read("src/features/tower/prefab-scene.js"),read("src/features/tower/rock-surface.js"),read("src/features/tower/approved-section-scene.js")]);
 assert.match(scene,/const stoneMaterialPromise=getRockSurface\(renderer\)/);
 assert.match(scene,/const stoneMaterial=await stoneMaterialPromise/);
 assert.match(scene,/approvedModelPromises\.get\(key\)/);
 assert.match(surface,/KTX2Loader/);
 assert.match(surface,/falling back to PNG/);
 assert.match(library,/loadManualSection\(id,manifest\)/);
});
