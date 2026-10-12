import test from 'node:test';
import assert from 'node:assert/strict';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {bodyForTowerBlock} from '../packages/tower-game/stone-mesh-adapter.mjs';
import {verifyV2GeometryManifest} from '../packages/tower-game/tower-v2-authority.mjs';
const block=(id,x=20,rotation=0,variant=0)=>({id,type:'medium',x,y:0,z:20,sx:2,sy:1,sz:1,rotation,variant});
function manifest(blocks,revision=3){return{format:2,geometryVersion:1,revision,bodies:blocks.map(b=>{
 const body=bodyForTowerBlock(originalRockMesh(ROCK_PACK.medium[b.variant],b.variant),b);
 return{id:b.id,v:body.vertices.map(v=>[...v]),f:body.mesh.faces.map(f=>[...f])};
})};}
test('canonical server vertices and face indices authorize exactly one revision',()=>{
 const blocks=[block('a',20),block('b',23.1,4,1)];
 const verified=verifyV2GeometryManifest(blocks,8,manifest(blocks,8));
 assert.equal(verified.ok,true,verified.reason);assert.equal(verified.revision,8);
 assert.equal(verified.bodies.length,2);
 assert.equal(verified.bodies[0].id,'a');
});
test('reject stale revision, missing stones, extra stones, duplicates and stale protocol',()=>{
 const blocks=[block('a'),block('b',25)];
 assert.equal(verifyV2GeometryManifest(blocks,4,manifest(blocks,3)).ok,false);
 assert.equal(verifyV2GeometryManifest(blocks,4,manifest(blocks.slice(0,1),4)).ok,false);
 assert.equal(verifyV2GeometryManifest(blocks,4,manifest([...blocks,block('c',29)],4)).ok,false);
 assert.equal(verifyV2GeometryManifest(blocks,4,manifest([blocks[0],blocks[0]],4)).ok,false);
 assert.equal(verifyV2GeometryManifest(blocks,4,{...manifest(blocks,4),geometryVersion:2}).ok,false);
});
test('reject changed world vertex, changed triangle topology and invalid numbers',()=>{
 const blocks=[block('a')],m=manifest(blocks);
 m.bodies[0].v[0][0]+=.002;
 assert.equal(verifyV2GeometryManifest(blocks,3,m).ok,false);
 const f=manifest(blocks);f.bodies[0].f[0][0]=(f.bodies[0].f[0][0]+1)%f.bodies[0].v.length;
 assert.equal(verifyV2GeometryManifest(blocks,3,f).ok,false);
 const nan=manifest(blocks);nan.bodies[0].v[0][1]='Infinity';
 assert.equal(verifyV2GeometryManifest(blocks,3,nan).ok,false);
});
test('zero stones may verify while malformed shape and nonfinite coords fail closed',()=>{
 assert.equal(verifyV2GeometryManifest([],0,{format:2,geometryVersion:1,revision:0,bodies:[]}).ok,true);
 assert.equal(verifyV2GeometryManifest([block('x',Number.NaN)],0,manifest([block('a')],0)).ok,false);
});
