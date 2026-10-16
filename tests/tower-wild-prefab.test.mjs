import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';
import {WILD_PREFAB_VERSION,WILD_VARIANTS_PER_SIZE,WILD_PREFAB_IDS,isWildPrefab} from '../packages/tower-game/wild-prefab.mjs';
import {sectionJointProfile,JOINT_INTERFACE} from '../packages/tower-game/prefab-joints.mjs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('assets/tower/prefabs/manifest.json',root)));
const b=(kind,v,version=WILD_PREFAB_VERSION)=>({id:'test',type:'masonry_section',sectionId:kind,geometryVersion:version,variant:v,rotation:0,x:0,y:0,z:0});
test('five approved variants, old stored geometry remains accessible',()=>{
 assert.equal(WILD_VARIANTS_PER_SIZE,5);
 assert.deepEqual(WILD_PREFAB_IDS,['2x2x2','4x4x4']);
 assert.equal(manifest.version,'17.5.2');
 assert.equal(manifest.wildVersion,WILD_PREFAB_VERSION);
 for(const kind of WILD_PREFAB_IDS){
  assert.equal(manifest.wildVariants[kind].length,5);
  assert.equal(manifest.types.find(s=>s.id===kind).variants.length,3);
  for(let i=0;i<5;i++){
   assert.equal(validatePrefabPlacement([],b(kind,i)).ok,true);
   assert.equal(sectionJointProfile(b(kind,i),manifest),JOINT_INTERFACE);
  }
 }
 assert.equal(isWildPrefab('2x2x3'),false);
});
test('10 complete, distinct GLBs baked from authored stones',()=>{
 for(const kind of WILD_PREFAB_IDS){
  const hashes=new Set();
  for(const entry of manifest.wildVariants[kind]){
   const file=new URL(entry.file.slice(1),root);
   assert.ok(existsSync(file),entry.file+' absent');
   const glb=readFileSync(file);
   assert.ok(glb.length>100000);
   assert.equal(glb.toString('ascii',0,4),'glTF');
   assert.equal(glb.readUInt32LE(8),glb.length);
   hashes.add(createHash('sha256').update(glb).digest('hex'));
  }
  assert.equal(hashes.size,5);
 }
});
test('additive migration retains door and window versions',()=>{
 const sql=readFileSync(new URL('supabase/migrations/20261016135500_tower_wild_prefab_1753.sql',root),'utf8');
 assert.match(sql,/17\.5\.3/);
 assert.match(sql,/variant_id BETWEEN 0 AND 4/);
 assert.match(sql,/17\.6-door\.1/);
});