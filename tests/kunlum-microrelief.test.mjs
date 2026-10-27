import test from 'node:test';
import assert from 'node:assert/strict';
import {kunlumMicrorelief,kunlumMicroreliefWeight} from '../src/features/tower/kunlum-microrelief.mjs';

test('the playable building plot and its immediate contact band stay level',()=>{
 for(const [x,z] of [[7.5,15],[0,0],[15,30],[-1,15],[16,15],[7.5,-1],[7.5,31]]){
  assert.equal(kunlumMicrorelief(x,z),0);
 }
});
test('microrelief is deterministic, nonzero in soil, bounded, and fades at LOD boundary',()=>{
 let variation=0;
 for(let z=6;z<=26;z+=2){
  const d=kunlumMicrorelief(-7,z);
  assert.equal(d,kunlumMicrorelief(-7,z));
  assert.ok(Math.abs(d)<=.084,`displacement exceeds 8.4cm: ${d}`);
  variation+=Math.abs(d);
 }
 assert.ok(variation>.02,'stone and soil surface is still perfectly flat');
 for(const d of [15,17,25]){
  assert.equal(kunlumMicrorelief(-d,15),0,'must not create cracks along coarse-LOD tiles');
 }
 assert.ok(kunlumMicroreliefWeight(-14.99,15)<.0001);
 assert.ok(Math.abs(kunlumMicrorelief(-11.001,15)-kunlumMicrorelief(-10.999,15))<.001);
});
test('river-cut surfaces remain seated and microrelief vanishes near incised river',()=>{
 assert.equal(kunlumMicrorelief(-7,15,.2),0);
 assert.equal(kunlumMicrorelief(-7,15,-.1),kunlumMicrorelief(-7,15,0));
 assert.ok(Math.abs(kunlumMicrorelief(-7,15,.08))<=Math.abs(kunlumMicrorelief(-7,15,0)));
});
test('bad coordinates fail early, not with NaN vertex heights',()=>{
 assert.throws(()=>kunlumMicrorelief(NaN,2),/finite/i);
 assert.throws(()=>kunlumMicrorelief(2,Infinity),/finite/i);
});
