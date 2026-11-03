import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {prefabBounds,touchingPrefabPairs} from '../packages/tower-game/prefab-layout.mjs';
import {resolvePrefabJoints} from '../packages/tower-game/prefab-joints.mjs';
import {APPROVED_PREFAB_VERSION} from '../packages/tower-game/approved-prefab.mjs';
const EPS=1e-5;
const overlap=(a,b,k)=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k]);
function baselinePairs(blocks){
 const result=[];
 for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++){
  if(blocks[i].type==='roof_beam'||blocks[j].type==='roof_beam')continue;
  const a=prefabBounds(blocks[i]),b=prefabBounds(blocks[j]);
  for(let axis=0;axis<3;axis++){
   const forward=Math.abs(a.max[axis]-b.min[axis])<EPS;
   const reverse=Math.abs(b.max[axis]-a.min[axis])<EPS;
   if(!forward&&!reverse)continue;
   const u=(axis+1)%3,v=(axis+2)%3;
   if(overlap(a,b,u)<EPS||overlap(a,b,v)<EPS)continue;
   const min=[0,1,2].map(k=>k===axis?(forward?a.max[k]:b.max[k]):Math.max(a.min[k],b.min[k]));
   const max=[0,1,2].map(k=>k===axis?min[k]:Math.min(a.max[k],b.max[k]));
   result.push({a:blocks[i].id,b:blocks[j].id,axis:['x','y','z'][axis],min,max,
    point:min.map((v,k)=>(v+max[k])/2),span:max.map((v,k)=>v-min[k]),
    aFace:forward?'+':'-',bFace:forward?'-':'+'});
  }
 }
 return result;
}
function stone(id,x=0,y=0,z=0,rotation=0){
 return {id,type:'masonry_section',sectionId:'2x2x2',variant:0,
  geometryVersion:APPROVED_PREFAB_VERSION,rotation,x,y,z};
}
test('precomputed section bounds preserve exact original contact ordering, normals and coordinates',()=>{
 const scenarios=[
  [stone('a'),stone('b',2),stone('c',0,0,2)],
  [stone('a'),stone('b',0,2),stone('c',0,0,2,1)],
  [stone('a'),stone('b',2.000004),stone('c',0,0,2.00002)],
  Array.from({length:160},(_,i)=>stone('long'+i,(i%20)*2,Math.floor(i/20)%4*2,Math.floor(i/80)*2)),
  Array.from({length:190},(_,i)=>stone('spread'+i,i*4,i%5*3,i%3*5))
 ];
 for(const blocks of scenarios)assert.deepEqual(touchingPrefabPairs(blocks),baselinePairs(blocks));
});
test('connector resolver preserves existing real version and triple junction corner locations',()=>{
 const blocks=[stone('core'),stone('east',2),stone('north',0,0,2)];
 const r=resolvePrefabJoints(blocks,{version:APPROVED_PREFAB_VERSION});
 assert.equal(r.ok,true);
 assert.ok(r.pairs.some(x=>x.axis==='x')&&r.pairs.some(x=>x.axis==='z'));
 assert.ok(r.joints.some(x=>x.axis==='corner'),'stone corner infill must be preserved');
 const before=JSON.stringify(r);
 assert.equal(JSON.stringify(resolvePrefabJoints(blocks,{version:APPROVED_PREFAB_VERSION})),before);
});
test('diagnostic contact broad phase benchmark on large tower does not change geometry',()=>{
 const blocks=Array.from({length:300},(_,i)=>stone('block'+i,(i%20)*2,Math.floor(i/20)*2,0));
 const start=performance.now();const expected=baselinePairs(blocks);const oldMs=performance.now()-start;
 const optimizedStart=performance.now();const actual=touchingPrefabPairs(blocks);
 const newMs=performance.now()-optimizedStart;
 assert.deepEqual(actual,expected);
 console.log(JSON.stringify({contactPairs:actual.length,sections:blocks.length,
  baselineMs:+oldMs.toFixed(2),optimizedMs:+newMs.toFixed(2)}));
});

/** Broad phase must skip distant pairs without changing exact contact coordinates. */
test('sweep candidate pruning avoids the quadratic search for scattered towers',()=>{
 const blocks=Array.from({length:2000},(_,i)=>stone('spread-'+i,i*4,0,0));
 const measured={};
 const started=performance.now();
 const result=touchingPrefabPairs(blocks,measured);
 const elapsedMs=performance.now()-started;
 assert.deepEqual(result,[]);
 assert.equal(measured.visitedSections,blocks.length);
 assert.equal(measured.candidatePairs,0);
 assert.equal(measured.returnedContacts,0);
 console.log(JSON.stringify({scenario:'scattered',sections:blocks.length,elapsedMs:+elapsedMs.toFixed(2),candidates:measured.candidatePairs}));
});

test('sweep preserves all near-contact and epsilon-adjacent results',()=>{
 const blocks=Array.from({length:110},(_,i)=>stone('packed'+i,(i%11)*2,Math.floor(i/11)%5*2,Math.floor(i/55)*2));
 blocks.push(stone('tolerance',22.000004,0,0));
 const measured={};
 const actual=touchingPrefabPairs(blocks,measured);
 assert.deepEqual(actual,baselinePairs(blocks));
 assert.ok(measured.candidatePairs<blocks.length*(blocks.length-1)/2);
 assert.equal(measured.returnedContacts,actual.length);
});
