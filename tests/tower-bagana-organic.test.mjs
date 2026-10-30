import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BAGANA_PREFABS} from '../packages/tower-game/bagana-prefab.mjs';
import {sculptBaganaGlb} from '../tools/tower/bagana-organic-mesh.mjs';

// The original smooth f2/f3 posts measured 0.019–0.023m radial variation.
// True carved wood must be visibly irregular in the 3D vertex positions.
function ringGeometry(bytes){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),jsonLength=dv.getUint32(12,true);
 const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8').trim());
 const acc=gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
 const view=gltf.bufferViews[acc.bufferView],offset=20+jsonLength+8+view.byteOffset+(acc.byteOffset||0);
 const coords=[];
 for(let i=0;i<acc.count;i++){
  const x=dv.getFloat32(offset+i*12,true),y=dv.getFloat32(offset+i*12+4,true),z=dv.getFloat32(offset+i*12+8,true);
  assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z));
  if(Math.abs(y)<.11&&Math.hypot(x,z)>.06)coords.push({x,y,z});
 }
 assert.ok(coords.length>20);
 const target=coords.reduce((p,c)=>Math.abs(c.y)<Math.abs(p.y)?c:p).y;
 const ring=coords.filter(c=>Math.abs(c.y-target)<.007);
 assert.ok(ring.length>=20);
 const cx=ring.reduce((s,c)=>s+c.x,0)/ring.length;
 const cz=ring.reduce((s,c)=>s+c.z,0)/ring.length;
 const radii=ring.map(c=>Math.hypot(c.x-cx,c.z-cz));
 return {gltf,range:Math.max(...radii)-Math.min(...radii)};
}

test('all 15 approved Bagana models use irregular baked timber meshes',()=>{
 assert.equal(BAGANA_PREFABS.length,15);
 for(const spec of BAGANA_PREFABS){
  const bytes=readFileSync(new URL('..'+spec.file,import.meta.url));
  const {gltf,range}=ringGeometry(bytes);
  assert.match(gltf.asset.generator,/timber v5/,'versioned organic mesh: '+spec.id);
  assert.match(gltf.asset.generator,/original Common100 LARGE_00[569]/);
  assert.equal(gltf.meshes.length,2,'stone stays a separate geometry');
  if(spec.form!==1)assert.ok(range>.040, spec.id+' remained cylindrical: '+range.toFixed(4));
  else assert.ok(range>.055,spec.id+' fork lost natural trunk asymmetry: '+range.toFixed(4));
  assert.ok(range<.16,'damage is excessive: '+spec.id);
 }
});
test('bake is one-time only; it cannot silently deform a post twice',()=>{
 const spec=BAGANA_PREFABS[0],bytes=Buffer.from(readFileSync(new URL('..'+spec.file,import.meta.url)));
 assert.throws(()=>sculptBaganaGlb(bytes,{form:spec.form,woodCells:spec.woodCells}),/unbaked Bagana timber/);
});
