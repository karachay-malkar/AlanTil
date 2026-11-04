import test from 'node:test';
import assert from 'node:assert/strict';
import {RUIN_CHUNK_SIZE,ruinChunkKey,groupRuinSegments,ruinChunkDistance,selectKunlumRuinTier,ruinFarBlend} from '../src/features/tower/kunlum-ruin-lod.mjs';

test('ruin chunks preserve every historic segment and spatial order',()=>{
 const items=[{layer:0,seg:{a:[1,1],b:[4,1]}},{layer:0,seg:{a:[31,1],b:[35,1]}},{layer:1,seg:{a:[1,1],b:[4,1]}}];
 const groups=groupRuinSegments(items);
 assert.equal(groups.length,3);
 assert.equal(groups.reduce((n,c)=>n+c.segments.length,0),items.length);
 assert.equal(ruinChunkKey(31,1,0),'0:1:0');
 assert.equal(RUIN_CHUNK_SIZE,30);
 for(const c of groups)for(const s of c.segments)for(const p of [s.a,s.b]){
  assert.ok(p[0]>=c.bounds.minX&&p[0]<=c.bounds.maxX);
  assert.ok(p[1]>=c.bounds.minZ&&p[1]<=c.bounds.maxZ);
 }
});

test('distance is from the camera to the nearest chunk edge, not the village center',()=>{
 const b={minX:10,maxX:40,minZ:-30,maxZ:0};
 assert.equal(ruinChunkDistance({x:20,z:-10},b),0);
 assert.equal(ruinChunkDistance({x:45,z:-10},b),5);
 assert.equal(ruinChunkDistance({x:40,z:3},b),3);
});

test('LOD changes with moving camera without oscillation near thresholds',()=>{
 assert.equal(selectKunlumRuinTier(5),'near');
 assert.equal(selectKunlumRuinTier(40),'medium');
 assert.equal(selectKunlumRuinTier(140),'far');
 assert.equal(selectKunlumRuinTier(22,'near'),'near');
 assert.equal(selectKunlumRuinTier(25,'near'),'medium');
 assert.equal(selectKunlumRuinTier(141,'far'),'far');
 assert.equal(selectKunlumRuinTier(115,'far'),'medium');
 assert.equal(selectKunlumRuinTier(22,null,{mobile:true}),'medium');
});

test('far transition blends silhouettes smoothly without abrupt tier swaps',()=>{
 assert.equal(ruinFarBlend(80),0);
 assert.equal(ruinFarBlend(102.5),.5);
 assert.equal(ruinFarBlend(125),1);
 assert.equal(ruinFarBlend(80,{mobile:true}),.5);
 assert.equal(ruinFarBlend(100,{mobile:true}),1);
});
