import test from 'node:test';import assert from 'node:assert/strict';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {bodyForTowerBlock} from '../packages/tower-game/stone-mesh-adapter.mjs';
import {fitV2DisplayMesh} from '../packages/tower-game/masonry-v2-fit.mjs';
const block=(x,id,rotation=0)=>({id,type:'medium',x,y:0,z:20,sx:2,sy:1,sz:1,rotation,variant:0});
const mesh=originalRockMesh(ROCK_PACK.medium[0]);
test('bounded physical-surface presentation fitting extends source stone toward neighbour',()=>{
 const a=block(20,'a'),b=block(22,'b'),aa=bodyForTowerBlock(mesh,a),bb=bodyForTowerBlock(mesh,b);
 const first=fitV2DisplayMesh(mesh,a,aa,[bb]);
 assert.ok(first.movedVertices>0);assert.ok(first.maxMoveM<=.020001);
 assert.equal(first.positions.length,mesh.positions.length);
 assert.deepEqual([...mesh.positions],Array.from(originalRockMesh(ROCK_PACK.medium[0]).positions),'Original source must be immutable');
 const gap=fitV2DisplayMesh(mesh,a,aa,[bodyForTowerBlock(mesh,block(40,'far'))]);
 assert.equal(gap.movedVertices,0);assert.deepEqual([...gap.positions],[...mesh.positions]);
});
test('fitting may be disabled or bounded to 20mm, and all output finite',()=>{
 const a=block(20,'a'),aa=bodyForTowerBlock(mesh,a),bb=bodyForTowerBlock(mesh,block(22,'b'));
 assert.deepEqual([...fitV2DisplayMesh(mesh,a,aa,[bb],{maxStretchM:0}).positions],[...mesh.positions]);
 const r=fitV2DisplayMesh(mesh,a,aa,[bb],{maxStretchM:0.9});
 assert.ok(r.maxMoveM<=.020001);assert.ok([...r.positions].every(Number.isFinite));
});
test('contact fitter never creates/removes authored vertices or flips source triangles',()=>{
 const a=block(20,'a'),b=block(22,'b'),aa=bodyForTowerBlock(mesh,a),bb=bodyForTowerBlock(mesh,b);
 const result=fitV2DisplayMesh(mesh,a,aa,[bb]),v=result.positions,p=mesh.positions,idx=mesh.indices;
 for(let f=0;f<idx.length;f+=3){
  const [i,j,k]=idx.slice(f,f+3).map(x=>x*3);const cross=q=>{
   const u=[q[j]-q[i],q[j+1]-q[i+1],q[j+2]-q[i+2]],w=[q[k]-q[i],q[k+1]-q[i+1],q[k+2]-q[i+2]];
   return[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];};
  const n0=cross(p),n1=cross(v),dot=n0.reduce((sum,x,k)=>sum+x*n1[k],0);
  assert.ok(dot>0,`triangle ${f/3} must not flip`);
 }
 assert.equal(mesh.positions.length,result.positions.length);
});
