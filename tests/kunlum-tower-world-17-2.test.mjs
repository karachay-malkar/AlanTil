import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getKunlumHeights} from '../src/features/tower/kunlum-terrain-lod.js';
import {sampleDemLocal} from '../src/features/tower/kunlum-georeference.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const scene=read('src/features/tower/prefab-scene.js');
const world=read('src/features/tower/kunlum-real-environment.js');
const terrain=read('src/features/tower/kunlum-terrain-lod.js');
const tower=read('src/features/tower/index.js');
const plan=JSON.parse(read('assets/tower/environment/kunlum-vector-plan-2026-10-23.json'));
const river=JSON.parse(read('assets/tower/environment/kunlum-cherek-balkarsky-osm.json'));
const height=getKunlumHeights();

test('game environment consumes the same approved plan and local OSM river as 3D preview',()=>{
 assert.equal(plan.confirmed_features.length,120);
 assert.equal(plan.openings.length,42);
 assert.equal(river.points.length,186);
 assert.match(world,/kunlum-vector-plan-2026-10-23\.json/);
 assert.match(world,/loadKunlumCherekLocal/);
 assert.match(world,/createKunlumRiverLayer/);
 assert.match(world,/createKunlumRiverbankScatter/);
 assert.match(world,/createKunlumMapOverlay/);
 assert.match(world,/createKunlumGameAlignment/);
 assert.match(read('src/features/tower/kunlum-build-alignment.js'),/plot\.angleDeg/);
 assert.doesNotMatch(world,/populateKunlumVectorSettlement\(/);
});

test('terrain geometry follows mirrored preview DEM, retains original DEM and isolated build plot',()=>{
 assert.equal(height.length,121*121);
 const before=sampleDemLocal(height,97.55,-94.95);
 assert.ok(Number.isFinite(before));
 assert.match(terrain,/mirrorDemX/);
 assert.match(terrain,/carveKunlumRiverHeight/);
 assert.match(terrain,/setRiverLine/);
 assert.match(world,/createKunlumNativeTerrainPBR/);
 assert.match(terrain,/kunlumTerraceBlend/);
 assert.equal(sampleDemLocal(height,97.55,-94.95),before);
});

test('tower building controls remain and new wide-view action is independently accessible',()=>{
 assert.match(tower,/data-world/);
 assert.match(tower,/scene\?\.worldView\(\)/);
 assert.match(scene,/worldView\(\)/);
 assert.match(scene,/raycaster\.intersectObjects\(\[\.\.\.targets,floor\],false\)/);
 assert.match(scene,/if\(needsRender\)\{needsRender=false;renderer\.render\(scene,camera\);\}/);
 assert.match(scene,/getRockSurface\(renderer\)/);
 assert.match(scene,/function scheduleDraw\(\)/);
 assert.match(scene,/kunlum\?\.update\?\./);
});

test('mapped walls and all unpromoted candidates are not clipped',()=>{
 assert.doesNotMatch(world,/excludeBounds:/);
 assert.doesNotMatch(read('src/features/tower/kunlum-map-overlay.js'),/clipKunlumOutsideReserve|excludeBounds/);
 assert.match(world,/candidatesVisible:true/);
});
