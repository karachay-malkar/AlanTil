import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three/three.module.js';
import {createKunlumGrassGeometry,createKunlumShrubGeometry,createKunlumWillowGeometry,
 createKunlumVegetation,installKunlumGrassWind}
 from '../src/features/tower/kunlum-vegetation.js';
import {kunlumRng} from '../src/features/tower/kunlum-terrain-scatter.js';
import {kunlumMeadowPatch} from '../src/features/tower/kunlum-game-landscape.js';

test('eight individually shaped 3D grass clumps have bent segmented blades',()=>{
 const signatures=[];
 for(let v=0;v<8;v++){
  const g=createKunlumGrassGeometry(THREE,v);
  const p=g.getAttribute('position');
  assert.ok(p.count>=72,'each grass clump has multiple three-dimensional blades');
  assert.ok(g.getAttribute('normal'));
  signatures.push(Array.from(p.array.slice(0,36)).join(','));
  g.dispose();
 }
 assert.equal(new Set(signatures).size,8);
});

test('rosehip, barberry and sea-buckthorn retain distinct 3D silhouettes',()=>{
 const signatures=[];
 for(const species of ['rosehip','barberry','seabuckthorn']){
  for(let variant=0;variant<2;variant++){
   const geo=createKunlumShrubGeometry(THREE,species,variant);
   assert.ok(geo.getAttribute('position').count>90);
   assert.equal(geo.getAttribute('color').count,geo.getAttribute('position').count);
   signatures.push(geo.getAttribute('position').count);
   geo.dispose();
  }
 }
 assert.equal(new Set(signatures).size>=2,true);
});

test('willows are branched meshes with vertex-coloured leaves',()=>{
 for(let v=0;v<3;v++){
  const geo=createKunlumWillowGeometry(THREE,v);
  assert.ok(geo.getAttribute('position').count>300);
  assert.equal(geo.getAttribute('color').count,geo.getAttribute('position').count);
  geo.dispose();
 }
});

test('instancing protects building parcel, limits riparian willows and disposes resources',()=>{
 const random=kunlumRng(123456);
 const make=createKunlumVegetation(THREE,()=>0,{
  rng:random,range:170,riverDistanceAt:(x)=>Math.abs(x-50),
  excludedBounds:{minX:0,maxX:15,minZ:0,maxZ:30},
  budgets:{grass:120,shrub:36,willow:9}
 });
 assert.equal(make.counts.grass,120);
 assert.equal(make.counts.shrub,36);
 assert.ok(make.counts.willow>0,'willow should be planted within river corridor');
 assert.equal(make.batches.length,17,'8 grasses, 6 shrubs, 3 willow mesh batches');
 for(const mesh of make.batches){
  assert.ok(mesh.isInstancedMesh);
  const mat=new THREE.Matrix4();
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,mat);
   const x=mat.elements[12],z=mat.elements[14];
   const clearance=mesh.userData.vegetationKind==='grass'?1.5:
    mesh.userData.vegetationKind==='shrub'?5:11;
   assert.equal(x>=-clearance&&x<=15+clearance&&z>=-clearance&&z<=30+clearance,false);
   if(mesh.userData.vegetationKind==='willow'){
    assert.ok(Math.abs(x-50)>10&&Math.abs(x-50)<105);
   }
  }
 }
 make.update(4,{position:{y:1500}});
 assert.equal(make.batches[0].visible,false);
 make.update(6,{position:{y:1.7}});
 assert.equal(make.batches[0].visible,true);
 make.dispose();
});

test('grass wind modifies leaf tips in the instanced shader, not placement state',()=>{
 const material=new THREE.MeshStandardMaterial();
 const time=installKunlumGrassWind(material);
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>'};
 material.onBeforeCompile(shader);
 assert.equal(shader.uniforms.uKunlumWind,time);
 assert.match(shader.vertexShader,/instanceMatrix\[3\]/);
 assert.match(shader.vertexShader,/position\.y/);
 material.dispose();
});

test('ground cover varies smoothly by metre-scale location rather than repeating mesh tiles',()=>{
 const near=kunlumMeadowPatch(15,28),next=kunlumMeadowPatch(16,28);
 assert.ok(Math.abs(near-next)<.1);
 assert.ok(Math.abs(near-kunlumMeadowPatch(120,240))>.05);
 assert.equal(kunlumMeadowPatch(15,28),near);
});
