import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../src/vendor/three/three.module.js';
import {GLTFLoader} from '../src/vendor/three/addons/loaders/GLTFLoader.js';
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

test('bagana loads through the production Three.js GLTFLoader, with correct world bounds',async()=>{
 const bytes=readFileSync(new URL('..'+BAGANA_PREFAB_FILE,import.meta.url));
 const payload=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const result=await new Promise((resolve,reject)=>new GLTFLoader().parse(payload,'',resolve,reject));
 const box=new THREE.Box3().setFromObject(result.scene),size=box.getSize(new THREE.Vector3());
 assert.equal(result.scene.children.length>0,true);
 assert.ok(size.x>.3&&size.x<.5);
 assert.ok(Math.abs(size.y-2.5)<.01);
 assert.ok(size.z>.3&&size.z<.5);
 assert.ok(result.scene.getObjectByName('BAGANA_CARVED_WOOD_SUPPORT'));
});

test('tower and masonry release no longer share stale 17.2.35 cache keys',()=>{
 const release=JSON.parse(readFileSync(new URL('../release.json',import.meta.url)));
 const sw=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
 const router=readFileSync(new URL('../src/app/router.js',import.meta.url),'utf8');
 const scene=readFileSync(new URL('../src/features/tower/index.js',import.meta.url),'utf8');
 const masonry=readFileSync(new URL('../src/features/masonry/architecture-assets.js',import.meta.url),'utf8');
 assert.notEqual(release.version,'17.2.35');
 assert.ok(sw.includes('const VERSION = "'+release.version+'"'));
 assert.ok(router.includes('const TOWER_ASSET_VERSION = "'+release.version+'"'));
 assert.ok(router.includes('const MASONRY_ASSET_VERSION = "'+release.version+'"'));
 assert.ok(scene.includes('prefab-scene.js?v='+release.version));
 for(const name of ['къабакъла','эшик','Терезе']) assert.ok(masonry.includes(name),name);
});
