/** Exact approved source library audit. Does not rewrite user meshes or old tower assets. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateManualCatalog,validateManualSection} from '../../src/features/masonry/manual-sections/registry.mjs';
const base=new URL('../../',import.meta.url);
const read=p=>readFileSync(new URL(p,base));
const root='assets/tower/approved-library/';
const manifest=JSON.parse(read(root+'common100/common-100.json'));
const index=JSON.parse(read(root+'index.json'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const binary=(p,legacy)=>{
 const original=read(legacy),actual=read(root+p);
 assert.deepEqual(actual,original,p+' should be exact old GLB bytes');
 assert.equal(actual.toString('ascii',0,4),'glTF');
 assert.equal(actual.readUInt32LE(8),actual.length);
 return actual;
};

test('single immutable index includes exactly 10 author-authored sections and all three openings',()=>{
 assert.equal(index.version,'17.7-approved-masonry.1');
 assert.equal(index.sections.length,10);
 assert.equal(new Set(index.sections.map(s=>s.id)).size,10);
 assert.deepEqual(index.currentConstruction.masonryTypes,['1x1x1','2x2x2','2x3x4','3x3x3']);
 assert.equal(index.currentConstruction.legacyMasonryHidden,true);
 assert.deepEqual(Object.keys(index.architecture),['gate','door','window']);
 assert.equal(validateManualCatalog(index,manifest),index);
 assert.deepEqual(index.library,{version:manifest.version,sha256:manifest.glbSHA256,cellMeters:.25,
  glb:'/assets/tower/approved-library/common100/common-100.glb',
  file:'/assets/tower/approved-library/common100/common-100.json'});
});

test('all ten user JSON documents are byte exact and refer to original Common100 models',()=>{
 const legacy='assets/tower/sections/manual-common100/';
 const groups={};
 for(const item of index.sections){
  const file=read(root+'sections/'+item.file);
  assert.equal(sha(file),item.sha256,item.id+' content hash');
  const old=legacy+item.file;
  if(!['manual-2x2x2-v3','manual-3x3x3-v2'].includes(item.id)){
   assert.deepEqual(file,read(old),item.id+' exact original byte equality');
  }
  const doc=JSON.parse(file);
  assert.equal(validateManualSection(doc,item,manifest),doc);
  assert.equal(new Set(doc.recipe.stones.map(s=>s.id)).size,item.stoneCount);
  groups[item.id.match(/manual-(.+)-v\d+/)[1]]??=[];
  groups[item.id.match(/manual-(.+)-v\d+/)[1]].push(item.stoneCount);
  assert.equal(doc.recipe.architectures?.length??0,0);
 }
 assert.deepEqual(groups,{
  '1x1x1':[6,8],
  '2x2x2':[11,19,15],
  '2x3x4':[40,40,28],
  '3x3x3':[86,23]
 });
 const originals=read(root+'common100/common-100.glb');
 assert.deepEqual(originals,read('assets/tower/prefabs/common100/common-100.glb'));
});

test('architectural GLBs are full original binaries, old sources remain readable',()=>{
 const a=index.architecture;
 const name=fn=>fn.split('/').at(-1);
 binary('architecture/'+name(a.gate.glb),'assets/tower/prefabs/architectural/gate-18x10x2-v9.glb');
 for(const key of ['door','window']){
  for(const face of ['stone','wood']){
   binary('architecture/'+name(a[key][face]),'assets/tower/prefabs/architectural/'+name(a[key][face]));
  }
 }
 for(const [axis,filename] of Object.entries(a.window.joints))binary('architecture/'+name(filename),'assets/tower/prefabs/architectural/'+name(filename));
 assert.deepEqual(a.gate.cells,[18,10,2]);
 assert.deepEqual(a.door.cells,[7,9,2]);
 assert.deepEqual(a.window.cells,[4,5,2]);
 assert.equal(JSON.parse(read('assets/tower/prefabs/manifest.json')).version,'17.5.2');
});
