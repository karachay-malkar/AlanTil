/** Active tower only: eleven approved recipes, three stone openings and one timber support. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APPROVED_PREFAB_VERSION,APPROVED_MASONRY_TYPES,APPROVED_MASONRY_VARIANTS,approvedSectionId,approvedVariantCount} from '../packages/tower-game/approved-prefab.mjs';
import {PREFAB_TYPES,BUILDABLE_PREFAB_TYPES,validatePrefabPlacement,prefabBounds} from '../packages/tower-game/prefab-layout.mjs';
import {BAGANA_PREFABS} from '../packages/tower-game/bagana-prefab.mjs';
import {resolvePrefabJoints,JOINT_INTERFACE,sectionJointProfile} from '../packages/tower-game/prefab-joints.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=JSON.parse(read('assets/tower/approved-library/index.json'));
const types=['1x1x1','2x2x2','2x3x4','3x3x3'];
const count={'1x1x1':3,'2x2x2':3,'2x3x4':3,'3x3x3':2};
const block=(id,variant=0,rotation=0,version=APPROVED_PREFAB_VERSION)=>({
 id:'00000000-0000-4000-8000-000000000001',type:'masonry_section',
 sectionId:id,variant,rotation,geometryVersion:version,x:0,y:0,z:0
});
test('tower catalog contains exclusively current supported sections',()=>{
 assert.deepEqual(APPROVED_MASONRY_TYPES,types);
 assert.deepEqual(BUILDABLE_PREFAB_TYPES.map(x=>x.id),[...types,'window-4x5x2','door-7x9x2','gate-18x10x2','bagana-2x10x2',...BAGANA_PREFABS.map(b=>b.id)]);
 assert.equal(PREFAB_TYPES.length,23);
 assert.equal(catalog.sections.length,11);
 assert.equal(catalog.archivedSources,undefined);
 const ui=read('src/features/tower/index.js');
 const scene=read('src/features/tower/prefab-scene.js');
 const repo=read('src/features/tower/repository.js');
 assert.doesNotMatch(ui,/loadHistoric|importHistoricDrafts|loadTowerV2|legacyRevision/);
 assert.doesNotMatch(scene,/assets\/tower\/prefabs|historicItem|COMPACT_STONE_VERSION|WILD_PREFAB_VERSION/);
 assert.doesNotMatch(repo,/mutateTowerV2|loadTowerV2|clearTowerAll/);
 assert.match(scene,/approvedSections\.make/);
 assert.match(repo,/clearTowerV3/);
});
test('eleven immutable recipes map to valid placement in all rotations',()=>{
 for(const type of types){
  assert.equal(approvedVariantCount(type),count[type]);
  const ids=catalog.sections.filter(x=>x.id.startsWith('manual-'+type+'-')).map(x=>x.id);
  assert.deepEqual(APPROVED_MASONRY_VARIANTS[type],ids);
  for(let variant=0;variant<count[type];variant++)for(let rotation=0;rotation<4;rotation++){
   const entry=block(type,variant,rotation);
   assert.equal(approvedSectionId(type,variant),ids[variant]);
   assert.equal(validatePrefabPlacement([],entry).ok,true);
   assert.equal(sectionJointProfile(entry,{version:APPROVED_PREFAB_VERSION}),JOINT_INTERFACE);
  }
 }
});
test('historical tower formats and variants cannot reenter construction',()=>{
 for(const b of [block('4x4x4'),block('2x2x3'),block('2x2x2',4),block('1x1x1',0,0,'17.5.5')]){
  assert.equal(validatePrefabPlacement([],b).ok,false);
 }
});
test('rotations, touching faces, and approved window joint assets work',()=>{
 const a=block('2x2x2');const b={...block('2x3x4'),id:'00000000-0000-4000-8000-000000000002',x:2};
 const joints=resolvePrefabJoints([a,b],{version:APPROVED_PREFAB_VERSION});
 assert.equal(joints.ok,true);
 assert.ok(joints.joints.length>0);
 assert.ok(joints.joints.every(j=>j.file.startsWith('/assets/tower/approved-library/architecture/')));
 const rotated=block('2x3x4',0,1);
 assert.deepEqual(prefabBounds(rotated).size,[4,3,2]);
});
