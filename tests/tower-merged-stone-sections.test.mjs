import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three/three.module.js';
import {mergeApprovedStoneMeshes} from '../src/features/tower/approved-section-geometry.js';

const material=new THREE.MeshStandardMaterial({color:0xb7a78b});
function section(...stones){
 const root=new THREE.Group();
 for(const [size,x,y,z] of stones){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  mesh.position.set(x,y,z);
  root.add(mesh);
 }
 return root;
}
const faces=geometry=>geometry.getAttribute('position').count/3;
const compareBox=(before,after)=>{
 for(const axis of ['x','y','z']){
  assert.ok(Math.abs(before.min[axis]-after.min[axis])<1e-5,'min '+axis);
  assert.ok(Math.abs(before.max[axis]-after.max[axis])<1e-5,'max '+axis);
 }
};

test('two disjoint stones become one real mesh with complete exterior and UVs',()=>{
 const root=section([[1,1,1],0,0,0],[[1,1,1],1.3,0,0]);
 const original=new THREE.Box3().setFromObject(root);
 const result=mergeApprovedStoneMeshes(root);
 assert.equal(result.stats.sourceMeshes,2);
 assert.equal(result.stats.sourceTriangles,24);
 assert.equal(result.stats.trimmedTriangles,0);
 assert.equal(faces(result.geometry),24);
 assert.ok(result.geometry.getAttribute('normal'));
 assert.ok(result.geometry.getAttribute('uv'));
 assert.ok(result.geometry.getAttribute('uv2'));
 const scene=new THREE.Group();scene.add(new THREE.Mesh(result.geometry,material));
 compareBox(original,new THREE.Box3().setFromObject(scene));
 result.geometry.dispose();
});

test('a stone entirely buried inside a closed stone disappears without touching outer faces',()=>{
 const root=section([[2,2,2],0,0,0],[[.2,.2,.2],0,0,0]);
 const outer=faces(root.children[0].geometry),before=new THREE.Box3().setFromObject(root);
 const result=mergeApprovedStoneMeshes(root);
 assert.equal(outer,12);
 assert.equal(result.stats.sourceTriangles,24);
 assert.equal(result.stats.trimmedTriangles,12,'all buried inner stone triangles are removed');
 assert.equal(faces(result.geometry),12,'exterior facets are unchanged');
 compareBox(before,new THREE.Box3().setFromObject(new THREE.Mesh(result.geometry,material)));
 assert.equal(root.children.length,2,'editable source remains intact');
 result.geometry.dispose();
});

test('a visible stone through a gap must not be removed',()=>{
 const root=section([[1,1,1],0,0,0],[[1,1,1],1.01,0,0]);
 const result=mergeApprovedStoneMeshes(root);
 assert.equal(result.stats.trimmedTriangles,0);
 assert.equal(faces(result.geometry),24);
 result.geometry.dispose();
});

test('baked transforms preserve nonuniform scale, rotation and parent offset',()=>{
 const root=section([[1,.4,.8],0,0,0],[[.8,.7,.6],2,0,0]);
 root.children[1].rotation.y=.42;
 root.children[1].scale.set(1.3,.85,.9);
 root.position.y=-.375;
 const before=new THREE.Box3().setFromObject(root);
 const result=mergeApprovedStoneMeshes(root);
 assert.equal(faces(result.geometry),24);
 const output=new THREE.Group();output.position.copy(root.position);
 output.add(new THREE.Mesh(result.geometry,material));
 compareBox(before,new THREE.Box3().setFromObject(output));
 assert.equal(root.children.length,2,'source transforms are not modified');
 result.geometry.dispose();
});

test('a section with 86 stones merges to one mesh and retains every visible facet',()=>{
 const stones=Array.from({length:86},(_,i)=>[[.21,.21,.21],(i%10)*.3,Math.floor(i/100)*.3,Math.floor(i/10)*.3]);
 const source=section(...stones);
 const result=mergeApprovedStoneMeshes(source);
 assert.equal(result.stats.sourceMeshes,86);
 assert.equal(faces(result.geometry),86*12);
 assert.equal(result.stats.trimmedTriangles,0);
 result.geometry.dispose();
});
