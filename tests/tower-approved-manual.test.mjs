/** New build catalog points to ten immutable recipes; old towers retain old renderers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 APPROVED_PREFAB_VERSION,APPROVED_MASONRY_TYPES,APPROVED_MASONRY_VARIANTS,
 approvedVariantCount,approvedSectionId,isApprovedMasonryType
} from '../packages/tower-game/approved-prefab.mjs';
import {
 PREFAB_TYPES,BUILDABLE_PREFAB_TYPES,validatePrefabPlacement,prefabBounds
} from '../packages/tower-game/prefab-layout.mjs';
import {resolvePrefabJoints,JOINT_INTERFACE,sectionJointProfile} from '../packages/tower-game/prefab-joints.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=JSON.parse(read('assets/tower/approved-library/index.json'));
const legacy=JSON.parse(read('assets/tower/prefabs/manifest.json'));
const game=read('src/features/tower/index.js'),scene=read('src/features/tower/prefab-scene.js');
const migration=read('supabase/migrations/20261020122921_tower_approved_manual_masonry_v1.sql');
const types=['1x1x1','2x2x2','2x3x4','3x3x3'];
const dims={ '1x1x1':[1,1,1], '2x2x2':[2,2,2], '2x3x4':[2,3,4], '3x3x3':[3,3,3] };
const count={ '1x1x1':2, '2x2x2':3, '2x3x4':3, '3x3x3':2 };
const block=(id,variant,rotation)=>({
 id:'00000000-0000-4000-8000-000000000001',
 type:'masonry_section',sectionId:id,variant,rotation,
 geometryVersion:APPROVED_PREFAB_VERSION,x:0,y:0,z:0
});

test('only four author-built masonry types plus three architectural elements are buildable',()=>{
 assert.deepEqual(APPROVED_MASONRY_TYPES,types);
 assert.deepEqual(BUILDABLE_PREFAB_TYPES.map(t=>t.id),
  [...types,'window-4x5x2','door-7x9x2','gate-18x10x2']);
 assert.equal(PREFAB_TYPES.length,9,'older types remain for legacy towers and validation');
 assert.ok(PREFAB_TYPES.some(t=>t.id==='2x2x3'));
 assert.ok(PREFAB_TYPES.some(t=>t.id==='4x4x4'));
 assert.doesNotMatch(game,/catalog\.innerHTML=PREFAB_TYPES\.map/);
 assert.match(game,/catalog\.innerHTML=BUILDABLE_PREFAB_TYPES\.map/);
 assert.match(game,/APPROVED_PREFAB_VERSION/);
 assert.doesNotMatch(game,/isWildPrefab\(s\.type\)|isGateStone\(s\.type\)/);
});

test('all ten approved recipes have stable gameplay slots, bounds, rotated placement and support',()=>{
 assert.equal(APPROVED_PREFAB_VERSION,'17.7-approved-manual.1');
 for(const type of types){
  assert.equal(approvedVariantCount(type),count[type]);
  assert.equal(isApprovedMasonryType(type),true);
  const sourceIds=catalog.sections.filter(s=>s.id.startsWith('manual-'+type+'-')).map(s=>s.id);
  assert.deepEqual(sourceIds,APPROVED_MASONRY_VARIANTS[type]);
  for(let variant=0;variant<count[type];variant++)for(let rotation=0;rotation<4;rotation++){
   const current=block(type,variant,rotation);
   assert.equal(approvedSectionId(type,variant),sourceIds[variant]);
   const result=validatePrefabPlacement([],current);
   assert.equal(result.ok,true,JSON.stringify({type,variant,rotation,result}));
   const b=prefabBounds(current);
   const [w,h,d]=dims[type];
   assert.deepEqual(b.size,rotation%2?[d,h,w]:[w,h,d]);
   assert.equal(sectionJointProfile(current,legacy),JOINT_INTERFACE);
  }
  assert.throws(()=>approvedSectionId(type,count[type]),/Unknown approved/);
 }
 assert.equal(approvedVariantCount('2x2x3'),0);
 assert.equal(isApprovedMasonryType('4x4x4'),false);
});

test('the archive is read-only in the catalog, but old saved blocks remain routable',()=>{
 const historical=[
  block('2x2x3',0,0),
  block('4x4x4',2,1),
  block('2x2x2',4,3)
 ];
 const versions=['17.5.2','17.5.3','17.5.5'];
 historical.forEach((entry,i)=>{
  entry.geometryVersion=versions[i];
  assert.equal(validatePrefabPlacement([],entry).ok,true);
 });
 assert.match(scene,/manifest\.historicVariants/);
 assert.match(scene,/COMPACT_STONE_VERSION/);
 assert.match(scene,/WILD_PREFAB_VERSION/);
 assert.match(scene,/GATE_STONE_VERSION/);
 assert.match(scene,/approvedSections\.make/);
 assert.match(scene,/createApprovedSectionLoader/);
 assert.match(migration,/WHEN '3x3x3' THEN ARRAY\[3,3,3\]/);
 assert.match(migration,/tower_v3_approved_variant_check/);
 assert.match(migration,/17\.7-approved-manual\.1/);
 const main=read('src/features/tower/repository.js');
 assert.match(main,/mutateTowerV3/);
 assert.doesNotMatch(main,/DELETE FROM|truncate/i);
});

test('saved architectural versions and openings are unchanged',()=>{
 const {architecture}=catalog;
 for(const [key,version] of [['gate','17.6-gate.1'],['door','17.6-door.1'],['window','17.6-window.1']]){
  assert.equal(architecture[key].version,version);
 }
 const gate=read('packages/tower-game/gate-prefab.mjs');
 const window=read('packages/tower-game/window-prefab.mjs');
 const door=read('packages/tower-game/door-prefab.mjs');
 assert.match(gate,/GATE_PREFAB_VERSION='17\.6-gate\.1'/);
 assert.match(door,/DOOR_PREFAB_VERSION='17\.6-door\.1'/);
 assert.match(window,/WINDOW_PREFAB_VERSION='17\.6-window\.1'/);
 for(const src of [gate,door,window])assert.match(src,/\/assets\/tower\/approved-library\/architecture\//);
 const first=block('2x2x2',0,0);
 const second={...block('2x3x4',0,0),id:'00000000-0000-4000-8000-000000000002',x:2};
 assert.equal(resolvePrefabJoints([first,second],legacy).incompatible.length,0);
});
