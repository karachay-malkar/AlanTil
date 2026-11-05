import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three/three.module.js';
import {enhanceKunlumStoneWalls} from '../src/features/tower/kunlum-stone-facing.js';
import {layoutKunlumRuinStones} from '../src/features/tower/kunlum-ruin-layout.js';

async function setup(mobile){
 const root=new THREE.Group(),confirmed=new THREE.Group();
 root.add(confirmed);
 const seg={a:[0,0],b:[6,0],height:1.6,width:.5,heightAt:()=>0};
 const shape=new THREE.IcosahedronGeometry(.5,0);
 const names=Array.from({length:24},(_,i)=>'stone-'+i);
 const manifest={models:names.map(name=>({name,category:'main'}))};
 const geometries=new Map(names.map(name=>[name,shape]));
 const result=await enhanceKunlumStoneWalls(THREE,root,[{group:confirmed,segments:[seg]}],{
  mobile,materialPromise:Promise.resolve(new THREE.MeshStandardMaterial()),
  loadLibrary:async()=>({manifest,geometries})
 });
 const meshes=[];
 confirmed.traverse(mesh=>{if(mesh.isInstancedMesh)meshes.push(mesh);});
 return {root,seg,result,meshes,shape};
}
function snapshot(meshes){
 return meshes.map(mesh=>{
  const transforms=[];
  const matrix=new THREE.Matrix4();
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);transforms.push(matrix.elements.join(','));
  }
  return {id:mesh.id,geometry:mesh.geometry.uuid,count:mesh.count,transforms};
 });
}
for(const mobile of [false,true]){
 test('stable Common100 geometry and stone positions at every distance: '+(mobile?'mobile':'desktop'),async()=>{
  const {root,seg,result,meshes,shape}=await setup(mobile);
  assert.ok(meshes.length>0);
  assert.ok(meshes.every(m=>m.frustumCulled));
  assert.equal(result.stones,layoutKunlumRuinStones(seg).length*(mobile?2:3));
  const original=snapshot(meshes);
  for(const distance of [5,17,40,70,150,40,5]){
   result.update({position:new THREE.Vector3(distance,0,0)});
   assert.deepEqual(snapshot(meshes),original);
   const current=[];root.traverse(m=>{if(m.isInstancedMesh)current.push(m);});
   assert.equal(current.length,meshes.length,'camera movement must never add or remove stone geometry');
  }
  assert.equal(root.userData.ruinPlacementMode,'fixed-common100-instances-v1');
  assert.equal(root.userData.ruinWallStoneInstances,result.stones);
  result.dispose();
  shape.dispose();
 });
}
