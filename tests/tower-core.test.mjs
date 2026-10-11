import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG,validatePlacement,removalDependents,encodeTower,decodeTower} from '../packages/tower-game/core.mjs';
const block=(id,type,x,y,z,sx,sy,sz,rotation=0)=>({id,type,x,y,z,sx,sy,sz,rotation});
test('catalogue prices and stretching limits',()=>{assert.equal(CATALOG.medium.price,4);assert.equal(CATALOG.long.price,8);assert.equal(CATALOG.big.price,24);assert.equal(CATALOG.beam.price,8);assert.equal(CATALOG.corner,undefined);assert.equal(validatePlacement([],block('a','medium',0,0,0,3,1,1)).ok,false);});
test('ground boundaries, collisions and support',()=>{const a=block('a','stone',0,0,0,1,1,1);assert.equal(validatePlacement([],a).ok,true);assert.equal(validatePlacement([], {...a,x:60}).ok,false);assert.equal(validatePlacement([a],{...a,id:'b'}).ok,false);assert.equal(validatePlacement([], {...a,y:1}).ok,false);assert.equal(validatePlacement([a],{...a,id:'b',y:1}).ok,true);});
test('lintel needs bearing at both ends',()=>{const lintel=block('l','long',0,1,0,3,1,1),a=block('a','stone',0,0,0,1,1,1),b=block('b','stone',2,0,0,1,1,1);assert.equal(validatePlacement([a],lintel).ok,false);assert.equal(validatePlacement([a,b],lintel).ok,true);assert.deepEqual(removalDependents([a,b,lintel],'a'),['l']);});
test('compact serialization preserves dimensions and payment',()=>{const a={...block('a','big',2,0,4,5,3,4),paidCurrency:'gold',paidAmount:3};assert.deepEqual(decodeTower(encodeTower([a])),[a]);});
