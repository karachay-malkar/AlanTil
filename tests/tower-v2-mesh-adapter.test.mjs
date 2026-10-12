import test from 'node:test';
import assert from 'node:assert/strict';
import {stoneMeshFromAuthored, bodyForTowerBlock, towerBlockFromBody, meshDiagnostics, validateRockType} from '../packages/tower-game/stone-mesh-adapter.mjs';
import {penetrates,makeBody,checkPlacement} from '../packages/tower-game/stone-placement-v2.mjs';
const mesh={positions:new Float32Array([
 -.5,-.5,-.5, .5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,
 -.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5
 ]),indices:new Uint16Array([0,2,1,0,3,2, 4,5,6,4,6,7, 0,1,5,0,5,4, 2,3,7,2,7,6, 1,2,6,1,6,5, 3,0,4,3,4,7])};
const block={id:'x',type:'medium',sx:2,sy:1,sz:1,x:1.345,y:0.75,z:2.675,rotation:0,variant:0};
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol, `${a} != ${b}`);
const ext=b=>b.map((x,i)=>x[i]||0);
test('authored vertices use the same per-axis 25cm scale as scene.js',()=>{
 const t=stoneMeshFromAuthored(mesh,block);
 assert.equal(t.vertices.length,8);near(Math.max(...t.vertices.map(p=>p[0]))-Math.min(...t.vertices.map(p=>p[0])),.5);
});
test('all 8 orientations reproduce scene.js axis/permutation contract',()=>{
 const expected=[[.5,.25,.25],[.25,.25,.5],[.5,.25,.25],[.25,.25,.5],[.25,.5,.25],[.5,.25,.25],[.25,.25,.5],[.25,.5,.25]];
 for(let r=0;r<8;r++){const t=stoneMeshFromAuthored(mesh,{...block,rotation:r});const min=[0,1,2].map(i=>Math.min(...t.vertices.map(p=>p[i])));const max=[0,1,2].map(i=>Math.max(...t.vertices.map(p=>p[i])));for(let i=0;i<3;i++)near(max[i]-min[i],expected[r][i]);}
});
test('body world positions exactly match render center and authored vertices',()=>{
 const body=bodyForTowerBlock(mesh,block);
 near(body.bbox.min[0],block.x*.25);near(body.bbox.min[1],block.y*.25);near(body.bbox.min[2],block.z*.25);
 near(body.center[0],(block.x+1)*.25);near(body.center[1],(block.y+.5)*.25);near(body.center[2],(block.z+.5)*.25);
});
test('round-trip body to fractional grid-cell coordinates does not snap',()=>{
 const body=bodyForTowerBlock(mesh,block),restored=towerBlockFromBody(body,block);
 for(const axis of ['x','y','z'])near(restored[axis],block[axis]);
 assert.ok(!Number.isInteger(restored.x));
});
test('conservative collision detects identical stones, accepts separated ones',()=>{
 const a=bodyForTowerBlock(mesh,block);
 assert.equal(penetrates(a,bodyForTowerBlock(mesh,block)),true);
 assert.equal(penetrates(a,bodyForTowerBlock(mesh,{...block,x:50})),false);
});
test('rejects non-stones, non-finite coords and missing surface topology',()=>{
 assert.equal(validateRockType('medium'),true);assert.equal(validateRockType('ladder'),false);
 assert.throws(()=>stoneMeshFromAuthored(mesh,{...block,x:NaN}),/Invalid/);
 assert.throws(()=>stoneMeshFromAuthored({positions:new Float32Array([0,0,0]),indices:new Uint16Array([0,0,0])},block),/Degenerate/);
});
test('mesh audit reports open boundary edges without silently closing authored mesh',()=>{
 const m={positions:mesh.positions,indices:mesh.indices.slice(0,6)};
 const d=meshDiagnostics(m);assert.ok(d.boundaryEdges>0);assert.equal(d.watertight,false);
 const solid=meshDiagnostics(mesh);assert.equal(solid.boundaryEdges,0);assert.equal(solid.watertight,true);
});
test('support rejects floating candidate over bare ground',()=>{
 const supported=bodyForTowerBlock(mesh,{...block,x:0,z:0,y:0});
 const floating=bodyForTowerBlock(mesh,{...block,x:0,z:0,y:4});
 assert.ok(checkPlacement(supported,[]).ok);assert.equal(checkPlacement(floating,[]).ok,false);
});
