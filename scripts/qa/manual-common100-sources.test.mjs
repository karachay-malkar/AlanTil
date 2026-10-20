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
const section222Entry=index.sections.find(x=>x.id==='manual-2x2x2-v1');
const section222Raw=read('assets/tower/sections/manual-common100/section-2x2x2-v1.json');
const section222Original=JSON.parse(section222Raw);
const section222SHA=createHash('sha256').update(section222Raw).digest('hex');

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
 assert.equal(index.sections.length,7);
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
test('manual 2x2x2 v1 uses only the 11 original Common100 stone transforms',()=>{
 assert.ok(section222Entry);
 assert.equal(section222Entry.id,'manual-2x2x2-v1');
 assert.equal(section222Entry.file,'section-2x2x2-v1.json');
 assert.equal(section222Entry.title,'Секция 2×2×2');
 assert.equal(section222Entry.status,'source');
 assert.equal(section222Entry.origin,'manual-authoring');
 assert.deepEqual(section222Entry.cells,[2,2,2]);
 assert.equal(section222Entry.stoneCount,11);
 assert.deepEqual(section222Entry.counts,{large:0,main:9,chinking:2,lintel:0});
 assert.equal(section222Raw.length,4378);
 assert.equal(section222SHA,'0418a441fe08ad1316744d68fd1a66841b489cba46e55ca3b0d82047f12bd6fe');
 assert.equal(section222Entry.sha256,section222SHA);
 assert.equal(validateManualSection(section222Original,section222Entry,manifest),section222Original);
 assert.equal(new Set(section222Original.recipe.stones.map(x=>x.id)).size,11);
 assert.deepEqual(section222Original.recipe.stones.map(s=>s.name),[
  'MAIN_003','MAIN_031','MAIN_047','MAIN_043','MAIN_041',
  'MAIN_043','MAIN_057','MAIN_072','MAIN_054','CHINKING_006','CHINKING_002'
 ]);
 assert.deepEqual(section222Original.recipe.stones[1].scale,[1.411,1.511,1.661]);
 assert.deepEqual(section222Original.recipe.stones[7].scale,[1.261,1.611,1.111]);
 assert.deepEqual(section222Original.recipe.stones[9].scale,[1,1.311,1.811]);
 assert.equal(smallSHA,'63a835e7f8b036733c0898e97e39a50b3a10e192a0903696716e2ca474593c42');
 assert.equal(secondSHA,'057f24d2e310c0092ff202538fb9ff33376df4c9f2e0b14f0f42c86fe559cce1');
});
test('additional 2x2x2 v2 and 2x3x4 v1 exports are separate byte-exact recipes',()=>{
 const newlyApproved=[
  {id:'manual-2x2x2-v2',file:'section-2x2x2-v2.json',cells:[2,2,2],stones:19,
   counts:{large:2,main:9,chinking:8,lintel:0},bytes:7259,
   sha:'5af66fb4be45c51f5461e31a27d55062c0fcd1026595c12112b1738f054e1a3a'},
  {id:'manual-2x3x4-v1',file:'section-2x3x4-v1.json',cells:[2,3,4],stones:40,
   counts:{large:0,main:37,chinking:3,lintel:0},bytes:14742,
   sha:'5d4c788b1264fedf1ecc78e83b56a7685fd43d6488919299c2544d680f3b7d06'},
  {id:'manual-2x3x4-v2',file:'section-2x3x4-v2.json',cells:[2,3,4],stones:40,
   counts:{large:0,main:35,chinking:5,lintel:0},bytes:14811,
   sha:'f6933236359525f27137510f3693cf06ab581c9692ecc6d4093968c9047199f6',version:'common100-mixed-2'}
 ];
 for(const expected of newlyApproved){
  const entry=index.sections.find(x=>x.id===expected.id);
  assert.ok(entry,expected.id+' missing from index');
  const originalBytes=read('assets/tower/sections/manual-common100/'+expected.file);
  const doc=JSON.parse(originalBytes);
  assert.equal(originalBytes.length,expected.bytes);
  assert.equal(createHash('sha256').update(originalBytes).digest('hex'),expected.sha);
  assert.equal(entry.sha256,expected.sha);
  assert.equal(entry.file,expected.file);
  assert.deepEqual(entry.cells,expected.cells);
  assert.equal(entry.stoneCount,expected.stones);
  assert.deepEqual(entry.counts,expected.counts);
  assert.equal(doc.recipe.version,expected.version||'common100-manual-1');
  assert.equal(doc.recipe.stones.length,expected.stones);
  assert.deepEqual(doc.recipe.cells,expected.cells);
  assert.equal(doc.recipe.librarySha256,manifest.glbSHA256);
  assert.equal(validateManualSection(doc,entry,manifest),doc);
 }
 assert.equal(index.sections.length,7);
 assert.equal(section222Entry.stoneCount,11);
 assert.equal(section222Entry.sha256,section222SHA);
 assert.deepEqual(index.sections.slice(0,4).map(x=>x.id),[
  'manual-3x3x3-v1','manual-1x1x1-v1','manual-1x1x1-v2','manual-2x2x2-v1'
 ]);
});
test('new mixed-2 manual source may only contain independent Common100 stones',()=>{
 const added=index.sections.find(entry=>entry.id==='manual-2x3x4-v2');
 const source=JSON.parse(read('assets/tower/sections/manual-common100/'+added.file));
 assert.equal(validateManualSection(source,added,manifest),source);
 const bad=structuredClone(source);
 bad.recipe.architectures=[{id:'not-allowed',asset:'gate'}];
 assert.throws(()=>validateManualSection(bad,added,manifest),/архитектурные объекты/);
 bad.recipe.architectures=null;
 assert.throws(()=>validateManualSection(bad,added,manifest),/архитектурные объекты/);
 bad.recipe.architectures=[];
 bad.recipe.version='unrecognized';
 assert.throws(()=>validateManualSection(bad,added,manifest),/неподдерживаемый формат/);
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
 assert.match(editor,/from '\.\/manual-sections\/registry\.mjs\?v=manual-common100\.5'/);
 assert.match(editor,/listManualSections\(\{signal\}\)/);
 assert.match(editor,/loadManualSection\(t\.value\.slice\(7\),state\.library\.manifest,\{signal\}\)/);
 assert.match(editor,/status:'draft',dirty:true/);
 const towerFiles=['src/features/tower/prefab-scene.js','src/features/tower/index.js'];
 for(const f of towerFiles){
  try{const source=read(f).toString('utf8');assert.doesNotMatch(source,/manual-common100|manual-3x3x3-v1/);}
  catch(error){if(error.code!=='ENOENT')throw error;}
 }
});
