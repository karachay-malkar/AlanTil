import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {PREFAB_TYPES,prefabBounds,validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';
import {WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION,WINDOW_PREFAB_FILE,WINDOW_WOOD_FILE,WINDOW_JOINT_FILES} from '../packages/tower-game/window-prefab.mjs';
import {resolvePrefabJoints,validateSectionJoints,windowStoneAtJoint} from '../packages/tower-game/prefab-joints.mjs';
const root=new URL('../',import.meta.url);
const win=(id,x=0,y=0,z=0)=>({id,type:'masonry_section',sectionId:WINDOW_PREFAB_ID,
 geometryVersion:WINDOW_PREFAB_VERSION,variant:0,rotation:0,x,y,z});
test('window is a vertical 4x5x2 prefab on the 25cm editor grid',()=>{
 assert.deepEqual(PREFAB_TYPES.find(x=>x.id===WINDOW_PREFAB_ID).size,[4,5,2]);
 assert.deepEqual(prefabBounds(win('w')).size,[4,5,2]);
 assert.deepEqual(prefabBounds({...win('w'),rotation:1}).size,[2,5,4]);
 assert.equal(validatePrefabPlacement([],win('w')).ok,true);
});
test('no baked joint may fill the window aperture',()=>{
 const m=JSON.parse(readFileSync(new URL('assets/tower/prefabs/manifest.json',root)));
 const other={id:'b',type:'masonry_section',sectionId:'2x2x2',geometryVersion:m.version,
  x:4,y:0,z:0,variant:0,rotation:0};
 const out=resolvePrefabJoints([win('w'),other],m);
 assert.equal(out.ok,true);assert.equal(out.joints.length,4);assert.equal(out.incompatible.length,0);
 assert.equal(validateSectionJoints([other],win('w'),m).ok,true);
});
test('window asset is actual GLB',()=>{
 const p=new URL(WINDOW_PREFAB_FILE.slice(1),root);
 assert.ok(existsSync(p));
 const b=readFileSync(p);
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(8),b.length);
 assert.ok(b.length>100000);
});

test('window joint tiles close the stone piers, never the central 0.5x1m aperture',()=>{
 const m=JSON.parse(readFileSync(new URL('assets/tower/prefabs/manifest.json',root)));
 const front={id:'front',type:'masonry_section',sectionId:'4x4x4',geometryVersion:m.version,
  x:0,y:0,z:2,variant:0,rotation:0};
 const r=resolvePrefabJoints([win('w'),front],m);
 assert.equal(r.ok,true);
 assert.equal(r.joints.length,8);
 assert.ok(r.joints.every(j=>j.file===WINDOW_JOINT_FILES.z));
 assert.ok(r.joints.every(j=>windowStoneAtJoint(win('w'),j.point)));
 assert.equal(windowStoneAtJoint(win('w'),[1.5,1.5,2]),false);
 assert.equal(windowStoneAtJoint(win('w'),[2.5,3.5,2]),false);
 assert.equal(windowStoneAtJoint(win('w'),[.5,1.5,2]),true);
 assert.equal(windowStoneAtJoint(win('w'),[2.5,4.5,2]),true);
});
test('rotation 90 degrees and bottom sill respect empty aperture',()=>{
 const m=JSON.parse(readFileSync(new URL('assets/tower/prefabs/manifest.json',root)));
 const rotated={...win('w'),rotation:1};
 const wall={id:'wall',type:'masonry_section',sectionId:'4x4x4',geometryVersion:m.version,
  x:2,y:0,z:0,rotation:0,variant:0};
 const horizontal=resolvePrefabJoints([rotated,wall],m);
 assert.equal(horizontal.ok,true);
 assert.equal(horizontal.joints.length,8);
 assert.ok(horizontal.joints.every(j=>j.file===WINDOW_JOINT_FILES.x));
 const base={...wall,id:'base',x:0,y:0,z:0};
 const elevated=win('upper',0,4,0);
 const vertical=resolvePrefabJoints([base,elevated],m);
 assert.equal(vertical.ok,true);
 assert.equal(vertical.joints.filter(j=>j.axis==='y').length,4);
 assert.ok(vertical.joints.every(j=>windowStoneAtJoint(elevated,j.point)));
});
test('wood PBR model and four authored-rock window joiners are baked',()=>{
 const wood=readFileSync(new URL(WINDOW_WOOD_FILE.slice(1),root));
 assert.equal(wood.toString('ascii',0,4),'glTF');
 assert.equal(wood.readUInt32LE(8),wood.length);
 assert.ok(wood.length>1000000);
 for(const uri of Object.values(WINDOW_JOINT_FILES)){
  const asset=readFileSync(new URL(uri.slice(1),root));
  assert.equal(asset.toString('ascii',0,4),'glTF');
  assert.equal(asset.readUInt32LE(8),asset.length);
  assert.ok(asset.length>20000);
 }
});
