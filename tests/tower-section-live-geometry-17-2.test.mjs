import test from 'node:test';
import assert from 'node:assert/strict';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {mapContactJoints,deformContactMesh} from '../packages/tower-game/masonry-contact.mjs';
import {buildSectionMasonry} from '../packages/tower-game/section-pipeline.mjs';
const counts=Object.fromEntries(Object.entries(ROCK_PACK).map(([name,arr])=>[name,arr.length]));
const models=new Map();
const getModel=(family,variant)=>{
 const key=family+':'+variant;
 if(!models.has(key))models.set(key,originalRockMesh(ROCK_PACK[family][variant],variant));
 return models.get(key);
};
const section=(id,x,y,z,size=[2,2,2])=>({id,type:'masonry_section',x,y,z,sx:size[0],sy:size[1],sz:size[2],rotation:0});
const examples={
 wall:[section('wall-1',2,0,2),section('wall-2',4,0,2),section('wall-3',6,0,2)],
 corner:[section('corner-1',2,0,2),section('corner-x',4,0,2),section('corner-z',2,0,4)],
 upper:[section('lower',2,0,2),section('upper',2,2,2),section('beside',4,0,2)],
};
for(const [name,sections] of Object.entries(examples)){
 test('authored-rock '+name+' mesh is generated with cross-section contacts',()=>{
  const output=buildSectionMasonry(sections,{getModel,rockCounts:counts,contactEngine:mapContactJoints,deform:deformContactMesh,maxStones:600});
  assert.equal(output.sections.length,3);
  assert.ok(output.stones.length>3,'each section contains multiple source rocks');
  assert.ok(output.joints.length>0,'contact surface between distinct sections');
  assert.ok(output.sections.every(batch=>batch.triangles>0&&batch.positions.length>0));
  assert.ok(output.sections.every(batch=>[...batch.positions].every(Number.isFinite)));
  assert.deepEqual(output.stones.map(s=>s.id),buildSectionMasonry(sections,{getModel,rockCounts:counts,maxStones:600}).stones.map(s=>s.id),'deterministic IDs');
 });
}
test('all 23 authored source assets remain the only stone models',()=>{
 assert.equal(Object.values(ROCK_PACK).reduce((n,arr)=>n+arr.length,0),23);
 for(const [family,assets] of Object.entries(ROCK_PACK))for(let i=0;i<assets.length;i++){
  const mesh=getModel(family,i);assert.ok(mesh.indices.length>0);assert.ok(mesh.positions.length>0);
 }
});
test('the actual scene imports the section Worker, supports picks, and removes old cuboid splitter',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/features/tower/scene.js',import.meta.url),'utf8');
 assert.match(source,/section-masonry-worker\.js/);
 assert.match(source,/toMasonrySections\(blocks,layer\)/);
 assert.match(source,/getPickedTowerBlock\(hit\)/);
 assert.match(source,/drawMasonry\(data\.infill\)/);
 assert.doesNotMatch(source,/function sectionStones\(/);
});
