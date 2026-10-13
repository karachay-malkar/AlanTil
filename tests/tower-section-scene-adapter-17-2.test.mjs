import test from 'node:test';
import assert from 'node:assert/strict';
import {toMasonrySections,getPickedTowerBlock} from '../packages/tower-game/masonry-scene-adapter.mjs';
const stone={id:'stone-a',type:'medium',x:1.25,y:0,z:2.5,sx:2,sy:2,sz:2,rotation:1,variant:3};
test('V2 saved stones become visual section envelopes without changing authoritative elements',()=>{
 const original=structuredClone(stone);
 const result=toMasonrySections([stone,{...stone,id:'door-a',type:'door'}]);
 assert.equal(result.length,1);assert.deepEqual(result[0],{...stone,type:'masonry_section'});
 assert.deepEqual(stone,original);
});
test('cut layer respects floating continuous coordinates',()=>{
 const pair=[stone,{...stone,id:'stone-b',y:5}];
 assert.deepEqual(toMasonrySections(pair,2).map(s=>s.id),['stone-a']);
 assert.deepEqual(toMasonrySections(pair,null).map(s=>s.id),['stone-a','stone-b']);
});
test('ray pick maps both section Mesh and legacy InstancedMesh to the paid parent',()=>{
 assert.equal(getPickedTowerBlock({object:{userData:{block:stone}}}),stone);
 assert.equal(getPickedTowerBlock({object:{userData:{blocks:[stone]}},instanceId:0}),stone);
 assert.equal(getPickedTowerBlock({object:{userData:{blocks:[stone]}},instanceId:9}),null);
 assert.equal(getPickedTowerBlock({object:{userData:{}},instanceId:null}),null);
});
