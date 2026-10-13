import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const manifest=()=>JSON.parse(readFileSync(new URL('assets/tower/prefabs/manifest.json',root),'utf8'));
test('immutable 17.5 prefab library offers eight variants of five accepted sizes',()=>{
 const m=manifest();
 assert.equal(m.version,'17.5.0');assert.equal(m.legacyVersion,'17.4.1');
 assert.equal(m.cellMeters,.25);assert.equal(m.authoredModels,36);
 assert.deepEqual(m.types.map(e=>e.size),[[1,1,1],[2,2,2],[2,2,3],[2,3,4],[4,4,4]]);
 for(const type of m.types){
  assert.equal(type.variants.length,8);
  assert.equal(type.jointInterface,m.jointInterface);
  assert.equal(m.legacyVariants[type.id].length,4);
  for(const legacy of m.legacyVariants[type.id])assert.ok(existsSync(new URL(legacy.slice(1),root)));
  for(const variant of type.variants){
   assert.match(variant.file,/^\/assets\/tower\/prefabs\/[a-z0-9_-]+\.glb$/);
   const path=new URL(variant.file.slice(1),root);
   assert.ok(existsSync(path));assert.ok(statSync(path).size>200);
   assert.ok(variant.rocks>=1);
   assert.ok(variant.sourceModels.every(n=>Number.isInteger(n)&&n>=1&&n<=36));
  }
 }
});
test('off-line seam assets are built for x,y,z and right-angle corners',()=>{
 const m=manifest();assert.deepEqual(Object.keys(m.connectors).sort(),['corner','x','y','z']);
 for(const info of Object.values(m.connectors)){
  assert.ok(existsSync(new URL(info.file.slice(1),root)));
  assert.equal(info.interface,m.jointInterface);
 }
});
test('live editor only loads prefabs; no runtime packing or wallet mutations',()=>{
 const src=readFileSync(new URL('src/features/tower/index.js',root),'utf8');
 assert.match(src,/prefab-scene\.js/);
 assert.doesNotMatch(src,/stone-placement-v2-worker|section-masonry-worker|masonry-packing|solveMasonryLayout|mutateTowerV2/);
});