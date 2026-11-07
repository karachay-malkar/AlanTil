import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three/three.module.js';
import {selectRuinLOD, RUIN_LOD_DISTANCES} from '../src/features/tower/kunlum-ruin-lod.mjs';
import {createKunlumMonument} from '../src/features/tower/kunlum-monument.js';

test('LOD selection has stable hysteresis around each transition',()=>{
  assert.deepEqual(RUIN_LOD_DISTANCES,[26,65,130]);
  for (const [distance,expected] of [[0,0],[26,0],[30,1],[66,2],[150,3]]) {
    assert.equal(selectRuinLOD(distance,null),expected);
  }
  assert.equal(selectRuinLOD(27,0),0,'slight forward motion does not flip');
  assert.equal(selectRuinLOD(30,0),1);
  assert.equal(selectRuinLOD(24,1),1,'slight backward motion does not flip');
  assert.equal(selectRuinLOD(22,1),0);
  assert.equal(selectRuinLOD(67,1),1);
  assert.equal(selectRuinLOD(75,1),2);
  assert.equal(selectRuinLOD(60,2),2);
  assert.equal(selectRuinLOD(57,2),1);
  assert.equal(selectRuinLOD(140,2),2);
  assert.equal(selectRuinLOD(148,2),3);
  assert.equal(selectRuinLOD(120,3),3);
  assert.equal(selectRuinLOD(114,3),2);
});

test('skipping over several LOD bands settles on the correct level',()=>{
  assert.equal(selectRuinLOD(220,0),3);
  assert.equal(selectRuinLOD(3,3),0);
  assert.equal(selectRuinLOD(NaN,2),2);
});

test('Abaev Kala backing is inset behind the facing stones without shrinking doors',()=>{
  const tower=createKunlumMonument(THREE,{x:10,z:18,baseY:1,mobile:false});
  const points=tower.geometry.getAttribute('position');
  let front=-Infinity,top=-Infinity;
  for(let i=0;i<points.count;i++){
    front=Math.max(front,points.getZ(i)-18);
    top=Math.max(top,points.getY(i));
  }
  assert.ok(front<2.99,'backing should be inside outer stone facing');
  assert.ok(Math.abs(top-16.8)<1e-6,'original 15.8m height retained');
  assert.equal(tower.userData.common100TowerBase.x,10);
  tower.geometry.dispose();tower.material.dispose();
});
