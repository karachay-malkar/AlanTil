import test from 'node:test';
import assert from 'node:assert/strict';
import {captureBlockRenderSnapshot,rebindCachedBlockTargets,areSameRenderedBlocks} from '../src/features/tower/block-render-snapshot.mjs';

function mockGroup(){
 const meshes=[{isMesh:true,userData:{block:{id:'a'}}},{isMesh:true,userData:{block:{id:'a'}}},{isMesh:false,userData:{}}];
 const group={userData:{},updateCalls:0,traverseCalls:0,
  updateMatrixWorld(){this.updateCalls++},
  traverse(callback){this.traverseCalls++;for(const child of meshes)callback(child)}};
 return {group,meshes};
}
test('a new section receives one bounding-box calculation and cached raycast targets',()=>{
 const {group,meshes}=mockGroup();let boxCalls=0;
 const THREE={Box3:class{
  min={clone:()=>({x:1})};max={clone:()=>({x:2})};
  setFromObject(obj){assert.equal(obj,group);boxCalls++;return this}
  isEmpty(){return false}
 }};
 const capture=captureBlockRenderSnapshot(THREE,group);
 assert.equal(boxCalls,1);assert.equal(group.updateCalls,1);
 assert.equal(group.traverseCalls,1);assert.deepEqual(capture.targets,meshes.slice(0,2));
 assert.deepEqual(capture.bounds,{min:{x:1},max:{x:2}});
 const update={id:'new-state',x:3};
 rebindCachedBlockTargets(group,update,capture.targets);
 assert.equal(group.traverseCalls,1,'rebind never rescans the entire model');
 assert.equal(group.userData.block,update);
 for(const mesh of capture.targets)assert.equal(mesh.userData.block,update);
});

test('unchanged block geometry skips expensive joint and bounds recomputation',()=>{
 const visible=[{id:'a',version:4},{id:'b',version:5}];
 const entries=new Map([['a',{signature:'a:4'}],['b',{signature:'b:5'}]]);
 const key=b=>b.id+':'+b.version;
 assert.equal(areSameRenderedBlocks(visible,entries,key),true);
 assert.equal(areSameRenderedBlocks([{id:'a',version:6},visible[1]],entries,key),false);
 assert.equal(areSameRenderedBlocks([visible[0]],entries,key),false);
 assert.equal(areSameRenderedBlocks([...visible,{id:'c',version:7}],entries,key),false);
 assert.equal(areSameRenderedBlocks([visible[0],{id:'c',version:7}],entries,key),false);
});
