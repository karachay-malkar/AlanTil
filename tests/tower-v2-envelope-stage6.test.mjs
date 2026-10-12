import test from 'node:test';
import assert from 'node:assert/strict';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {bodyForTowerBlock} from '../packages/tower-game/stone-mesh-adapter.mjs';
import {penetrates} from '../packages/tower-game/stone-placement-v2.mjs';
import {certifiedAxisGapM,certifiedV2StretchBudgets,V2_MASONRY_POLICY} from '../packages/tower-game/masonry-v2-envelope.mjs';
import {buildV2CertifiedPresentation} from '../packages/tower-game/masonry-v2-presentation.mjs';
const block=(id,x,z=20,y=0)=>({id,type:'medium',x,y,z,sx:2,sy:1,sz:1,rotation:0,variant:0});
const pair=()=>[block('rock-a',20),block('rock-b',22.1)];
const body=b=>bodyForTowerBlock(originalRockMesh(ROCK_PACK.medium[b.variant],b.variant),b);

test('conservative display certificate reserves a positive canonical gap for BOTH stones',()=>{
 const [A,B]=pair().map(body),gap=certifiedAxisGapM(A,B);
 assert(gap>.020&&gap<.05,'Source meshes must retain the real nonzero AABB gap');
 const {limits,policyVersion}=certifiedV2StretchBudgets([A,B]);
 assert.equal(policyVersion,V2_MASONRY_POLICY.version);
 assert.equal(limits.length,2);
 assert.equal(limits[0],limits[1]);
 assert(limits[0]>0&&limits[0]<.020);
 assert(2*limits[0]+V2_MASONRY_POLICY.separationReserveM<=gap+1e-10);
});
test('overlapping authored AABBs fail closed even when a more expensive SAT might separate them',()=>{
 const fake=a=>({bbox:{min:[...a],max:[a[0]+1,a[1]+1,a[2]+1]}});
 assert.equal(certifiedAxisGapM(fake([0,0,0]),fake([.5,.5,.5])),0);
 assert.deepEqual(certifiedV2StretchBudgets([fake([0,0,0]),fake([.5,.5,.5])]).limits,[0,0]);
 assert.throws(()=>certifiedV2StretchBudgets([fake([0,0,0])],{maxStretchM:.50}),RangeError);
});
test('worker V2 presentation is deterministic, sourced, bounded, and does not alter server collision geometry',()=>{
 const blocks=pair(),original=structuredClone(blocks);
 const output=buildV2CertifiedPresentation(blocks);
 const reversed=buildV2CertifiedPresentation(blocks.slice().reverse());
 assert.deepEqual(blocks,original,'Never mutate stored or purchased rock transforms');
 assert.equal(output.masonryContractVersion,2);
 assert.equal(output.sourceOnly,true);
 assert.equal(output.mortarPositions.length,0);
 assert.equal(output.fragments,output.placements.length);
 assert(output.movedVertices>0,'Expected facing source vertices to fit');
 assert(output.fits.length>0);
 assert(output.fragments>0,'At least one truly sourced infill stone should fit this physical joint');
 assert(output.maxMoveM<=.020+1e-6);
 assert.deepEqual(output.placements,reversed.placements);
 assert.deepEqual(output.fits.map(x=>[x.id,x.certifiedBudgetM,x.movedVertices]),reversed.fits.map(x=>[x.id,x.certifiedBudgetM,x.movedVertices]));
 const byId=new Map(blocks.map(b=>[b.id,b]));
 const originals=blocks.map(body);
 const fitted=output.fits.map(f=>{
  const b=byId.get(f.id),source=originalRockMesh(ROCK_PACK.medium[b.variant],b.variant);
  assert(f.maxMoveM<=f.certifiedBudgetM+1e-6);
  return bodyForTowerBlock({...source,positions:f.positions},b);
 });
 assert.equal(penetrates(...originals),false,'Server must accept original separated source hulls');
 assert.equal(penetrates(...fitted),false,'The displayed fitted source hulls must not penetrate');
});
test('two authoritative stones in contact cannot be visually deformed past their certified separating axis',()=>{
 const [left,right]=pair().map(body);
 const output=buildV2CertifiedPresentation(pair());
 const gap=certifiedAxisGapM(left,right);
 const sum=output.fits.reduce((total,f)=>total+f.maxMoveM,0);
 assert(sum<=gap-V2_MASONRY_POLICY.separationReserveM+1e-5);
});
test('50 distant rocks never trigger an expensive per-frame fit; all worker geometry stays bounded',()=>{
 const blocks=Array.from({length:50},(_,i)=>block('r'+i,2+(i%7)*7,2+Math.floor(i/7)*7));
 const start=performance.now();
 const result=buildV2CertifiedPresentation(blocks,{maxStones:36,maxJoints:90,steps:7});
 assert.equal(result.fits.length,0);
 assert.equal(result.fragments,0);
 assert.equal(result.joints,0);
 assert(result.computeMs<3500,`50-geometry worker budget exceeded: ${result.computeMs}ms`);
 assert(performance.now()-start<3500);
});
