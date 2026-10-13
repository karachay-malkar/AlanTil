import test from 'node:test';import assert from 'node:assert/strict';
import {PREFAB_TYPES,validatePrefabPlacement,prefabBounds,positionAgainst,touchingPrefabPairs} from '../packages/tower-game/prefab-layout.mjs';
const make=(id,x=0,y=0,z=0,sectionId='2x2x2')=>({id,type:'masonry_section',sectionId,x,y,z,rotation:0,variant:0});
test('five catalog sizes only and 90 degree rotation swaps xz',()=>{
 assert.equal(PREFAB_TYPES.length,5);
 assert.deepEqual(prefabBounds({...make('a'),rotation:1}).size,[2,2,2]);
 assert.deepEqual(prefabBounds({...make('a',0,0,0,'2x2x3'),rotation:1}).size,[3,2,2]);
});
test('neighbor sections touch without overlap, and locked past section never changes',()=>{
 const a=make('a');const b=make('b');const out=positionAgainst(b,{block:a,normal:{x:1,y:0,z:0}});
 assert.deepEqual([out.x,out.y,out.z],[2,0,0]);
 assert.deepEqual(validatePrefabPlacement([a],out),{ok:true,reason:''});
 assert.equal(touchingPrefabPairs([a,out])[0].axis,'x');
 assert.equal(a.x,0);
 assert.equal(validatePrefabPlacement([a],make('no',1,0,0)).ok,false);
});
test('upper section needs support and false corner supports are rejected',()=>{
 const a=make('base');const upper=make('upper',0,2,0);
 assert.equal(validatePrefabPlacement([a],upper).ok,true);
 assert.equal(validatePrefabPlacement([],upper).ok,false);
 assert.equal(validatePrefabPlacement([make('corner',1.8,0,1.8)],upper).ok,false);
 assert.equal(touchingPrefabPairs([a,upper])[0].axis,'y');
});
test('reject malformed and nonexistent objects and prevent out-of-bounds placements',()=>{
 assert.equal(validatePrefabPlacement([],{...make('a'),sectionId:'unknown'}).ok,false);
 assert.equal(validatePrefabPlacement([],{...make('a'),x:-1}).ok,false);
 assert.equal(validatePrefabPlacement([],{...make('a'),variant:99}).ok,false);
 assert.equal(validatePrefabPlacement([],{...make('a'),rotation:4}).ok,false);
});
