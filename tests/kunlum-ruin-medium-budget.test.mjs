import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Sphere} from '../src/vendor/three/three.module.js';
import {fenceLodVisibility} from '../src/features/tower/kunlum-ruin-lod.mjs';

test('fence batches submit both levels only when they intersect the blend band',()=>{
 const bounds=new Sphere(new Vector3(),2);
 for(const [distance,near,far] of [[0,true,false],[20,true,false],[38,true,true],[55,false,true],[100,false,true]]){
  assert.deepEqual(fenceLodVisibility(new Vector3(distance,0,0),bounds),{near,far});
  assert.deepEqual(fenceLodVisibility(new Vector3(0,distance,0),bounds),{near,far});
 }
});
