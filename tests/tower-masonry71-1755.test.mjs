import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prefabBounds,validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';
import {sectionJointProfile,JOINT_INTERFACE} from '../packages/tower-game/prefab-joints.mjs';
import {MASONRY71_VERSION,MASONRY71_SIZES,MASONRY71_VARIANTS,isMasonry71} from '../packages/tower-game/masonry-71-prefab.mjs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('assets/tower/prefabs/manifest.json',root)));
test('latest 71-rock section set has five sizes and five variants without losing history',()=>{
 assert.equal(MASONRY71_VERSION,'17.5.5');
 assert.equal(MASONRY71_VARIANTS,5);
 assert.equal(manifest.version,'17.5.2');
 assert.equal(manifest.wildVersion,'17.5.3');
 assert.equal(manifest.gateStoneVersion,'17.5.4');
 assert.equal(manifest.masonry71Version,'17.5.5');
 assert.deepEqual(MASONRY71_SIZES,['1x1x1','2x2x2','2x2x3','2x3x4','4x4x4']);
 for(const size of MASONRY71_SIZES){
  assert.equal(manifest.masonry71Variants[size].length,5);
  for(let variant=0;variant<5;variant++){
   const s={id:'test',type:'masonry_section',sectionId:size,variant,rotation:0,x:0,y:0,z:0,geometryVersion:MASONRY71_VERSION};
   assert.equal(validatePrefabPlacement([],s).ok,true);
   assert.equal(sectionJointProfile(s,manifest),JOINT_INTERFACE);
  }
 }
 assert.equal(isMasonry71('door-7x9x2'),false);
});
test('exact 25 unique complete full-resolution GLB assets are included',()=>{
 const hashes=new Set();
 for(const size of MASONRY71_SIZES)for(const info of manifest.masonry71Variants[size]){
  const file=new URL(info.file.slice(1),root);
  assert.ok(existsSync(file),info.file+' is not included');
  const data=readFileSync(file);
  assert.equal(data.toString('ascii',0,4),'glTF');
  assert.equal(data.readUInt32LE(8),data.length);
  assert.ok(data.length>100000,'No lightweight preview may be used for game models');
  hashes.add(createHash('sha256').update(data).digest('hex'));
  const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString('utf8'));
  assert.ok(gltf.meshes.length>=1);
  assert.ok(gltf.materials.some(x=>x.name==='ALANTIL_ROCK_FACE_02_SHARED'));
  assert.ok(gltf.meshes.every(x=>x.primitives.every(p=>gltf.accessors[p.attributes.POSITION].count>=3)));
 }
 assert.equal(hashes.size,25);
});
test('17.5.5 database migration preserves 17.5.4 and architectural elements',()=>{
 const sql=readFileSync(new URL('supabase/migrations/20261016213700_tower_masonry71_1755.sql',root),'utf8');
 for(const v of ['17.5.5','17.5.4','17.5.3','17.6-window.1','17.6-door.1','17.6-gate.1'])
  assert.ok(sql.includes(v),v);
 assert.match(sql,/variant_id BETWEEN 0 AND 4/);
});
