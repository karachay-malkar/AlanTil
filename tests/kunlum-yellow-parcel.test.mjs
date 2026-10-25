import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {KUNLUM_BUILD_PARCEL as SITE,isWithinKunlumParcel,kunlumTerraceBlend} from '../packages/tower-game/kunlum-parcel.mjs';
import {createKunlumGameAlignment} from '../src/features/tower/kunlum-build-alignment.js';
import {PREFAB_WORLD_X_CELLS,PREFAB_WORLD_Z_CELLS,PREFAB_CELL_METERS,validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';
import {APPROVED_PREFAB_VERSION} from '../packages/tower-game/approved-prefab.mjs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const plan=JSON.parse(file('assets/tower/environment/kunlum-vector-plan-2026-10-23.json'));
const section=(x,z)=>({id:'00000000-0000-4000-8000-000000000001',type:'masonry_section',
 sectionId:'2x2x2',variant:0,rotation:0,geometryVersion:APPROVED_PREFAB_VERSION,x,y:0,z});
test('approved 2D plot matches exactly the 15x30m 25cm construction grid',()=>{
 assert.deepEqual([plan.plot.widthM,plan.plot.heightM,plan.plot.angleDeg],[30,15,-7]);
 assert.deepEqual([SITE.widthM,SITE.depthM,SITE.centerX,SITE.centerZ],[15,30,7.5,15]);
 assert.deepEqual([PREFAB_CELL_METERS,PREFAB_WORLD_X_CELLS,PREFAB_WORLD_Z_CELLS],[.25,60,120]);
 const pts=createKunlumGameAlignment({plot:plan.plot}).footprintScene;
 const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]);
 for(const [value,want] of [[Math.min(...xs),0],[Math.max(...xs),15],[Math.min(...zs),0],[Math.max(...zs),30]])
  assert.ok(Math.abs(value-want)<1e-7);
 assert.equal(plan.confirmed_features.length,120);
 assert.equal(plan.openings.length,42);
 assert.equal(plan.auto_candidates.filter(x=>!x.promoted).length,602);
});
test('existing placements fit; 15x30m boundaries reject overflow',()=>{
 for(const [x,z,valid] of [[0,0,true],[36,59,true],[58,118,true],[59,119,false],[60,0,false],[0,120,false],[-1,5,false]])
  assert.equal(validatePrefabPlacement([],section(x,z)).ok,valid,JSON.stringify({x,z}));
});
test('flat parcel and narrow 12m DEM transition',()=>{
 for(const [x,z] of [[0,0],[15,30],[7.5,15]])assert.equal(kunlumTerraceBlend(x,z),0);
 assert.equal(kunlumTerraceBlend(27,15),1);
 assert.equal(kunlumTerraceBlend(-12,15),1);
 assert.ok(Math.abs(kunlumTerraceBlend(21,15)-.5)<1e-8);
 assert.equal(isWithinKunlumParcel(15,30),true);
 assert.equal(isWithinKunlumParcel(15.01,30),false);
 assert.match(file('src/features/tower/kunlum-terrain-lod.js'),/if\(isWithinKunlumParcel\(x,z\)\)return 0/);
});
test('both editors and game use one 2D plan; auto candidates are volume meshes',()=>{
 const game=file('src/features/tower/kunlum-real-environment.js');
 const scene=file('src/features/tower/prefab-scene.js');
 const twoD=file('kunlum-vector-editor.html');
 const threeD=file('kunlum-terrace-editor-3d.html');
 const overlay=file('src/features/tower/kunlum-map-overlay.js');
 for(const content of [game,scene,twoD,threeD])assert.match(content,/kunlum-vector-plan-2026-10-23\.json/);
 assert.match(twoD,/const candidates=\[\];/);
 assert.match(twoD,/plot=\{\.\.\.data\.plot\}/);
 assert.match(scene,/PlaneGeometry\(SITE.widthM,SITE.depthM\)/);
 assert.match(game,/candidatesVisible:true/);
 assert.match(overlay,/wallPiece\(auto,a,b,1\.45,\.42\)/);
 assert.match(overlay,/addMesh\(candidates,auto/);
 assert.match(threeD,/wallQuad\(candidates,pts\[i-1\],pts\[i\],1\.4,\.42\)/);
 assert.match(threeD,/function buildParcel\(\)/);
 assert.doesNotMatch(overlay,/clipKunlumOutsideReserve|excludeBounds/);
});
test('new database migration only narrows grid; old migration retained unchanged',()=>{
 assert.match(file('supabase/migrations/20261025100000_tower_parcel_25x40.sql'),/px\+dims\[1\]>100 OR py\+dims\[2\]>80 OR pz\+dims\[3\]>160/);
 assert.match(file('supabase/migrations/20261025160000_tower_parcel_15x30.sql'),/px\+dims\[1\]>60 OR py\+dims\[2\]>80 OR pz\+dims\[3\]>120/);
});

test('same approved Common 100 geometries and PBR material drive both village renderers',()=>{
 const stone=file('src/features/tower/kunlum-stone-facing.js');
 const overlay=file('src/features/tower/kunlum-map-overlay.js');
 const editor=file('kunlum-terrace-editor-3d.html');
 const world=file('src/features/tower/kunlum-real-environment.js');
 assert.match(stone,/loadCommon100\(/);
 assert.match(stone,/getApprovedStoneSurfaceGeometry\(/);
 assert.match(stone,/getRockSurface\(/);
 assert.match(stone,/InstancedMesh/);
 assert.match(stone,/common100TowerBase/);
 assert.match(overlay,/enhanceKunlumStoneWalls/);
 assert.match(overlay,/Enclosed irregular core prevents any light leaking/);
 assert.match(editor,/createKunlumMapOverlay/);
 assert.match(world,/stoneMaterialPromise/);
});
test('construction opens in first person, and route button is the only overview control',()=>{
 const ui=file('src/features/tower/index.js');
 const stage=file('src/features/tower/prefab-scene.js');
 assert.match(ui,/data-world/);
 assert.doesNotMatch(ui,/button data-explore/);
 assert.match(stage,/enterExplore\(\);scheduleDraw\(\);container\.dataset\.ready/);
 assert.match(ui,/requestTowerLandscape/);
 assert.match(ui,/screen\.orientation\.lock\('landscape'\)/);
});
