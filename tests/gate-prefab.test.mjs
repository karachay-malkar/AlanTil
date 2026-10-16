import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {prefabBounds,validatePrefabPlacement,PREFAB_TYPES} from '../packages/tower-game/prefab-layout.mjs';
import {GATE_PREFAB_ID,GATE_PREFAB_VERSION,GATE_PREFAB_FILE} from '../packages/tower-game/gate-prefab.mjs';
import {stoneAtJoint,resolvePrefabJoints} from '../packages/tower-game/prefab-joints.mjs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('assets/tower/prefabs/manifest.json',root)));
const gate=(rotation=0)=>({id:'g',type:'masonry_section',sectionId:GATE_PREFAB_ID,geometryVersion:GATE_PREFAB_VERSION,variant:0,rotation,x:0,y:0,z:0});
test('gate 18x10x2 fits 25cm grid at all yaw angles',()=>{
 assert.deepEqual(PREFAB_TYPES.find(t=>t.id===GATE_PREFAB_ID).size,[18,10,2]);
 for(let r=0;r<4;r++){
  const g=gate(r);
  assert.deepEqual(prefabBounds(g).size,r%2?[2,10,18]:[18,10,2]);
  assert.equal(validatePrefabPlacement([],g).ok,true);
 }
 assert.equal(validatePrefabPlacement([],{...gate(),variant:1},{maxVariants:1}).ok,false);
});
test('all four orientations keep central opening empty of stone-joint infill',()=>{
 for(let rotation=0;rotation<4;rotation++){
  const g=gate(rotation),b=prefabBounds(g),x=(b.min[0]+b.max[0])/2,z=(b.min[2]+b.max[2])/2;
  for(const y of [.5,4.5,8.5,9.5])assert.equal(stoneAtJoint(g,[x,y,z]),false);
  assert.equal(stoneAtJoint(g,[b.min[0]+.5,9.5,b.min[2]+.5]),true);
 }
});
test('gate joins adjacent masonry',()=>{
 const neighbor={id:'w',type:'masonry_section',sectionId:'2x2x2',geometryVersion:manifest.version,variant:0,rotation:0,x:18,y:0,z:0};
 const res=resolvePrefabJoints([gate(),neighbor],manifest);
 assert.equal(res.ok,true);assert.ok(res.joints.length>0);
});
test('approved full v7 GLB is present and binary complete',{skip:!existsSync(new URL(GATE_PREFAB_FILE.slice(1),root))},()=>{
 const file=new URL(GATE_PREFAB_FILE.slice(1),root);
 assert.ok(existsSync(file),'Gate model missing: approved GLB must be uploaded before release');
 const glb=readFileSync(file);
 assert.equal(glb.toString('ascii',0,4),'glTF');
 assert.equal(glb.readUInt32LE(8),glb.length);
 assert.ok(glb.length>5000000);
});
test('additive migration keeps historic door and wild masonry versions',()=>{
 const file=new URL('supabase/migrations/20261016181500_tower_gate_prefab_176.sql',root);
 const s=readFileSync(file,'utf8');
 for(const marker of ['gate-18x10x2','17.6-gate.1','17.5.3','17.6-door.1','17.6-window.1'])
  assert.ok(s.includes(marker),marker);
});
