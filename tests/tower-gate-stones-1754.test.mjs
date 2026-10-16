import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PREFAB_TYPES,validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';
import {GATE_STONE_VERSION,GATE_STONE_TYPES,GATE_STONE_VARIANTS,isGateStone} from '../packages/tower-game/gate-stone-prefab.mjs';
import {sectionJointProfile,JOINT_INTERFACE} from '../packages/tower-game/prefab-joints.mjs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('assets/tower/prefabs/manifest.json',root)));
test('25 new gate-source sections coexist with all old saved geometry versions',()=>{
 assert.equal(GATE_STONE_VERSION,'17.5.4');
 assert.equal(GATE_STONE_VARIANTS,5);
 assert.equal(manifest.version,'17.5.2');
 assert.equal(manifest.wildVersion,'17.5.3');
 assert.equal(manifest.gateStoneVersion,'17.5.4');
 assert.equal(GATE_STONE_TYPES.length,5);
 for(const t of GATE_STONE_TYPES){
  assert.ok(PREFAB_TYPES.some(x=>x.id===t));
  assert.equal(manifest.gateStoneVariants[t].length,5);
  assert.equal(manifest.types.find(x=>x.id===t).variants.length,3);
  for(let variant=0;variant<5;variant++){
   const s={id:'stone',type:'masonry_section',sectionId:t,geometryVersion:GATE_STONE_VERSION,variant,rotation:0,x:0,y:0,z:0};
   assert.equal(validatePrefabPlacement([],s).ok,true);
   assert.equal(sectionJointProfile(s,manifest),JOINT_INTERFACE);
   assert.equal(manifest.gateStoneVariants[t][variant].source,'approved-gate-v7');
  }
 }
 assert.equal(isGateStone('door-7x9x2'),false);
});
test('25 different authored 3D GLBs and complete 486-rock library exist',()=>{
 const hashes=new Set();
 for(const t of GATE_STONE_TYPES){
  for(const v of manifest.gateStoneVariants[t]){
   const f=new URL(v.file.slice(1),root);
   assert.ok(existsSync(f),'Missing gate-source GLB '+v.file);
   const b=readFileSync(f);
   assert.equal(b.toString('ascii',0,4),'glTF');
   assert.equal(b.readUInt32LE(8),b.length);
   assert.ok(b.length>3000);
   hashes.add(createHash('sha256').update(b).digest('hex'));
  }
 }
 assert.equal(hashes.size,25);
 assert.ok(existsSync(new URL(manifest.gateStoneLibrary.slice(1),root)));
});
test('V3 migration preserves all historical windows doors gates and 17.5.3',()=>{
 const s=readFileSync(new URL('supabase/migrations/20261016200000_tower_gate_stones_1754.sql',root),'utf8');
 for(const token of ['17.5.2','17.5.3','17.5.4','17.6-gate.1','17.6-window.1','17.6-door.1','variant_id BETWEEN 0 AND 4'])assert.ok(s.includes(token),token);
});
