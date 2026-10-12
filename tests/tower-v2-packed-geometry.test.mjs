import test from 'node:test';
import assert from 'node:assert/strict';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {worldDimensions} from '../packages/tower-game/core.mjs';
import * as THREE from '../src/vendor/three/three.module.js';
import {bodyForTowerBlock,worldStoneDimensions,meshDiagnostics} from '../packages/tower-game/stone-mesh-adapter.mjs';
import {penetrates} from '../packages/tower-game/stone-placement-v2.mjs';
const configs={stone:[1,1,1],medium:[2,1,1],long:[3,1,1],big:[2,3,3]};
const category=type=>type==='stone'?'small':type;
const rotations=[0,1,2,3,4,5,6,7];
const quat=rot=>{const q=new THREE.Quaternion();if(rot===4)return q.setFromAxisAngle(new THREE.Vector3(0,0,1),-Math.PI/2);
 if(rot===5)return q.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
 if(rot===6||rot===7)return q.setFromAxisAngle(new THREE.Vector3(1,1,1).normalize(),(rot===6?-1:1)*Math.PI*2/3);
 return q.setFromAxisAngle(new THREE.Vector3(0,1,0),rot*Math.PI/2);
};
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-5,`${a} != ${b}`);
test('all 23 source meshes and eight orientations match actual Three scene transforms',()=>{
 let count=0;
 for(const [type,dims] of Object.entries(configs))for(let i=0;i<ROCK_PACK[category(type)].length;i++){
  const original=originalRockMesh(ROCK_PACK[category(type)][i],i);const diagnosis=meshDiagnostics(original);
  assert.ok(diagnosis.vertices>3&&diagnosis.triangles>3);assert.equal(diagnosis.degenerate,0);
  for(const r of rotations){const b={id:'fixture',type,x:1.234,y:0.987,z:3.456,sx:dims[0],sy:dims[1],sz:dims[2],rotation:r,variant:i};
   assert.deepEqual(worldStoneDimensions(b),worldDimensions(b));
   const calculated=bodyForTowerBlock(original,b);
   const center=worldDimensions(b).map((v,axis)=>([b.x,b.y,b.z][axis]+v/2)*.25);
   const q=quat(r);
   for(let v=0;v<original.positions.length/3;v++){
    const expected=new THREE.Vector3(original.positions[v*3]*b.sx*.25,original.positions[v*3+1]*b.sy*.25,original.positions[v*3+2]*b.sz*.25).applyQuaternion(q);
    for(let k=0;k<3;k++)near(calculated.vertices[v][k],expected.getComponent(k)+center[k]);
   }
   if(i===0 && r===0)assert.equal(penetrates(calculated,calculated),true);
   count++;
  }
 }
 assert.equal(count,23*8);
});
