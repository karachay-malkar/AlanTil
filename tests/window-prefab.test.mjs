import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {PREFAB_TYPES,prefabBounds,validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';
import {WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION,WINDOW_PREFAB_FILE} from '../packages/tower-game/window-prefab.mjs';
import {resolvePrefabJoints,validateSectionJoints} from '../packages/tower-game/prefab-joints.mjs';
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
 assert.equal(out.ok,true);assert.equal(out.joints.length,0);assert.equal(out.incompatible.length,0);
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
