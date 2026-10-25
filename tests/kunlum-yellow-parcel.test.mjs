import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {KUNLUM_BUILD_PARCEL as SITE,isWithinKunlumParcel,kunlumTerraceBlend} from '../packages/tower-game/kunlum-parcel.mjs';
import {PLOT,createKunlumGameAlignment} from '../src/features/tower/kunlum-build-alignment.js';
import {PREFAB_WORLD_X_CELLS,PREFAB_WORLD_Z_CELLS,PREFAB_CELL_METERS,validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';
import {APPROVED_PREFAB_VERSION} from '../packages/tower-game/approved-prefab.mjs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const section=(x,z)=>({id:'00000000-0000-4000-8000-000000000001',type:'masonry_section',
 sectionId:'2x2x2',variant:0,rotation:0,geometryVersion:APPROVED_PREFAB_VERSION,x,y:0,z});
test('yellow 25x40m parcel exactly covers the 25cm construction grid',()=>{
 assert.deepEqual([PLOT.widthM,PLOT.heightM,SITE.widthM,SITE.depthM],[25,40,25,40]);
 assert.deepEqual([PREFAB_CELL_METERS,PREFAB_WORLD_X_CELLS,PREFAB_WORLD_Z_CELLS],[.25,100,160]);
 const pts=createKunlumGameAlignment().footprintScene;
 const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]);
 for(const [actual,want] of [[Math.min(...xs),0],[Math.max(...xs),25],[Math.min(...zs),0],[Math.max(...zs),40]])
  assert.ok(Math.abs(actual-want)<1e-7,'plot and grid boundaries must agree');
});
test('old cells and new far edges are valid, overflow is rejected',()=>{
 for(const [x,z,valid] of [[0,0,true],[50,50,true],[98,158,true],[99,159,false],[100,0,false],[0,160,false],[-1,5,false]])
  assert.equal(validatePrefabPlacement([],section(x,z)).ok,valid,JSON.stringify({x,z}));
});
test('parcel is level with local 12m transition to natural relief',()=>{
 for(const [x,z] of [[0,0],[25,40],[12.5,20]])assert.equal(kunlumTerraceBlend(x,z),0);
 assert.equal(kunlumTerraceBlend(37,20),1);
 assert.equal(kunlumTerraceBlend(-12,20),1);
 assert.ok(Math.abs(kunlumTerraceBlend(31,20)-.5)<1e-8);
 assert.equal(isWithinKunlumParcel(25,40),true);
 assert.equal(isWithinKunlumParcel(25.01,40),false);
 assert.match(file('src/features/tower/kunlum-terrain-lod.js'),/if\(isWithinKunlumParcel\(x,z\)\)return 0/);
});
test('extra rectangles gone and map walls no longer clipped',()=>{
 const world=file('src/features/tower/kunlum-real-environment.js');
 const scene=file('src/features/tower/prefab-scene.js');
 const overlay=file('src/features/tower/kunlum-map-overlay.js');
 assert.doesNotMatch(world,/addPerimeter|buildOutline|excludeBounds:/);
 assert.doesNotMatch(scene,/new THREE\.GridHelper\(20,80/);
 assert.match(scene,/PlaneGeometry\(SITE.widthM,SITE.depthM\)/);
 assert.match(world,/candidatesVisible:true/);
 assert.doesNotMatch(overlay,/clipKunlumOutsideReserve|excludeBounds/);
});
test('database authority matches 100x160 snapped cells',()=>{
 const sql=file('supabase/migrations/20261025100000_tower_parcel_25x40.sql');
 assert.match(sql,/px\+dims\[1\]>100 OR py\+dims\[2\]>80 OR pz\+dims\[3\]>160/);
});
