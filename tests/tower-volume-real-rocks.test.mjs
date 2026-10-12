import test from 'node:test';
import assert from 'node:assert/strict';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {buildStoneProfiles,rockContains} from '../packages/tower-game/masonry-geometry.mjs';
import {packMasonryVolume} from '../packages/tower-game/masonry-packing.mjs';

const profiles=buildStoneProfiles(ROCK_PACK);
const b=(id,x,y,z,type='medium',variant=0,sx=2,sy=2,sz=2)=>({id,x,y,z,type,variant,sx,sy,sz,rotation:0});
test('all 23 authored stone variants decode and contain their geometric center',()=>{
 assert.equal(Object.values(ROCK_PACK).reduce((sum,entries)=>sum+entries.length,0),23);
 for(const [name,entries]of Object.entries(ROCK_PACK)){
  for(let i=0;i<entries.length;i++){
   const stone=b('s',0,0,0,name==='small'?'stone':name,i,3,3,3);
   assert.equal(rockContains(stone,[1.5,1.5,1.5],profiles),true,name+' '+i);
  }
 }
});
test('real irregular rocks form filled rather than scattered joins',()=>{
 const pair=[b('left',0,0,0),b('right',2,0,0,'medium',1)];
 const out=packMasonryVolume(pair,profiles,{spacing:.12});
 assert.ok(out.joints===1);
 assert.ok(out.candidateCells>0);
 assert.ok(out.filledCells>0&&out.filledCells<=out.candidateCells);assert.equal(out.stoneFilledCells,out.filledCells);assert.ok(out.residualFreeVolume>=0);
 assert.ok(out.stonePositions.length>0);
 assert.ok(out.penetrationVolume<=1e-5,'infill must not intrude into the two source stones: '+out.penetrationVolume);
 assert.ok(out.selfOverlapVolume<=1e-5,'separate infill stones must not intersect: '+out.selfOverlapVolume);
 assert.deepEqual(packMasonryVolume(pair,profiles,{spacing:.12}),out);
});
test('real 50-piece dry wall respects worker geometry budget',()=>{
 const wall=Array.from({length:50},(_,i)=>b('s'+i,i*2,0,0,'medium',i%ROCK_PACK.medium.length));
 const out=packMasonryVolume(wall,profiles,{spacing:.12,maxTriangles:90000});
 assert.equal(out.joints,49);
 assert.ok(out.candidateCells>1000);
 assert.ok((out.stonePositions.length+out.mortarPositions.length)/9<=90000);
});

test('truncated joint or fragment budgets cannot be reported complete',()=>{
 const pair=[b('left',0,0,0),b('right',2,0,0,'medium',1)];
 const skipped=packMasonryVolume(pair,profiles,{maxJoints:0});
 assert.equal(skipped.truncated,true);
 assert.equal(skipped.coverageComplete,false);
 const exhausted=packMasonryVolume(pair,profiles,{maxFragmentsPerJoint:0});
 assert.equal(exhausted.truncated,true);
 assert.equal(exhausted.coverageComplete,false);
 assert.ok(exhausted.wedgePhysicalVolume>0,'micro-wedges remain valid even when authored large rubble budget is zero');
 assert.equal(exhausted.fragments,0,'maxFragments=0 still forbids original mesh placement');
});
