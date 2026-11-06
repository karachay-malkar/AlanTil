import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../src/vendor/three/three.module.js';
import {APPROVED_MASONRY_VARIANTS} from '../packages/tower-game/approved-prefab.mjs';
import {createApprovedSectionLoader} from '../src/features/tower/approved-section-scene.js';
import {loadBakedMasonry} from '../src/features/tower/baked-masonry.js?v=5';

const root=new URL('../',import.meta.url);
const asset='/assets/tower/approved-library/baked/section-3x3x3-v2.glb?v=2';

test('construction loads only ready models without a recipe fallback',async()=>{
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
 }finally{
  globalThis.fetch=originalFetch;
  globalThis.Request=OriginalRequest;
  if(originalProgressEvent)globalThis.ProgressEvent=originalProgressEvent;
  else delete globalThis.ProgressEvent;
 }
});
