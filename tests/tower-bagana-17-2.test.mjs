import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILDABLE_PREFAB_TYPES,prefabBounds,validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';
import {validateSectionJoints,resolvePrefabJoints} from '../packages/tower-game/prefab-joints.mjs';
import {BAGANA_PREFAB_ID,BAGANA_PREFAB_VERSION,BAGANA_PREFAB_FILE} from '../packages/tower-game/bagana-prefab.mjs';
import {WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION} from '../packages/tower-game/window-prefab.mjs';

const entry=(id,sectionId,geometryVersion,x=0,y=0,z=0)=>({id,type:'masonry_section',sectionId,geometryVersion,variant:0,rotation:0,x,y,z});
const post=entry('bagana',BAGANA_PREFAB_ID,BAGANA_PREFAB_VERSION);
const windowSection=entry('window',WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION,2,0,0);
const manifest={version:'17.7-approved-manual.1'};
test('bagana is an approved single-variant 0.5×2.5×0.5m buildable item',()=>{
 assert.deepEqual(BUILDABLE_PREFAB_TYPES.at(-1),{id:BAGANA_PREFAB_ID,size:[2,10,2]});
 assert.deepEqual(prefabBounds(post).size,[2,10,2]);
 assert.equal(validatePrefabPlacement([],post).ok,true);
 assert.equal(validatePrefabPlacement([post],entry('other',BAGANA_PREFAB_ID,BAGANA_PREFAB_VERSION)).ok,false);
});
test('wooden post can touch masonry without creating rubble or seam errors',()=>{
 const result=resolvePrefabJoints([post,windowSection],manifest);
 assert.equal(result.ok,true);
 assert.equal(result.joints.length,0);
 assert.equal(result.incompatible.length,0);
 assert.equal(validateSectionJoints([post],windowSection,manifest).ok,true);
});
test('approved bagana glb contains genuine 3D mesh geometry',()=>{
 const bytes=readFileSync(new URL('..'+BAGANA_PREFAB_FILE,import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const size=bytes.readUInt32LE(12);
 const model=JSON.parse(bytes.subarray(20,20+size).toString('utf8').trim());
 assert.ok(model.meshes[0].primitives[0].attributes.POSITION!==undefined);
 assert.ok(model.accessors[0].count>100);
 assert.ok(model.materials[0].pbrMetallicRoughness.roughnessFactor>=.8);
});
test('catalog and server migration preserve IDs while adding Alan terminology',()=>{
 const client=readFileSync(new URL('../src/features/tower/index.js',import.meta.url),'utf8');
 const migration=readFileSync(new URL('../supabase/migrations/20261028123000_tower_bagana_172.sql',import.meta.url),'utf8');
 for(const name of ['къабыргъа','къабакъла','эшик','Терезе','багъана'])assert.ok(client.includes(name),name);
 assert.ok(client.includes("s.type===BAGANA_PREFAB_ID?BAGANA_PREFAB_VERSION"));
 assert.ok(migration.includes("WHEN typ='bagana-2x10x2'"));
 assert.ok(migration.includes("WHEN 'bagana-2x10x2' THEN ARRAY[2,10,2]"));
 for(const old of ['window-4x5x2','door-7x9x2','gate-18x10x2'])assert.ok(migration.includes(old));
});
