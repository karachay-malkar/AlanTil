/** The approved library is the sole asset source for tower and masonry editor. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateManualCatalog,validateManualSection} from '../../src/features/masonry/manual-sections/registry.mjs';
const base=new URL('../../',import.meta.url);
const read=p=>readFileSync(new URL(p,base));
const root='assets/tower/approved-library/';
const source=JSON.parse(read(root+'common100/common-100.json'));
const index=JSON.parse(read(root+'index.json'));
const sha=b=>createHash('sha256').update(b).digest('hex');
function glb(path){
 const bytes=read(path);
 assert.equal(bytes.toString('ascii',0,4),'glTF',path);
 assert.equal(bytes.readUInt32LE(8),bytes.length,path);
 assert.ok(bytes.length>1000,path);
}
test('only one approved Common100 catalog with ten authored section recipes',()=>{
 assert.equal(index.sections.length,10);
 assert.equal(new Set(index.sections.map(s=>s.id)).size,10);
 assert.deepEqual(index.currentConstruction.masonryTypes,['1x1x1','2x2x2','2x3x4','3x3x3']);
 assert.deepEqual(Object.keys(index.architecture),['gate','door','window']);
 assert.equal(index.archivedSources,undefined);
 assert.equal(validateManualCatalog(index,source),index);
 assert.equal(source.count,100);
 assert.equal(source.models.length,100);
 glb(root+'common100/common-100.glb');
});
test('all ten JSONs match SHA-256, original Common100 model names and counts',()=>{
 for(const entry of index.sections){
  const bytes=read(root+'sections/'+entry.file);
  assert.equal(sha(bytes),entry.sha256,entry.id);
  const document=JSON.parse(bytes);
  assert.equal(validateManualSection(document,entry,source),document);
  assert.equal(document.recipe.stones.length,entry.stoneCount);
  assert.equal(new Set(document.recipe.stones.map(s=>s.id)).size,entry.stoneCount);
 }
});
test('complete GLB architecture: gate, door, window and seam elements',()=>{
 const {architecture}=index;
 const arch=name=>root+'architecture/'+name.split('/').at(-1);
 glb(arch(architecture.gate.glb));
 for(const kind of ['door','window']){
  for(const part of ['stone','wood'])glb(arch(architecture[kind][part]));
 }
 for(const file of Object.values(architecture.window.joints))glb(arch(file));
 assert.deepEqual(architecture.gate.cells,[18,10,2]);
 assert.deepEqual(architecture.door.cells,[7,9,2]);
 assert.deepEqual(architecture.window.cells,[4,5,2]);
});
