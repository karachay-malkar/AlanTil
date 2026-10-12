import test from 'node:test';
import assert from 'node:assert/strict';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {adaptRockMesh,expandInfillRock} from '../packages/tower-game/rock-adaptation.mjs';
import {mapContactJoints,deformContactMesh,localToWorld} from '../packages/tower-game/masonry-contact.mjs';
import {buildCoreMortar} from '../packages/tower-game/masonry-core-mortar.mjs';

test('all 23 authored rock meshes preserve original vertices, triangles and colors when isolated',()=>{
 let count=0;
 for(const [category,entries] of Object.entries(ROCK_PACK))for(const [variant,source] of entries.entries()){
  const mesh=originalRockMesh(source,variant);
  const render=adaptRockMesh(mesh);
  assert.deepEqual(render.positions,mesh.positions,category+' '+variant+' shape changed');
  assert.deepEqual(render.indices,mesh.indices,category+' '+variant+' topology changed');
  assert.deepEqual(render.colors,mesh.colors,category+' '+variant+' palette changed');
  if(category==='small'){
   const pebble=expandInfillRock(mesh);
   assert.deepEqual(pebble.positions,mesh.positions,'no artificial pebble swelling');
   assert.deepEqual(pebble.indices,mesh.indices);
  }
  count++;
 }
 assert.equal(count,23);
});
test('contact surfaces add vertices and actually extend toward adjacent stone without moving placement',()=>{
 const a={id:'a',type:'medium',x:0,y:0,z:0,sx:2,sy:2,sz:2,rotation:0,variant:0};
 const b={...a,id:'b',x:2,variant:1};
 const joints=mapContactJoints([a,b]);
 const source=originalRockMesh(ROCK_PACK.medium[0],0);
 const mesh=adaptRockMesh(source);
 const result=deformContactMesh(mesh,a,joints.get('a'));
 assert.ok(result.positions.length>mesh.positions.length,'contact-only local tessellation needed');
 let toward=0;
 for(let i=0;i<mesh.positions.length;i+=3){
  const original=localToWorld(a,Array.from(mesh.positions.slice(i,i+3)))[0];
  const advanced=localToWorld(a,Array.from(result.positions.slice(i,i+3)))[0];
  if(advanced-original>.05)toward++;
 }
 assert.ok(toward>0,'real authored surface vertices must move at least 1.25 cm toward the neighbor');
 assert.equal(result.invalidContactFaces,0,'contact deform must not invert source triangles');
 assert.deepEqual(mesh.positions,source.positions,'source must not mutate');
 assert.deepEqual(deformContactMesh(mesh,a,[]).positions,mesh.positions);
});
test('interior mortar generates no synthetic stone cubes or rock-looking facade patches',()=>{
 const nx=10,ny=15,nz=15;
 const g={nx,ny,nz,stride:nx*ny,min:[0,0,0],dimension:[.12,.12,.12],mask:new Uint8Array(nx*ny*nz).fill(1),seamAxis:0,exteriorFaces:[[1,0],[1,1],[2,0],[2,1]]};
 const out=buildCoreMortar(g,new Uint8Array(nx*ny*nz*27),{subdivisions:3,maxTriangles:50000});
 assert.equal(out.wedgeVolume,0);
 assert.equal(out.wedgePositions.length,0);
 assert.equal(out.wedgeColors.length,0);
 assert.ok(out.volume>0,'real internal volumetric mortar remains');
 assert.equal(out.forbiddenVolume,0);
});