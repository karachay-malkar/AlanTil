import test from 'node:test';import assert from 'node:assert/strict';import {suggestCameraPlacement} from '../packages/tower-game/camera-placement.mjs';
const stone={id:'a',type:'medium',x:0,y:0,z:0,sx:2,sy:1,sz:1,rotation:0};
const camera={origin:[0,8,-20],forward:[0,-.3,1],target:[1,0,1]};
test('suggests valid ground position',()=>{const p=suggestCameraPlacement([],stone,camera);assert.ok(p);assert.equal(p.y,0);});
test('no suggestion behind camera',()=>assert.equal(suggestCameraPlacement([],stone,{...camera,forward:[0,0,-1]}),null));
test('integer coordinates remain server-compatible',()=>{const p=suggestCameraPlacement([],stone,camera);assert.ok([p.x,p.y,p.z].every(Number.isInteger));});
