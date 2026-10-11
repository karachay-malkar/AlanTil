import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROCK_PACK,ROCK_SOURCES} from '../assets/tower/processed-rocks.mjs';
import {CATALOG,encodeTower,decodeTower,validatePlacement} from '../packages/tower-game/core.mjs';

test('processed rock variants are present for all four build categories',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(ROCK_PACK).map(([category,entries])=>[category,entries.length])),
   {small:7,medium:5,long:4,big:7});
 for(const [category,entries] of Object.entries(ROCK_PACK)){
  assert.equal(entries.length,ROCK_SOURCES[category].length);
  for(const [count,faces,base,alternate,encoded] of entries){
   assert.ok(Number.isInteger(count)&&count>8&&count<256);
   assert.ok(faces>16&&faces<1000);
   assert.equal(base.length,3);assert.equal(alternate.length,3);
   const payload=Buffer.from(encoded,'base64');
   assert.equal(payload.byteLength,3*(count+faces),'expected 3-byte positions plus 3-byte faces');
   for(const index of payload.subarray(count*3))assert.ok(index<count,'triangle out of range');
   assert.ok(payload.subarray(0,count*3).some(v=>v>0),'nonempty geometry');
  }
 }
});

test('placing all variants keeps server-compatible stone dimensions and serialized variant',()=>{
 for(const [type,category] of Object.entries({stone:'small',medium:'medium',long:'long',big:'big'})){
  const c=CATALOG[type];
  ROCK_PACK[category].forEach((_,i)=>{
   const [sx,sy,sz]=c.defaults;
   const b={id:'stone-'+type+'-'+i,type,x:1,y:0,z:1,sx,sy,sz,rotation:0,variant:i,paidCurrency:'silver',paidAmount:c.price};
   assert.equal(validatePlacement([],b).ok,true);
   assert.deepEqual(decodeTower(encodeTower([b]))[0],b);
  });
 }
});

test('fullscreen tower UI and quiet status are wired without altering global navigation',()=>{
 const index=readFileSync(new URL('../src/features/tower/index.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/features/tower/tower.css',import.meta.url),'utf8');
 const scene=readFileSync(new URL('../src/features/tower/scene.js',import.meta.url),'utf8');
 assert.match(index,/data-catalog-toggle/);
 assert.match(index,/setCatalogOpen\(!catalogOpen\)/);
 assert.match(index,/context\.shell\.appShell\.dataset\.feature='tower'/);
 assert.match(index,/status\(''\)/);
 assert.doesNotMatch(index,/Сохранено в аккаунте|Место подходит\. Подтверди установку/);
 assert.match(css,/\.towerCatalogContent\[hidden\]/);
 assert.match(css,/\.appShell\[data-feature="tower"\]/);
 assert.match(scene,/for\(const \[category,entries\] of Object\.entries\(ROCK_PACK\)\)/);
});
