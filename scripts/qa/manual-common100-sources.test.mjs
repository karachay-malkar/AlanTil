/**
 * Validation of immutable, user-authored Common 100 recipes.
 * Run: node --test scripts/qa/manual-common100-sources.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 validateManualCatalog,validateManualSection,
 MANUAL_SECTION_SCHEMA,MANUAL_SECTION_ROOT
} from '../../src/features/masonry/manual-sections/registry.mjs';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url));
const manifest=JSON.parse(read('assets/tower/prefabs/common100/common-100.json'));
const index=JSON.parse(read('assets/tower/sections/manual-common100/index.json'));
const entry=index.sections.find(x=>x.id==='manual-3x3x3-v1');
const raw=read('assets/tower/sections/manual-common100/section-3x3x3-v1.json');
const original=JSON.parse(raw);
const exactSHA=createHash('sha256').update(raw).digest('hex');
const smallEntry=index.sections.find(x=>x.id==='manual-1x1x1-v1');
const smallRaw=read('assets/tower/sections/manual-common100/section-1x1x1-v1.json');
const smallOriginal=JSON.parse(smallRaw);
const smallSHA=createHash('sha256').update(smallRaw).digest('hex');
const secondEntry=index.sections.find(x=>x.id==='manual-1x1x1-v2');
const secondRaw=read('assets/tower/sections/manual-common100/section-1x1x1-v2.json');
const secondOriginal=JSON.parse(secondRaw);
const secondSHA=createHash('sha256').update(secondRaw).digest('hex');

test('hand-authored recipe is stored independently of legacy tower prefabs',()=>{
 assert.equal(MANUAL_SECTION_SCHEMA,'alantil.manual-common100.catalog.1');
 assert.equal(MANUAL_SECTION_ROOT,'/assets/tower/sections/manual-common100');
 assert.ok(entry);
 assert.equal(entry.file,'section-3x3x3-v1.json');
 assert.equal(entry.status,'source');
 assert.equal(entry.origin,'manual-authoring');
 assert.deepEqual(index.library,{version:manifest.version,sha256:manifest.glbSHA256,cellMeters:0.25});
 validateManualCatalog(index,manifest);
});
test('the entire user export remains byte-identical and precisely versioned',()=>{
 assert.equal(raw.length,31362);
 assert.equal(exactSHA,'3d57b58e0cb1262eeb02158952495e301d8d8afabd5eccc76b3d401ce140e48d');
 assert.equal(exactSHA,entry.sha256);
 assert.equal(entry.stoneCount,86);
 assert.deepEqual(entry.cells,[3,3,3]);
 assert.equal(original.recipe.version,'common100-manual-1');
 assert.equal(original.recipe.libraryVersion,manifest.version);
 assert.equal(original.recipe.librarySha256,manifest.glbSHA256);
 assert.equal(original.recipe.cellMeters,.25);
 assert.equal(validateManualSection(original,entry,manifest),original);
});
test('all 86 original stones are unique placements referencing only Common 100',()=>{
 const stones=original.recipe.stones;
 assert.equal(stones.length,86);
 assert.equal(new Set(stones.map(x=>x.id)).size,86);
 const names=new Set(manifest.models.map(x=>x.name));
 assert.ok(stones.every(x=>names.has(x.name)));
 const counts=stones.reduce((acc,x)=>{
  const k=manifest.models.find(m=>m.name===x.name)?.category;
  acc[k]=(acc[k]||0)+1;return acc;
 },{});
 assert.deepEqual(counts,{large:3,main:55,chinking:28});
});
test('hand-authored 1x1x1 section is preserved byte for byte',()=>{
 assert.ok(smallEntry);
 assert.equal(smallEntry.id,'manual-1x1x1-v1');
 assert.equal(smallEntry.file,'section-1x1x1-v1.json');
 assert.deepEqual(smallEntry.cells,[1,1,1]);
 assert.equal(smallEntry.stoneCount,6);
 assert.deepEqual(smallEntry.counts,{large:0,main:6,chinking:0,lintel:0});
 assert.equal(smallEntry.status,'source');
 assert.equal(smallEntry.origin,'manual-authoring');
 assert.equal(smallRaw.length,2576);
 assert.equal(smallSHA,'63a835e7f8b036733c0898e97e39a50b3a10e192a0903696716e2ca474593c42');
 assert.equal(smallSHA,smallEntry.sha256);
 assert.equal(smallOriginal.title,'Секция 1×1×1');
 assert.equal(smallOriginal.recipe.version,'common100-manual-1');
 assert.equal(smallOriginal.recipe.libraryVersion,manifest.version);
 assert.equal(smallOriginal.recipe.librarySha256,manifest.glbSHA256);
 assert.equal(smallOriginal.recipe.cellMeters,.25);
 assert.equal(validateManualSection(smallOriginal,smallEntry,manifest),smallOriginal);
 assert.equal(new Set(smallOriginal.recipe.stones.map(s=>s.id)).size,6);
 assert.deepEqual(smallOriginal.recipe.stones.map(s=>s.name),[
  'MAIN_001','MAIN_010','MAIN_028','MAIN_030','MAIN_048','MAIN_033'
 ]);
 assert.deepEqual(smallOriginal.recipe.stones[4].scale,[1,1,.6]);
 assert.deepEqual(smallOriginal.recipe.stones[5].scale,[1,1,2]);
});
test('1x1x1 v2 is independent of v1, byte exact and references genuine Common100 geometry',()=>{
 assert.ok(secondEntry);
 assert.equal(index.sections.length,3);
 assert.equal(secondEntry.file,'section-1x1x1-v2.json');
 assert.equal(secondEntry.status,'source');
 assert.equal(secondEntry.origin,'manual-authoring');
 assert.deepEqual(secondEntry.cells,[1,1,1]);
 assert.equal(secondEntry.stoneCount,8);
 assert.deepEqual(secondEntry.counts,{large:0,main:5,chinking:3,lintel:0});
 assert.equal(secondRaw.length,3345);
 assert.equal(secondSHA,'057f24d2e310c0092ff202538fb9ff33376df4c9f2e0b14f0f42c86fe559cce1');
 assert.equal(secondSHA,secondEntry.sha256);
 assert.notEqual(secondSHA,smallSHA);
 assert.equal(secondOriginal.title,'Секция 1×1×1');
 assert.equal(secondOriginal.recipe.libraryVersion,manifest.version);
 assert.equal(secondOriginal.recipe.librarySha256,manifest.glbSHA256);
 assert.equal(secondOriginal.recipe.cellMeters,.25);
 assert.equal(validateManualSection(secondOriginal,secondEntry,manifest),secondOriginal);
 const stones=secondOriginal.recipe.stones;
 assert.equal(new Set(stones.map(s=>s.id)).size,8);
 assert.deepEqual(stones.map(s=>s.name),[
  'MAIN_008','MAIN_009','MAIN_032','CHINKING_006',
  'CHINKING_008','CHINKING_003','MAIN_007','MAIN_028'
 ]);
 assert.deepEqual(stones[1].scale,[.861,.461,.761]);
 assert.deepEqual(stones[7].scale,[.811,1.311,.611]);
 assert.equal(smallRaw.length,2576);
 assert.equal(smallSHA,'63a835e7f8b036733c0898e97e39a50b3a10e192a0903696716e2ca474593c42');
});
test('every registered manual section matches its original file and checksum',()=>{
 validateManualCatalog(index,manifest);
 for(const entry of index.sections){
  const originalBytes=read('assets/tower/sections/manual-common100/'+entry.file);
  assert.equal(createHash('sha256').update(originalBytes).digest('hex'),entry.sha256);
  assert.equal(validateManualSection(JSON.parse(originalBytes),entry,manifest).recipe.stones.length,entry.stoneCount);
 }
});
test('catalog rejects identity collision and path traversal',()=>{
 const catalog=structuredClone(index);
 catalog.sections.push({...catalog.sections[0]});
 assert.throws(()=>validateManualCatalog(catalog,manifest),/ID/);
 catalog.sections.pop();
 catalog.sections[0].file='../prefabs/manifest.json';
 assert.throws(()=>validateManualCatalog(catalog,manifest),/имя файла/);
});
test('recipe validation rejects new geometry, invalid orientation or altered library',()=>{
 const modified=structuredClone(original);
 modified.recipe.stones[0].name='GENERATED_FAKE_STONE';
 assert.throws(()=>validateManualSection(modified,entry,manifest),/неизвестная/);
 modified.recipe.stones[0].name=original.recipe.stones[0].name;
 modified.recipe.stones[0].quaternion=[0,0,0,0];
 assert.throws(()=>validateManualSection(modified,entry,manifest),/кватернион/);
 modified.recipe.stones[0].quaternion=[...original.recipe.stones[0].quaternion];
 modified.recipe.librarySha256='0'.repeat(64);
 assert.throws(()=>validateManualSection(modified,entry,manifest),/другую библиотеку/);
});
test('manual source is imported only in the authoring editor, not live gameplay',()=>{
 const editor=read('src/features/masonry/index.js').toString('utf8');
 assert.match(editor,/from '\.\/manual-sections\/registry\.mjs\?v=manual-common100\.2'/);
 assert.match(editor,/listManualSections\(\{signal\}\)/);
 assert.match(editor,/loadManualSection\(t\.value\.slice\(7\),state\.library\.manifest,\{signal\}\)/);
 assert.match(editor,/status:'draft',dirty:true/);
 const towerFiles=['src/features/tower/prefab-scene.js','src/features/tower/index.js'];
 for(const f of towerFiles){
  try{const source=read(f).toString('utf8');assert.doesNotMatch(source,/manual-common100|manual-3x3x3-v1/);}
  catch(error){if(error.code!=='ENOENT')throw error;}
 }
});
