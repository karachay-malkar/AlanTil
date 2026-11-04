import test from 'node:test';import assert from 'node:assert/strict';
import {resolvePrefabHitFace,nudgePrefabOnFace} from '../packages/tower-game/prefab-placement-face.mjs';
const bounds={min:[4,0,8],max:[8,4,12]};
test('top face from ray-box intersection even if stone triangle is slanted',()=>{
 const face=resolvePrefabHitFace(bounds,[1,12,10],[.4,-1,0],[6,3.8,10],{x:1,y:0,z:0});
 assert.deepEqual(face,{x:0,y:1,z:0});
});
test('side face from ray-box intersection cannot be interpreted as top',()=>{
 const face=resolvePrefabHitFace(bounds,[14,2,10],[-1,0,0],[8.1,2,10],{x:0,y:1,z:0});
 assert.deepEqual(face,{x:1,y:0,z:0});
});
test('nudge on top moves X/Z; on side moves horizontal and vertical',()=>{
 const a={x:3,y:4,z:5};
 assert.deepEqual(nudgePrefabOnFace(a,{x:0,y:1,z:0},'up'),{x:3,y:4,z:4});
 assert.deepEqual(nudgePrefabOnFace(a,{x:0,y:1,z:0},'right'),{x:4,y:4,z:5});
 assert.deepEqual(nudgePrefabOnFace(a,{x:1,y:0,z:0},'up'),{x:3,y:5,z:5});
 assert.deepEqual(nudgePrefabOnFace(a,{x:1,y:0,z:0},'right'),{x:3,y:4,z:6});
});
