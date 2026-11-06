import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../src/vendor/three/three.module.js';
import {APPROVED_MASONRY_VARIANTS} from '../packages/tower-game/approved-prefab.mjs';
import {createApprovedSectionLoader} from '../src/features/tower/approved-section-scene.js';
import {loadBakedMasonry} from '../src/features/tower/baked-masonry.js?v=4';
import {createKunlumMapOverlay} from '../src/features/tower/kunlum-map-overlay.js';
import {makeKunlumTerrain} from '../src/features/tower/kunlum-terrain-lod.js';
import {createKunlumGameAlignment} from '../src/features/tower/kunlum-build-alignment.js';

const root=new URL('../',import.meta.url);
const asset='/assets/tower/approved-library/baked/section-3x3x3-v2.glb?v=2';

test('construction loads only ready models and the mapped fence pilot keeps its original geometry',async()=>{
 const requests=[];
 let failCast=false;
 const OriginalRequest=globalThis.Request;
 const originalFetch=globalThis.fetch;
 const originalProgressEvent=globalThis.ProgressEvent;
 globalThis.ProgressEvent=class extends Event {
  constructor(type,options){super(type);Object.assign(this,options);}
 };
 globalThis.Request=class extends OriginalRequest {
  constructor(input,options){super(new URL(input,'http://localhost'),options);}
 };
 globalThis.fetch=async input=>{
  const path=typeof input==='string'?input:new URL(input.url).pathname+new URL(input.url).search;
  requests.push(path);
  if(failCast)return new Response(null,{status:503});
  return new Response(await readFile(new URL(path.slice(1).split('?')[0],root)));
 };
 try{
  const material=new THREE.MeshStandardMaterial({side:THREE.DoubleSide});
  const loader=createApprovedSectionLoader();
  const castAsset=asset.replace('/baked/','/casts/');
  failCast=true;
  await assert.rejects(loader.make('3x3x3',1,material));
  assert.deepEqual(requests.splice(0),[castAsset],'failed asset must not trigger Common 100');
  failCast=false;
  for(const [size,ids] of Object.entries(APPROVED_MASONRY_VARIANTS)){
   for(const [variant,id] of ids.entries()){
    const before=requests.length;
    const model=await loader.make(size,variant,material);
    const cast=size!=='1x1x1';
    const directory=cast?'casts':'baked';
    const filename=id.replace('manual-','section-')+'.glb';
    assert.deepEqual(requests.slice(before),[
     '/assets/tower/approved-library/'+directory+'/'+filename+'?v=2'
    ],id);
    assert.equal(model.children.length,1);
    assert.equal(model.position.y,-Number(size.split('x')[1])*.125);
    const geometry=model.children[0].geometry;
    assert.equal(model.children[0].material,material);
    assert.ok(geometry.getAttribute('uv')&&geometry.getAttribute('uv2'),id);
    const restored=await createApprovedSectionLoader().make(size,variant,material);
    assert.equal(restored.children[0].geometry,geometry,id);
    assert.equal(requests.length,before+1,id);
    const original=await loadBakedMasonry(id);
    if(cast){
     assert.notEqual(geometry,original);
     assert.ok(geometry.index.count<original.index.count,id);
     assert.equal(geometry.index.count/3,model.userData.optimization.renderTriangles,id);
    }
    const reference=new THREE.Mesh(original);
    reference.position.y=model.position.y;
    for(let rotation=0;rotation<4;rotation++){
     model.rotation.y=reference.rotation.y=rotation*Math.PI/2;
     const actual=new THREE.Box3().setFromObject(model,true);
     const expected=new THREE.Box3().setFromObject(reference,true);
     assert.ok(actual.min.distanceTo(expected.min)<1e-6&&actual.max.distanceTo(expected.max)<1e-6,id);
    }
   }
  }
  const plan=JSON.parse(await readFile(new URL('assets/tower/environment/kunlum-vector-plan-2026-10-23.json',root)));
  const alignment=createKunlumGameAlignment({plot:plan.plot});
  const fenceGeometry=await loadBakedMasonry('manual-3x3x3-v2');
  const river=JSON.parse(await readFile(new URL('assets/tower/environment/kunlum-cherek-balkarsky-osm.json',root)));
  for(const mobile of [false,true]){
   const terrain=makeKunlumTerrain(THREE,new THREE.Group(),{mobile,plot:plan.plot,alignment});
   terrain.setRiverLine(river.points.filter(([x,z])=>Math.abs(x)<=1750&&Math.abs(z)<=1750)
    .map(point=>{const [x,z]=terrain.demToScene(...point);return {x,z};}));
   const heightAt=terrain.renderedHeightAt;
   const overlay=createKunlumMapOverlay(THREE,plan,{mobile,toWorld:alignment.planToScene,heightAt});
   const interval=overlay.segments.confirmed.find(({featureId,a,b})=>
    featureId==='V174'&&Math.hypot(b[0]-a[0],b[1]-a[1])>3.2&&Math.hypot(b[0]-a[0],b[1]-a[1])<3.25
   );
   await overlay.enhance({materialPromise:Promise.resolve(material),bakedFencePilot:true});
   const batch=overlay.root.getObjectByName('Kunlum baked fence pilot V174');
   assert.ok(batch?.isInstancedMesh);
   assert.equal(batch.count,4);
   assert.equal(batch.geometry,fenceGeometry);
   const {a,b}=interval;
   const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const axis=[(b[0]-a[0])/length,(b[1]-a[1])/length];
   const bounds=fenceGeometry.boundingBox,transform=new THREE.Matrix4();
   let previousEnd=0;
   for(let index=0;index<batch.count;index++){
    batch.getMatrixAt(index,transform);
    const projections=[];
    for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.z,bounds.max.z]){
     const point=new THREE.Vector3(x,bounds.min.y,z).applyMatrix4(transform);
     assert.ok(point.y<heightAt(point.x,point.z),'block base must follow the actual terrain');
     projections.push((point.x-a[0])*axis[0]+(point.z-a[1])*axis[1]);
    }
    const min=Math.min(...projections),max=Math.max(...projections);
    assert.ok(min>=-1e-5&&max<=length+1e-5,'block must fit the clipped wall interval');
    assert.ok(min<=previousEnd+1e-5,'adjacent envelopes must meet');
    previousEnd=max;
   }
   assert.ok(Math.abs(previousEnd-length)<1e-5);
   const normal=new THREE.Vector3(-axis[1],0,axis[0]);
   const ray=new THREE.Raycaster();
   for(let seam=1;seam<batch.count;seam++)for(const offset of [-.05,-.025,0,.025,.05]){
    const distance=length*seam/batch.count+offset;
    const x=a[0]+distance*axis[0],z=a[1]+distance*axis[1];
    for(let height=.025;height<=.45;height+=.025){
     ray.set(new THREE.Vector3(x,heightAt(x,z)+height,z).add(normal),normal.clone().negate());
     assert.ok(ray.intersectObject(batch,false).length,'continuous visible stones at seam '+seam);
    }
   }
   overlay.dispose();
  }
  assert.equal(requests.filter(path=>path===asset).length,1);
 }finally{
  globalThis.fetch=originalFetch;
  globalThis.Request=OriginalRequest;
  if(originalProgressEvent)globalThis.ProgressEvent=originalProgressEvent;
  else delete globalThis.ProgressEvent;
 }
});
