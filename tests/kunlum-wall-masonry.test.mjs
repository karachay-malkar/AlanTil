import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../src/vendor/three/three.module.js';
import {createKunlumMapOverlay} from '../src/features/tower/kunlum-map-overlay.js';

const facingSource=readFileSync(new URL('../src/features/tower/kunlum-stone-facing.js',import.meta.url),'utf8');
const layoutSource=readFileSync(new URL('../src/features/tower/kunlum-ruin-layout.js',import.meta.url),'utf8');
function demo({wall=false,auto=false,passage=false,openings=[]}={}){
 const confirmed_features=[
  ...(wall?[{id:'W',type:'wall',origin:'manual',points:[[-2,0],[2,0]]}]:[]),
  ...(passage?[{id:'P',type:'passage',origin:'manual',points:[[0,-2],[0,2]]}]:[])
 ];
 const auto_candidates=auto?[{id:'A',points:[[-2,0],[2,0]],promoted:false}]:[];
 return createKunlumMapOverlay(THREE,{confirmed_features,auto_candidates,openings},{
  toWorld:p=>p,heightAt:()=>0
 });
}
function crossesGap(segments,from,to){
 return segments.some(({a,b})=>Math.max(a[0],b[0])>from+1e-6&&Math.min(a[0],b[0])<to-1e-6);
}
test('confirmed and automatic 3D wall recipes retain a physical passage, not a drawn line',()=>{
 for(const kind of ['confirmed','candidates']){
  const scene=demo({wall:kind==='confirmed',auto:kind==='candidates',passage:true});
  const intervals=scene.segments[kind];
  assert.equal(intervals.length,2,'stone wall split into two real intervals');
  assert.equal(crossesGap(intervals,-.58,.58),false);
  assert.equal(scene.passages.children.length,0,'do not draw a passage stroke');
  assert.equal(scene.counters.passages,1);
  scene.dispose();
 }
});
test('duplicate unverified trace cannot seal a manually defined doorway',()=>{
 const scene=demo({wall:true,auto:true,openings:[{
  wallId:'W',start:{segment:0,t:.25},end:{segment:0,t:.75}
 }]});
 assert.ok(scene.segments.candidates.length>=2);
 assert.equal(crossesGap(scene.segments.candidates,-.98,.98),false);
 scene.dispose();
});
test('linked opening cuts real wall intervals before 3D mesh generation',()=>{
 const scene=demo({wall:true,openings:[{
  wallId:'W',start:{segment:0,t:.3},end:{segment:0,t:.7}
 }]});
 assert.equal(scene.segments.confirmed.length,2);
 assert.equal(crossesGap(scene.segments.confirmed,-.78,.78),false);
 assert.equal(scene.counters.linkedOpenings,1);
 assert.equal(scene.passages.children.length,0);
 scene.dispose();
});
test('stone facade uses Common100 geometry, instancing and bounded spatial chunks',()=>{
 assert.match(facingSource,/loadCommon100\(/);
 assert.match(facingSource,/getApprovedStoneSurfaceGeometry\(/);
 assert.match(facingSource,/mesh\.computeBoundingSphere\(\)/);
 assert.match(facingSource,/mesh\.frustumCulled=true/);
 assert.match(facingSource,/const count=mobile\?20:36/);
 assert.match(facingSource,/for\(const rock of layoutKunlumRuinStones\(seg\)\)/);
 assert.match(facingSource,/new THREE\.InstancedMesh/);
 assert.match(facingSource,/makeKunlumRuinShell/);
 assert.match(layoutSource,/kunlumRuinFoot\(x,z,width,heightAt/);
 assert.match(layoutSource,/kunlumRuinCrown\(height,x,z\)/);
});
test('far transitions crossfade detailed stones rather than popping geometry',()=>{
 assert.match(facingSource,/ruinFarBlend\(distance/);
 assert.match(facingSource,/farMaterial\.opacity=detailVisible\?farWeight:1/);
 assert.match(facingSource,/lodMaterial\.opacity=nearAlpha/);
 assert.match(facingSource,/lodMaterial\.opacity=mediumAlpha/);
 assert.match(facingSource,/bucket\.far\.visible=farWeight>0/);
 assert.match(facingSource,/const sources=near\?models:midModels/);
 assert.match(facingSource,/midModels=models\.filter/);
});
