import test from 'node:test';
import assert from 'node:assert/strict';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {repairRockDisplayWinding} from '../packages/tower-game/rock-display-winding.mjs';
import {bodyForTowerBlock} from '../packages/tower-game/stone-mesh-adapter.mjs';
import {rayExtent} from '../packages/tower-game/masonry-v2-joints.mjs';
import {packV2AuthoredInfill} from '../packages/tower-game/masonry-v2-authored.mjs';
const block=(x,id,y=0)=>({id,type:'medium',x,y,z:20,sx:2,sy:1,sz:1,rotation:0,variant:0});
const A=block(20,'rock-a'),B=block(22.10,'rock-b');
const fresh=()=>[structuredClone(A),structuredClone(B)];

test('V2 fills measured source-triangle joints only; no source pair means no infill',()=>{
 const none=packV2AuthoredInfill([A]);assert.equal(none.placements.length,0);
 const apart=packV2AuthoredInfill([A,block(40,'remote')]);assert.equal(apart.joints,0);assert.equal(apart.placements.length,0);
 const joined=packV2AuthoredInfill(fresh());
 assert.equal(joined.sourceOnly,true);assert.equal(joined.unit,'meters');
 assert.equal(joined.fragments,joined.placements.length,'Worker must report real pebble count for WebGL QA');
 assert.equal(joined.joints>=1,true);assert.equal(joined.placements.length>=1,true);
 assert.equal(joined.mortarPositions.length,0,'V2 must not generate rectangular mortar');
 assert.equal(joined.mortarColors.length,0,'V2 must not use artificial mortar geometry');
 assert.equal(joined.stonePositions.length,joined.stoneColors.length);
 assert.deepEqual(fresh(),[A,B],'Derived presentation must not mutate saved stones');
});

test('all V2 pebble vertices and triangles come from seven original sourced meshes',()=>{
 const output=packV2AuthoredInfill(fresh());let cursor=0;
 for(const placement of output.placements){
  assert(placement.sourceVariant>=0&&placement.sourceVariant<7);
  assert(placement.dimensions.every(v=>v>0&&v<=.15));
  assert(placement.leftClearance>=-.006&&placement.rightClearance>=-.006);
  assert(placement.leftClearance<=.031&&placement.rightClearance<=.031);
  assert.equal(placement.between,'rock-a|rock-b');
  const source=repairRockDisplayWinding(originalRockMesh(ROCK_PACK.small[placement.sourceVariant],placement.sourceVariant));
  const triangles=source.indices.length;
  for(let i=0;i<triangles;i++){
   const id=source.indices[i];
   for(let axis=0;axis<3;axis++){
    const value=output.stonePositions[cursor++];
    const expected=placement.center[axis]+source.positions[id*3+axis]*placement.dimensions[axis];
    assert.ok(Math.abs(value-expected)<5e-7,'No generated stone mesh or missing source triangle');
   }
  }
 }
 assert.equal(cursor,output.stonePositions.length);
});

test('V2 infill is deterministic and never places below ground or changes wallet',()=>{
 const t1=packV2AuthoredInfill(fresh()),t2=packV2AuthoredInfill(fresh().reverse());
 assert.deepEqual(t1.placements,t2.placements);
 assert.deepEqual([...t1.stonePositions],[...t2.stonePositions]);
 assert.ok(t1.placements.every(p=>p.center[1]-p.dimensions[1]/2>=-1e-4));
 assert.ok(t1.placements.every(p=>!('paidAmount' in p)&&!('id' in p)&&!('currency' in p)));
 const top=packV2AuthoredInfill([block(20,'a',8),block(22.1,'b',8)]);
 assert.equal(top.placements.every(p=>p.center[1]>=0),true);
});

test('actual surface gap on accepted pebble centre is 36–160mm',()=>{
 const blocks=fresh(),bodies=blocks.map(b=>bodyForTowerBlock(originalRockMesh(ROCK_PACK.medium[b.variant],b.variant),b));
 const out=packV2AuthoredInfill(blocks);
 for(const p of out.placements){
  const [first,second]=bodies,axis=p.axis;
  const u=[1,0,0][axis],v=[2,2,1][axis];
  const left=rayExtent(first,axis,p.center[u],p.center[v],'high');
  const right=rayExtent(second,axis,p.center[u],p.center[v],'low');
  assert.ok(left!==null&&right!==null);
  assert.ok(right-left>=.035&&right-left<=.161);
 }
});

test('50 independent stones are bounded by pair broadphase and filler budgets',()=>{
 const blocks=Array.from({length:50},(_,i)=>({id:`r${i}`,type:'medium',sx:2,sy:1,sz:1,rotation:0,variant:0,x:2+(i%7)*7,y:0,z:2+Math.floor(i/7)*7}));
 const started=performance.now(),r=packV2AuthoredInfill(blocks,{maxStones:24,maxJoints:90});
 assert.equal(r.joints,0);assert.equal(r.placements.length,0);
 assert.ok(performance.now()-started<3000,'No dense N² collision calculations when pieces are distant');
});
