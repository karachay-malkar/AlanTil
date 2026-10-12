import test from 'node:test';import assert from 'node:assert/strict';
import {findPlacement} from '../packages/tower-game/stone-placement-v2.mjs';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {stoneMeshFromAuthored,bodyForTowerBlock} from '../packages/tower-game/stone-mesh-adapter.mjs';
import {resolveTowerV2Proposal} from '../packages/tower-game/tower-v2-proposals.mjs';
const selected={id:'stone-1',type:'medium',x:0,y:0,z:0,sx:2,sy:1,sz:1,rotation:0,variant:0};
const camera={target:[.5,.0,.5],origin:[2,1.9,2],forward:[-.5,-.4,-.5]};
test('fixed-orientation solver may offset positions but never introduces unsupported free yaw',()=>{
 const raw=originalRockMesh(ROCK_PACK.medium[0],0),template=stoneMeshFromAuthored(raw,selected);
 const found=findPlacement(template,[],{x:.5,z:.5,yaw:.51,mode:'ground',fixedOrientation:true});
 assert.equal(found.ok,true);assert.equal(found.body.yaw,0);
});
test('preview proposes a fractional real-mesh stone with support, not grid-snapped coords',()=>{
 const out=resolveTowerV2Proposal({stone:selected,camera,blocks:[]});
 assert.equal(out.ok,true,JSON.stringify(out));
 assert.ok(Object.values(out.block).some((v,i)=>['x','y','z'].includes(Object.keys(out.block)[i])&&!Number.isInteger(v)));
 assert.equal(out.metrics.ground,true);assert.ok(out.metrics.area>0);
 const body=bodyForTowerBlock(originalRockMesh(ROCK_PACK.medium[0],0),out.block);
 assert.ok(body.bbox.min[1]>-0.002);
});
test('upper placement fails closed without a real supporting patch',()=>{
 const out=resolveTowerV2Proposal({stone:selected,camera,blocks:[],mode:'upper'});
 assert.equal(out.ok,false);
});
test('non-stone obstacles fail closed until server can validate them',()=>{
 const out=resolveTowerV2Proposal({stone:selected,camera,blocks:[{type:'beam',x:0,y:0,z:0,sx:8,sy:1,sz:1,rotation:0}]});
 assert.equal(out.ok,false);assert.equal(out.reason,'mixed elements unsupported in V2 preview');
});
test('rejects invalid stone type, camera and out-of-envelope proposals',()=>{
 assert.equal(resolveTowerV2Proposal({stone:{...selected,type:'beam'},camera,blocks:[]}).ok,false);
 assert.equal(resolveTowerV2Proposal({stone:selected,camera:{},blocks:[]}).ok,false);
 assert.equal(resolveTowerV2Proposal({stone:selected,camera:{...camera,target:[1000,0,1000]},blocks:[]}).ok,false);
});
