import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStoneProfiles,rockContains} from '../packages/tower-game/masonry-geometry.mjs';
import {packMasonryVolume,findMasonryJoints} from '../packages/tower-game/masonry-packing.mjs';

// Tiny actual 8-face low-poly stone; tests intentionally use geometric profiles
// instead of the old AABB seam-placement oracle.
const vertices=[[.5,.02,.5],[.5,.98,.5],[.02,.5,.5],[.98,.5,.5],[.5,.5,.02],[.5,.5,.98]];
const faces=[[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,4,2],[1,3,4],[1,5,3],[1,2,5]];
const bytes=[];
for(const [x,y,z]of vertices)bytes.push(Math.round(x*255),Math.round(z*255),Math.round(y*255));
for(const face of faces)bytes.push(...face);
const shape=[vertices.length,faces.length,[155,150,145],[160,154,150],btoa(String.fromCharCode(...bytes))];
const profiles=buildStoneProfiles({small:[shape],medium:[shape],long:[shape],big:[shape]});
const b=(id,x,y,z,sx=2,sy=2,sz=2,type='stone')=>({id,x,y,z,sx,sy,sz,type,rotation:0,variant:0});
const pair=[b('left',0,0,0),b('right',2,0,0)];

test('mesh silhouette occupies center but not beveled corners',()=>{
 assert.equal(rockContains(pair[0],[1,1,1],profiles),true);
 assert.equal(rockContains(pair[0],[.05,.05,.05],profiles),false);
});

test('joint volume is filled, deterministic, order-independent and non-purchasable',()=>{
 const original=JSON.stringify(pair);
 const first=packMasonryVolume(pair,profiles,{spacing:.2});
 assert.ok(first.joints>0);assert.ok(first.candidateCells>10);
 assert.equal(first.filledCells,first.candidateCells);
 assert.ok(first.stonePositions.length>0);
 assert.equal(first.stonePositions.length,first.stoneColors.length);
 assert.equal(first.stonePositions.length%9,0);
 assert.deepEqual(packMasonryVolume([...pair].reverse(),profiles,{spacing:.2}).stonePositions,first.stonePositions);
 assert.equal(JSON.stringify(pair),original);
 assert.deepEqual(packMasonryVolume([pair[0]],profiles,{spacing:.2}).stonePositions,new Float32Array());
});

test('window and door reservations prevent cavity infill',()=>{
 const plain=packMasonryVolume(pair,profiles,{spacing:.2});
 for(const type of ['window','door']){
  const blocked=packMasonryVolume([...pair,b(type,1,0,0,2,2,2,type)],profiles,{spacing:.2});
  assert.ok(blocked.candidateCells<plain.candidateCells);
 }
});

test('no diagonal joints; geometry respects valid scene coordinate system',()=>{
 assert.equal(findMasonryJoints([b('a',0,0,0),b('b',2,2,0)]).length,0);
 assert.equal(findMasonryJoints(pair).length,1);
});

test('cache and bounds remain stable across repeat requests',()=>{
 const cache=new Map();
 const a=packMasonryVolume(pair,profiles,{spacing:.2,cache});
 assert.equal(cache.size,1);
 assert.deepEqual(packMasonryVolume(pair,profiles,{spacing:.2,cache}).stonePositions,a.stonePositions);
 assert.deepEqual(packMasonryVolume([],profiles,{spacing:.2,cache}).stonePositions,new Float32Array());
 assert.equal(cache.size,0);
});
