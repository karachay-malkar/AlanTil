import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {prefabBounds,validatePrefabPlacement,PREFAB_TYPES} from '../packages/tower-game/prefab-layout.mjs';
import {DOOR_PREFAB_ID,DOOR_PREFAB_VERSION,DOOR_STONE_FILE,DOOR_WOOD_FILE} from '../packages/tower-game/door-prefab.mjs';
import {resolvePrefabJoints,stoneAtJoint,validateSectionJoints} from '../packages/tower-game/prefab-joints.mjs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('assets/tower/prefabs/manifest.json',root)));
const door=(id='d',x=0,y=0,z=0,rotation=0)=>({id,type:'masonry_section',sectionId:DOOR_PREFAB_ID,
 geometryVersion:DOOR_PREFAB_VERSION,variant:0,rotation,x,y,z});
const wall=(id='w',type='2x2x2',x=7,y=0,z=0)=>({id,type:'masonry_section',sectionId:type,
 geometryVersion:manifest.version,variant:0,rotation:0,x,y,z});
test('door is a new 7x9x2 grid prefab with four orientations, no legacy rewrites',()=>{
 assert.equal(PREFAB_TYPES.find(p=>p.id===DOOR_PREFAB_ID).size[0],7);
 assert.deepEqual(prefabBounds(door()).size,[7,9,2]);
 assert.deepEqual(prefabBounds(door('d',0,0,0,1)).size,[2,9,7]);
 for(let r=0;r<4;r++)assert.equal(validatePrefabPlacement([],door('d',0,0,0,r)).ok,true);
 assert.equal(validatePrefabPlacement([], {...door(),variant:1},{maxVariants:1}).ok,false);
});
test('door stone mask excludes three by eight cell opening at all yaw angles',()=>{
 for(let r=0;r<4;r++){
  const d=door('d',0,0,0,r),b=prefabBounds(d);
  assert.equal(stoneAtJoint(d,[b.min[0]+.5,8.5,b.min[2]+.5]),true);
  // Map authored local x=3.5 and y=4.5 to world space.
  const th=r*Math.PI/2,dx=0,dz=0;
  const p=[(b.min[0]+b.max[0])/2+dx*Math.cos(th)+dz*Math.sin(th),4.5,
   (b.min[2]+b.max[2])/2-dx*Math.sin(th)+dz*Math.cos(th)];
  assert.equal(stoneAtJoint(d,p),false);
  assert.equal(stoneAtJoint(d,[p[0],8.5,p[2]]),true);
 }
});
test('door joins adjacent stone piers but not across the opening',()=>{
 const d=door();
 const side=wall('side');
 let result=resolvePrefabJoints([d,side],manifest);
 assert.equal(result.ok,true);assert.equal(result.joints.length,4);
 assert.equal(validateSectionJoints([side],d,manifest).ok,true);
 const front=wall('front','4x4x4',0,0,2);
 result=resolvePrefabJoints([d,front],manifest);
 assert.equal(result.ok,true);assert.equal(result.joints.length,8);
 assert.ok(result.joints.every(j=>stoneAtJoint(d,j.point)));
});
test('door join filtering works with a 90 degree turn and a horizontal support',()=>{
 const d=door('rot',0,0,0,1),other=wall('side','2x2x2',2,0,0);
 const horizontal=resolvePrefabJoints([d,other],manifest);
 assert.equal(horizontal.ok,true);assert.equal(horizontal.joints.length,4);
 const elevated=door('raised',0,4,0),base=wall('foundation','4x4x4',0,0,0);
 const vertical=resolvePrefabJoints([base,elevated],manifest);
 assert.equal(vertical.ok,true);
 assert.equal(vertical.joints.filter(j=>j.axis==='y').length,4);
 assert.ok(vertical.joints.every(j=>stoneAtJoint(elevated,j.point)));
});
test('door models and converted source photographs are complete files',()=>{
 for(const file of [DOOR_STONE_FILE,DOOR_WOOD_FILE]){
  const b=readFileSync(new URL(file.slice(1),root));
  assert.ok(b.length>1000000);assert.equal(b.toString('ascii',0,4),'glTF');
  assert.equal(b.readUInt32LE(8),b.length);
 }
 for(const file of ['rock-face-02-colour.jpg','rock-face-02-normal.jpg','rock-face-02-roughness.jpg']){
  const uri=new URL(`assets/tower/materials/rock-face-02/${file}`,root);
  assert.ok(existsSync(uri));assert.ok(readFileSync(uri).length>20000);
 }
 const sql=readFileSync(new URL('supabase/migrations/20261015221000_tower_door_prefab_176.sql',root),'utf8');
 assert.match(sql,/WHEN 'door-7x9x2'/);assert.match(sql,/17\.6-door\.1/);
});
