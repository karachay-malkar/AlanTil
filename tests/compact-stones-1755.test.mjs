import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMPACT_STONE_VERSION,COMPACT_STONE_TYPES,COMPACT_STONE_VARIANTS,validateCompactStoneRecipe} from '../packages/tower-game/compact-stone-prefab.mjs';
import {sectionJointProfile,JOINT_INTERFACE} from '../packages/tower-game/prefab-joints.mjs';
import {PREFAB_TYPES,validatePrefabPlacement} from '../packages/tower-game/prefab-layout.mjs';
const fromRoot=path=>new URL('../'+path,import.meta.url);
const pack=JSON.parse(readFileSync(fromRoot('assets/tower/prefabs/balkar71/placements-17_5_5.json'),'utf8'));
const glb=readFileSync(fromRoot('assets/tower/prefabs/balkar71/library-wall-17_5_5.glb'));
const manifest=JSON.parse(readFileSync(fromRoot('assets/tower/prefabs/manifest.json'),'utf8'));
test('17.5.5 compact assets are complete and preserve old catalog',()=>{
 assert.equal(COMPACT_STONE_VERSION,'17.5.5');
 assert.equal(COMPACT_STONE_VARIANTS,5);
 assert.equal(manifest.compactStoneVersion,COMPACT_STONE_VERSION);
 assert.equal(manifest.compactStone.version,COMPACT_STONE_VERSION);
 assert.equal(manifest.version,'17.5.2');
 assert.equal(manifest.gateStoneVersion,'17.5.4');
 assert.equal(manifest.wildVersion,'17.5.3');
 assert.equal(manifest.compactStone.library,'/assets/tower/prefabs/balkar71/library-wall-17_5_5.glb');
 assert.equal(manifest.compactStone.placements,'/assets/tower/prefabs/balkar71/placements-17_5_5.json');
 assert.equal(pack.version,COMPACT_STONE_VERSION);
 assert.equal(pack.shapes.length,63);
 assert.equal(glb.toString('ascii',0,4),'glTF');
 assert.equal(glb.readUInt32LE(8),glb.length);
 const sourceJSONLength=glb.readUInt32LE(12);
 const gltf=JSON.parse(glb.toString('utf8',20,20+sourceJSONLength));
 assert.equal(gltf.meshes.length,63);
 assert.deepEqual(new Set(gltf.meshes.map(m=>m.name)),new Set(pack.shapes));
 assert.equal(pack.totalPlacements,913);
});
test('25 placement recipes: 5 variations per type, valid transforms, no lintel shapes',()=>{
 let placed=0;
 for(const sectionId of COMPACT_STONE_TYPES){
  assert.ok(PREFAB_TYPES.some(t=>t.id===sectionId));
  assert.equal(pack.variants[sectionId].length,5);
  const unique=new Set();
  for(let variant=0;variant<5;variant++){
   const recipe=validateCompactStoneRecipe(pack,sectionId,variant);
   assert.ok(recipe.placement.length>0);
   placed+=recipe.placement.length;
   unique.add(JSON.stringify(recipe.placement));
   for(const shape of recipe.placement){
    assert.ok(!/^([AB])_/.test(shape[0]));
    assert.equal(shape.length,13);
    assert.ok(shape.slice(1).every(Number.isFinite));
   }
   const block={id:'00000000-0000-4000-8000-000000000001',type:'masonry_section',sectionId,variant,rotation:0,x:0,y:0,z:0,geometryVersion:COMPACT_STONE_VERSION};
   assert.ok(validatePrefabPlacement([],block).ok);
   assert.equal(sectionJointProfile(block,manifest),JOINT_INTERFACE);
  }
  assert.equal(unique.size,5);
 }
 assert.equal(placed,913);
 assert.equal(pack.variants['1x1x1'][0].placement.length,1);
 assert.throws(()=>validateCompactStoneRecipe(pack,'4x4x4',5));
 assert.throws(()=>validateCompactStoneRecipe(pack,'gate-18x10x2',0));
});
test('old model versions and server validation preserved',()=>{
 const scene=readFileSync(fromRoot('src/features/tower/prefab-scene.js'),'utf8');
 const editor=readFileSync(fromRoot('src/features/tower/index.js'),'utf8');
 const migration=readFileSync(fromRoot('supabase/migrations/20261017000000_tower_compact_stones_1755.sql'),'utf8');
 assert.ok(scene.includes("if(isGateStone(block.sectionId)&&block.geometryVersion===GATE_STONE_VERSION)"));
 assert.ok(scene.includes("if(isCompactStone(block.sectionId)&&block.geometryVersion===COMPACT_STONE_VERSION)"));
 assert.ok(editor.includes('isGateStone(s.type)?COMPACT_STONE_VERSION'));
 for(const version of ['17.5.0','17.5.1','17.5.2','17.5.3','17.5.4','17.5.5','17.6-window.1','17.6-door.1','17.6-gate.1'])
  assert.ok(migration.includes(version),version);
});
