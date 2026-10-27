import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../src/vendor/three/three.module.js';
import {createKunlumMapOverlay} from '../src/features/tower/kunlum-map-overlay.js';

const overlaySource=readFileSync(new URL('../src/features/tower/kunlum-map-overlay.js',import.meta.url),'utf8');
const facingSource=readFileSync(new URL('../src/features/tower/kunlum-stone-facing.js',import.meta.url),'utf8');
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
function nearGap(mesh,min=-.58,max=.58){
 const attr=mesh.geometry.getAttribute('position');
 for(let i=0;i<attr.count;i++){
  const x=attr.getX(i);
  if(x>min&&x<max)return true;
 }
 return false;
}
test('confirmed and automatic mapped walls contain real passage gaps, with no overlay strokes',()=>{
 for(const kind of ['confirmed','candidates']){
  const scene=demo({wall:kind==='confirmed',auto:kind==='candidates',passage:true});
  const target=scene[kind].children.find(x=>x.isMesh);
  assert.ok(target,'volume mesh must remain present for '+kind);
  assert.equal(nearGap(target),false,'wall volume crosses physical passage');
  assert.equal(scene.passages.children.length,0,'passage lines must never render');
  assert.equal(scene.counters.passages,1);
  scene.dispose();
 }
});
test('a duplicate automatic trace cannot seal a confirmed doorway',()=>{
 const scene=demo({wall:true,auto:true,openings:[{
  wallId:'W',start:{segment:0,t:.25},end:{segment:0,t:.75}
 }]});
 const mesh=scene.candidates.children.find(x=>x.isMesh);
 assert.ok(mesh);
 assert.equal(nearGap(mesh,-.98,.98),false,'automatic masonry sealed a doorway');
 scene.dispose();
});
test('the original 42-style linked intervals cut stone geometry instead of drawing a line',()=>{
 const scene=demo({wall:true,openings:[{
  wallId:'W',start:{segment:0,t:.3},end:{segment:0,t:.7}
 }]});
 const mesh=scene.confirmed.children.find(x=>x.isMesh);
 assert.ok(mesh);
 assert.equal(nearGap(mesh,-.78,.78),false,'linked interval has an actual opening');
 assert.equal(scene.counters.linkedOpenings,1);
 assert.equal(scene.passages.children.length,0);
 scene.dispose();
});
test('stretched whole-trace stones are impossible, Common100 remains, and faceted stones are organic',()=>{
 assert.match(facingSource,/const farBins=new Map\(\)/);
 assert.match(facingSource,/mesh\.computeBoundingSphere\(\)/);
 assert.match(facingSource,/mesh\.frustumCulled=true/);
 assert.match(facingSource,/const count=mobile\?32:52/);
 assert.match(facingSource,/m\.category==='main'\|\|m\.category==='large'/);
 assert.match(facingSource,/for\(const rock of layoutKunlumRuinStones\(seg\)\)/);
 assert.match(facingSource,/function makeDistanceStone\(seed\)/);
 assert.doesNotMatch(facingSource,/choices=\[3,14,26,37,49,60\]/);
 assert.doesNotMatch(overlaySource,/new THREE\.LineSegments\(g,m\);lines\.name/);
});

test('one stone style renders per wall: near Common100 and distant faceted instances never overlap',()=>{
 assert.match(facingSource,/const budget=mobile\?3200:7200,nearJobs=new Set\(\)/);
 assert.match(facingSource,/if\(nearJobs\.has\(i\)\)continue/);
 assert.match(facingSource,/if\(!nearJobs\.has\(index\)\)continue/);
 assert.match(facingSource,/kunlumRuinFoot\(x,z,seg\.width,seg\.heightAt/);
 assert.match(facingSource,/kunlumRuinCrown\(seg\.height,x,z\)/);
 assert.doesNotMatch(facingSource,/seg\.heightAt\(x,z\)\+\.035\+\(row\+\.5\)\*h/);
});
