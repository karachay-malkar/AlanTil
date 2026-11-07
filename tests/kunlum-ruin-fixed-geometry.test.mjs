import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../src/vendor/three/three.module.js';
import {createKunlumMapOverlay} from '../src/features/tower/kunlum-map-overlay.js';
import {createKunlumGameAlignment} from '../src/features/tower/kunlum-build-alignment.js';

const read=path=>readFile(new URL('../'+path,import.meta.url));
test('mapped cast LODs keep every approved segment and each opening remains physical',async()=>{
 const plan=JSON.parse(await read('assets/tower/environment/kunlum-vector-plan-2026-10-23.json'));
 const alignment=createKunlumGameAlignment({plot:plan.plot});
 const overlay=createKunlumMapOverlay(THREE,plan,{
  toWorld:alignment.planToScene,heightAt:(x,z)=>x*.01+z*.005
 });
 const material=new THREE.MeshStandardMaterial();
 const geometry=new THREE.BoxGeometry(.52,.52,.52);
 geometry.computeBoundingBox();
 const result=await overlay.enhance({
  materialPromise:Promise.resolve(material),
  loadSection:async()=>geometry,
  loadLOD:async()=>({geometry,material})
 });
 const segments=[...overlay.segments.confirmed,...overlay.segments.candidates];
 assert.equal(result.segments,segments.length);
 assert.equal(overlay.counters.linkedOpenings,42);
 assert.ok(result.blocks>segments.length,'natural-scale masonry uses multiple small casts per interval');
 const meshes=[...overlay.confirmed.children,...overlay.candidates.children]
  .filter(x=>x.isInstancedMesh);
 assert.ok(meshes.length>0);
 assert.deepEqual([...new Set(meshes.map(x=>x.userData.kunlumLOD))].sort(),[0,1,2,3]);
 const camera=new THREE.PerspectiveCamera(42,1,.1,20000);
 camera.position.set(0,0,0);result.update(camera);
 const active=meshes.filter(x=>x.visible);
 assert.ok(active.length>0);
 assert.ok(active.every(m=>m.userData.kunlumLOD===0||m.userData.kunlumLOD>0));
 assert.equal(result.blocks,overlay.root.userData.bakedFenceBlocks);
 overlay.dispose();material.dispose();geometry.dispose();
});
