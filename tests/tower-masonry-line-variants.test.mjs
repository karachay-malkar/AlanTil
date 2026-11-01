import test from 'node:test';
import assert from 'node:assert/strict';
import {planMasonryLine,checkMasonryLine,MAX_MASONRY_LINE} from '../packages/tower-game/masonry-line.mjs';
import {prefabBounds} from '../packages/tower-game/prefab-layout.mjs';
import {approvedVariantCount} from '../packages/tower-game/approved-prefab.mjs';

const first=(sectionId='1x1x1',rotation=0,x=2,z=2)=>({id:'00000000-0000-4000-8000-000000000001',type:'masonry_section',sectionId,variant:0,rotation,x,y:0,z,geometryVersion:'17.7-approved-manual.1'});
const combo=s=>`${s.variant}:${s.rotation}`;
const row=(anchor,count,axis='x')=>{
 const size=prefabBounds(anchor).size,step=axis==='x'?size[0]:size[2];
 return planMasonryLine({first:anchor,last:{...anchor,[axis]:anchor[axis]+step*(count-1)}}).sections;
};

test('line varies approved variant and yaw with no repeated neighboring combinations',()=>{
 for(const type of ['1x1x1','2x2x2','3x3x3']){
  const blocks=row(first(type),24,'z');
  assert.equal(blocks.length,24);
  assert.deepEqual(blocks[0],first(type));
  assert.equal(new Set(blocks.map(b=>b.variant)).size,approvedVariantCount(type));
  assert.equal(new Set(blocks.map(b=>b.rotation)).size,4);
  for(let i=1;i<blocks.length;i++)assert.notEqual(combo(blocks[i]),combo(blocks[i-1]));
  assert.equal(new Set(blocks.slice(0,approvedVariantCount(type)*4).map(combo)).size,approvedVariantCount(type)*4);
 }
});

test('rectangular masonry uses only equal-footprint orientations and remains contiguous',()=>{
 for(const rotation of [0,1,2,3])for(const axis of ['x','z']){
  const anchor=first('2x3x4',rotation,3,3),blocks=row(anchor,12,axis),original=prefabBounds(anchor).size;
  assert.equal(blocks.length,12);
  assert.equal(new Set(blocks.map(b=>b.variant)).size,3);
  assert.equal(new Set(blocks.map(b=>b.rotation)).size,2);
  for(let i=0;i<blocks.length;i++){
   const b=blocks[i],bb=prefabBounds(b);
   assert.deepEqual(bb.size,original);
   assert.equal(b.rotation%2,rotation%2);
   if(i>0){assert.notEqual(combo(b),combo(blocks[i-1]));assert.equal(b[axis]-blocks[i-1][axis],original[axis==='x'?0:2]);}
  }
  assert.deepEqual(checkMasonryLine([],blocks,null),{ok:true,reason:''});
 }
});

test('draft preview has stable sequence when endpoints move and same origin is reused',()=>{
 const anchor=first('1x1x1',0,6,8),short=row(anchor,6),long=row(anchor,16);
 assert.deepEqual(short,long.slice(0,6));
 assert.deepEqual(row(anchor,16),long);
 assert.notDeepEqual(row(first('1x1x1',0,7,8),16).map(combo),long.map(combo));
});

test('single section remains untouched; maximum line length and bounds are retained',()=>{
 const anchor=first('2x3x4',1);
 assert.deepEqual(planMasonryLine({first:anchor}).sections,[anchor]);
 assert.deepEqual(row(anchor,1),[anchor]);
 assert.equal(planMasonryLine({first:anchor,last:{...anchor,x:anchor.x+4*MAX_MASONRY_LINE}}).reason,'LINE_TOO_LONG');
});

test('negative-axis placement retains exact bounds and valid joins',()=>{
 for(const rotation of [0,1,2,3]){
  const anchor=first('2x3x4',rotation,42,88),size=prefabBounds(anchor).size;
  for(const axis of ['x','z']){
   const step=size[axis==='x'?0:2];
   const plan=planMasonryLine({first:anchor,last:{...anchor,[axis]:anchor[axis]-5*step}});
   assert.equal(plan.ok,true);
   assert.equal(plan.sections.length,6);
   assert.deepEqual(checkMasonryLine([],plan.sections,null),{ok:true,reason:''});
   for(let i=1;i<plan.sections.length;i++){
    assert.equal(plan.sections[i][axis]-plan.sections[i-1][axis],-step);
    assert.deepEqual(prefabBounds(plan.sections[i]).size,size);
   }
  }
 }
});

test('planner does not change placed sections or mutate draft anchors',()=>{
 const a=first('3x3x3'),b={...a,z:38};
 const before=structuredClone({a,b});
 const result=planMasonryLine({first:a,last:b});
 assert.deepEqual({a,b},before);
 assert.notEqual(result.sections[1].variant+':'+result.sections[1].rotation,result.sections[0].variant+':'+result.sections[0].rotation);
});
