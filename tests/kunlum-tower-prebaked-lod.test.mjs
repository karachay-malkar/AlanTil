import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three/three.module.js';
import {enhanceKunlumStoneWalls} from '../src/features/tower/kunlum-stone-facing.js';
import {createKunlumMonument} from '../src/features/tower/kunlum-monument.js';
import {kunlumBakedAssetURL} from '../src/features/tower/kunlum-prebaked-lod.js';

test('Abay-Kala uses three separate prepared 3D assets and texture atlases',()=>{
 for(let level=1;level<=3;level++){
  assert.equal(kunlumBakedAssetURL('abay-kala',level,'glb'),
   '/assets/tower/approved-library/lod-baked/lod'+level+'/abay-kala.glb');
  assert.equal(kunlumBakedAssetURL('abay-kala',level,'ktx2'),
   '/assets/tower/approved-library/lod-baked/lod'+level+'/abay-kala.ktx2');
 }
});

test('Abay-Kala picks one pre-baked LOD at a time, preserving near stone geometry',async()=>{
 const root=new THREE.Group(),monument=createKunlumMonument(THREE,{
  x:10,z:5,baseY:0,mobile:false
 });
 root.add(monument);
 const material=new THREE.MeshStandardMaterial();
 const stone=new THREE.BoxGeometry(.3,.3,.3);
 stone.computeBoundingBox();
 const geometry=new THREE.BoxGeometry(6,15.8,6);
 geometry.translate(0,7.9,0);
 geometry.computeBoundingBox();
 const available=[];
 const controller=await enhanceKunlumStoneWalls(THREE,root,[],{
  monument,materialPromise:Promise.resolve(material),distantShells:true,
  loadLibrary:async()=>({
   manifest:{models:[{name:'natural',category:'main'}]},
   geometries:new Map([['natural',stone]])
  }),
  loadLOD:async(id,level)=>{
   available.push(id+level);
   return {geometry,material};
  }
 });
 assert.deepEqual(available,['abay-kala1','abay-kala2','abay-kala3']);
 const levels=root.children.filter(m=>m.userData.kunlumTowerLOD>0);
 assert.equal(levels.length,3);
 const camera=new THREE.PerspectiveCamera(42,1,.1,3000);
 const expected=[[20,0],[120,1],[210,2],[510,3]];
 for(const [distance,tier] of expected){
  camera.position.set(10,8,5+distance);
  controller.update(camera);
  const visible=levels.filter(m=>m.visible);
  assert.equal(visible.length,tier?1:0);
  if(tier)assert.equal(visible[0].userData.kunlumTowerLOD,tier);
  assert.equal(monument.visible,tier===0);
  assert.equal(root.userData.ruinLOD.towerLOD,tier);
 }
 controller.dispose();
 stone.dispose();geometry.dispose();material.dispose();
});
