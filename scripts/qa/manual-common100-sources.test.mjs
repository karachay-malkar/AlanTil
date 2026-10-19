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
 assert.match(editor,/from '\.\/manual-sections\/registry\.mjs\?v=manual-common100\.1'/);
 assert.match(editor,/listManualSections\(\{signal\}\)/);
 assert.match(editor,/loadManualSection\(t\.value\.slice\(7\),state\.library\.manifest,\{signal\}\)/);
 assert.match(editor,/status:'draft',dirty:true/);
 const towerFiles=['src/features/tower/prefab-scene.js','src/features/tower/index.js'];
 for(const f of towerFiles){
  try{const source=read(f).toString('utf8');assert.doesNotMatch(source,/manual-common100|manual-3x3x3-v1/);}
  catch(error){if(error.code!=='ENOENT')throw error;}
 }
});
