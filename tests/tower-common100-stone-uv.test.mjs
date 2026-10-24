import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three/three.module.js';
import {readFileSync} from 'node:fs';
import {getApprovedStoneSurfaceGeometry} from '../src/features/tower/rock-surface.js';

function sample(geometry){
 const positions=geometry.getAttribute('position'),uvs=geometry.getAttribute('uv');
 return [...Array(3)].map((_,i)=>({
  p:[positions.getX(i),positions.getY(i),positions.getZ(i)],
  uv:[uvs.getX(i),uvs.getY(i)]
 }));
}
function fixture(){
 // A broad, visible upper triangular face (normal Y), plus a side
 // triangle (normal X) sharing two indices: a single UV projection
 // cannot represent both without smearing a texture across one face.
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([
  0,0,0, 1,0,0, 1,0,1, 0,1,0
 ],3));
 g.setAttribute('normal',new THREE.Float32BufferAttribute([
  0,1,0, 0,1,0, 0,1,0, 0,1,0
 ],3));
 g.setIndex([0,1,2,0,2,3]);
 return g;
}
const uvDist=(a,b)=>Math.hypot(a.uv[0]-b.uv[0],a.uv[1]-b.uv[1]);
test('projection separates shared GLB vertices by triangle and preserves all triangle geometry',()=>{
 const src=fixture();
 const before=src.getAttribute('position').array.slice();
 const projected=getApprovedStoneSurfaceGeometry(src,[1,1,1]);
 assert.equal(src.getIndex().count,6,'authored index untouched');
 assert.equal(src.getAttribute('uv'),undefined,'source geometry is immutable');
 assert.deepEqual(Array.from(src.getAttribute('position').array),Array.from(before));
 assert.equal(projected.getIndex(),null,'UV seams require triangle-local vertices');
 assert.equal(projected.getAttribute('position').count,6);
 assert.equal(projected.getAttribute('uv').count,6);
 assert.equal(projected.getAttribute('uv2').count,6);
 const u=projected.getAttribute('uv');
 for(let i=0;i<u.count;i++)assert.ok(Number.isFinite(u.getX(i))&&Number.isFinite(u.getY(i)));
 // The face on X must not inherit the UV projection from the Y-facing triangle.
 assert.notDeepEqual([u.getX(2),u.getY(2)],[u.getX(4),u.getY(4)]);
});
test('PBR UVs remain metric under non-uniform stone scaling; originals are not modified',()=>{
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([
  0,0,0, 1,0,0, 0,0,1
 ],3));
 // 2x X and 0.5x Z: rendered physical edge lengths 2m and .5m.
 const a=getApprovedStoneSurfaceGeometry(g,[2,1,.5]);
 const b=getApprovedStoneSurfaceGeometry(g,[1,1,1]);
 const first=sample(a);
 assert.ok(Math.abs(uvDist(first[0],first[1])-6.3)<.0001,'2m world edge = 6.3 UV repeats');
 assert.ok(Math.abs(uvDist(first[0],first[2])-1.575)<.0001,'0.5m edge = 1.575 UV repeats');
 assert.notStrictEqual(a,b,'different sizes must not share wrong UVs');
 assert.strictEqual(a,getApprovedStoneSurfaceGeometry(g,[2,1,.5]),'same mesh+scale cached');
 assert.strictEqual(b,getApprovedStoneSurfaceGeometry(g,[1,1,1]),'uniform cache reused');
});
test('new approved sections use corrected UVs but preserve original recipe transforms',()=>{
 const src=readFileSync(new URL('../src/features/tower/approved-section-scene.js',import.meta.url),'utf8');
 assert.match(src,/getApprovedStoneSurfaceGeometry\(original,entry\.scale\)/);
 assert.match(src,/mesh\.position\.fromArray\(entry\.position\)/);
 assert.match(src,/mesh\.quaternion\.fromArray\(entry\.quaternion\)/);
 assert.match(src,/mesh\.scale\.fromArray\(entry\.scale\)/);
});
