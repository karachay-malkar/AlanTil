import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../src/vendor/three/three.module.js';
import {createKunlumMapOverlay} from '../src/features/tower/kunlum-map-overlay.js';
import {createKunlumGameAlignment} from '../src/features/tower/kunlum-build-alignment.js';

const read=path=>readFile(new URL('../'+path,import.meta.url));

test('all mapped fence intervals use matching near and far casts without recipes',async()=>{
 const OriginalRequest=globalThis.Request,originalFetch=globalThis.fetch;
 const originalProgressEvent=globalThis.ProgressEvent;
 const requested=[];
 globalThis.Request=class extends OriginalRequest {
  constructor(url,options){super(new URL(url,'http://localhost'),options);}
 };
 globalThis.ProgressEvent=class extends Event {
  constructor(type,options){super(type);Object.assign(this,options);}
 };
 globalThis.fetch=async request=>{
  const path=new URL(request.url).pathname;
  requested.push(path);
  return new Response(await read(path.slice(1)));
 };
 try{
  const plan=JSON.parse(await read('assets/tower/environment/kunlum-vector-plan-2026-10-23.json'));
  const alignment=createKunlumGameAlignment({plot:plan.plot});
  const overlay=createKunlumMapOverlay(THREE,plan,{toWorld:alignment.planToScene,heightAt:(x,z)=>x*.01+z*.005});
  const material=new THREE.MeshStandardMaterial();
  const result=await overlay.enhance({materialPromise:Promise.resolve(material)});
  const expected=[...overlay.segments.confirmed,...overlay.segments.candidates];
  assert.equal(result.segments,expected.length);
  assert.equal(result.blocks,expected.reduce((n,{a,b})=>n+Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/1.35),0));
  assert.equal(requested.length,4);
  assert.ok(requested.every(p=>/\/(casts|fence-lod)\/.+\.glb$/.test(p)));
  const meshes=[];
  for(const layer of [overlay.confirmed,overlay.candidates]){
   const batch=layer.children.filter(m=>m.isInstancedMesh);
   assert.ok(batch.length>0);
   meshes.push(...batch);
  }
  const triangleCount=(mesh)=>mesh.geometry.index.count/3*mesh.count;
  for(let i=0;i<meshes.length;i+=2){
   const near=meshes[i],far=meshes[i+1];
   assert.ok(triangleCount(far)<triangleCount(near)*.6);
   assert.deepEqual(near.instanceMatrix.array,far.instanceMatrix.array);
   assert.ok(near.geometry.boundingBox.min.distanceTo(far.geometry.boundingBox.min)<1e-5);
   assert.ok(near.geometry.boundingBox.max.distanceTo(far.geometry.boundingBox.max)<1e-5);
  }
  const near=meshes[0],far=meshes[1],p=near.boundingSphere.center.clone();
  result.update({position:p});
  assert.equal(near.visible,true);
  const shader={vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};
  const farShader={...shader};
  near.material.onBeforeCompile(shader);
  far.material.onBeforeCompile(farShader);
  assert.match(shader.fragmentShader,/threshold < fade/);
  assert.match(farShader.fragmentShader,/threshold >= fade/);
  result.update({position:p.clone().addScalar(10000)});
  assert.ok(meshes.every((m,i)=>m.visible===Boolean(i%2)));
  const total=offset=>meshes.filter((_,i)=>i%2===offset).reduce((n,m)=>n+triangleCount(m),0);
  console.log(JSON.stringify({segments:result.segments,blocks:result.blocks,nearTriangles:total(0),farTriangles:total(1)}));
  overlay.dispose();
  material.dispose();
 }finally{
  globalThis.Request=OriginalRequest;
  globalThis.fetch=originalFetch;
  if(originalProgressEvent)globalThis.ProgressEvent=originalProgressEvent;
  else delete globalThis.ProgressEvent;
 }
});
