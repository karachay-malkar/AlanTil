import test from 'node:test';
import assert from 'node:assert/strict';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {adaptRockMesh} from '../packages/tower-game/rock-adaptation.mjs';
import {findContactJoints,mapContactJoints,localToWorld,worldToLocal,deformContactMesh,unwarpContactPoint} from '../packages/tower-game/masonry-contact.mjs';
const b=(id,x,y,z,rotation=0)=>({id,type:'medium',x,y,z,sx:2,sy:2,sz:2,variant:0,rotation});
test('rotation round-trips all eight allowed orientations',()=>{
 for(let rotation=0;rotation<8;rotation++){
  const block=b('r',0,0,0,rotation),p=[.23,-.15,.06];
  const reconstructed=worldToLocal(block,localToWorld(block,p));
  reconstructed.forEach((v,i)=>assert.ok(Math.abs(v-p[i])<1e-7));
 }
});
test('only actual adjacent faces generate contact constraints',()=>{
 const left=b('a',0,0,0),right=b('b',2,0,0),far=b('c',6,0,0);
 const joints=findContactJoints([left,right,far]);
 assert.equal(joints.length,1);assert.equal(joints[0].axis,0);assert.equal(joints[0].plane,2);
 const mapping=mapContactJoints([left,right,far]);
 assert.equal(mapping.get('a').length,1);assert.equal(mapping.has('c'),false);
});
test('contact deformation is local and deterministic while grid placement stays fixed',()=>{
 const left=b('a',0,0,0),right=b('b',2,0,0),joints=findContactJoints([left,right]);
 const stone=adaptRockMesh(originalRockMesh(ROCK_PACK.medium[0],0));
 const shifted=deformContactMesh(stone,left,joints),again=deformContactMesh(stone,left,joints);
 assert.deepEqual(shifted.positions,again.positions);assert.deepEqual(shifted.indices,again.indices);
 assert.ok(shifted.positions.length>stone.positions.length,'contact-only surface must gain local vertices');
 assert.equal(shifted.colors.length,shifted.positions.length,'vertex colors must follow contact subdivision');
 let changes=0,maxDelta=0;
 for(let i=0;i<stone.positions.length;i+=3){
  const w=localToWorld(left,[stone.positions[i],stone.positions[i+1],stone.positions[i+2]]);
  const d=localToWorld(left,[shifted.positions[i],shifted.positions[i+1],shifted.positions[i+2]]);
  const magnitude=Math.hypot(...d.map((v,j)=>v-w[j]));
  if(magnitude>.001)changes++;maxDelta=Math.max(maxDelta,magnitude);
 }
 assert.ok(changes>0);assert.ok(maxDelta<=.701);
 assert.equal(left.x,0);assert.equal(right.x,2);
 const unwarped=unwarpContactPoint([1.96,.93,1.12],left.id,joints);
 assert.ok(unwarped.every(Number.isFinite));
});
