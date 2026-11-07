import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../src/vendor/three/three.module.js';
import {enhanceKunlumStoneWalls} from '../src/features/tower/kunlum-stone-facing.js';

test('approved cast LODs are offline GLB and KTX2 pairs with declining triangle budgets',()=>{
 const root=new URL('../assets/tower/approved-library/lod-baked/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
 assert.equal(Object.keys(manifest.files).length,9);
 for(const name of ['section-2x2x2-v3','section-3x3x3-v2','abay-kala']){
  const rows=[1,2,3].map(level=>{
   const key='lod'+level+'/'+name,stat=manifest.files[key];
   const glb=readFileSync(new URL(key+'.glb',root));
   const ktx2=readFileSync(new URL(key+'.ktx2',root));
   assert.equal(glb.subarray(0,4).toString(),'glTF');
   assert.equal(ktx2.subarray(0,12).toString('hex'),'ab4b5458203230bb0d0a1a0a');
   assert.ok(ktx2.readUInt32LE(40)>1,'mipmaps');
   assert.equal(stat.glbBytes,glb.length);
   assert.equal(stat.ktx2Bytes,ktx2.length);
   assert.ok(stat.resolution>=256&&stat.resolution<=1024);
   return stat;
  });
  assert.ok(rows[0].triangles>rows[1].triangles);
  assert.ok(rows[1].triangles>rows[2].triangles);
  assert.ok(rows[2].triangles/rows[0].sourceFaces<(name==='abay-kala'?.34:.05));
 }
});

test('mapped segments have one visible physical LOD per spatial chunk and natural stone scale',async()=>{
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();
 const geometries=Array.from({length:4},()=>new THREE.BoxGeometry(.52,.52,.52));
 for(const geo of geometries)geo.computeBoundingBox();
 const loader=async(id,{cast}={})=>cast?geometries[0]:geometries[1];
 const lod=async(id,level)=>({geometry:geometries[level],material});
 const segments=[{a:[0,0],b:[4,0],height:1.5,width:.5,heightAt:()=>0,featureId:'control'}];
 const scene=await enhanceKunlumStoneWalls(THREE,root,[{group:root,segments}],{
  materialPromise:Promise.resolve(material),loadSection:loader,loadLOD:lod
 });
 const meshes=root.children.filter(n=>n.isInstancedMesh);
 const camera=new THREE.PerspectiveCamera(42,1,.1,1000);
 assert.equal(meshes.length,8,'2 cast variants x 4 prepared levels');
 for(const [x,expected] of [[2,0],[60,1],[100,2],[200,3]]){
  camera.position.set(x,0,0);
  assert.doesNotThrow(()=>scene.update(camera),'wall-only scenes must not require a monument');
  const counts=Array.from({length:4},(_,i)=>meshes.filter(m=>m.visible&&m.userData.kunlumLOD===i).length);
  assert.equal(counts.reduce((a,b)=>a+b,0),2,'one LOD per cast');
  assert.equal(counts[expected],2,'correct stable LOD');
 }
 const all=meshes.filter(m=>m.userData.kunlumLOD===0);
 assert.ok(all[0].count>1,'real-size cells, not stretched giant sections');
 const pos=new THREE.Vector3(),rot=new THREE.Quaternion(),scale=new THREE.Vector3(),matrix=new THREE.Matrix4();
 for(const mesh of all)for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);
  matrix.decompose(pos,rot,scale);
  assert.ok(scale.x<1.4&&scale.y<1.4&&scale.z<1.5,'approved stones cannot be inflated into giant blocks');
 }
 scene.dispose();
 material.dispose();
 geometries.forEach(g=>g.dispose());
});
