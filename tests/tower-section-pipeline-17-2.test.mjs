import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSectionMasonry} from '../packages/tower-game/section-pipeline.mjs';
const mesh={positions:Float32Array.from([-.5,-.5,-.5,.5,-.5,-.5,0,.5,-.5,0,0,.5]),colors:Float32Array.from(Array(12).fill(.5)),indices:Uint16Array.from([0,1,2,0,2,3,0,3,1,1,3,2])};
const s=(id,x,y=0,z=0)=>({id,type:'masonry_section',x,y,z,sx:2,sy:2,sz:2,rotation:0});
test('assembly builds authored-rock batches and contacts for adjoining sections',()=>{
 const r=buildSectionMasonry([s('a',0),s('b',2)],{getModel:()=>mesh,rockCounts:{small:1,medium:1,long:1,big:1}});
 assert.equal(r.sections.length,2);assert.ok(r.stones.length>=2);assert.ok(r.joints.length>0);
 assert.ok(r.sections.every(x=>x.positions.length&&x.indices.length));
});
test('assembly invokes contact deformation and rubble only after collecting stones',()=>{
 let contacts=0,deformations=0,fill=0;
 const r=buildSectionMasonry([s('a',0),s('b',2)],{getModel:()=>mesh,rockCounts:{small:1,medium:1,long:1,big:1},
  contactEngine:stones=>{contacts++;return new Map(stones.map(x=>[x.id,[]]));},
  deform:m=>{deformations++;return m;},
  infillEngine:stones=>{fill++;return{stonePositions:new Float32Array(0),stoneColors:new Float32Array(0),mortarPositions:new Float32Array(0),mortarColors:new Float32Array(0)}}});
 assert.equal(contacts,1);assert.ok(deformations>=2);assert.equal(fill,1);assert.ok(r.infill.stonePositions instanceof Float32Array);
});
test('invalid dependency or unbounded section limit fails closed',()=>{
 assert.throws(()=>buildSectionMasonry([],{}),/getModel/);
 assert.throws(()=>buildSectionMasonry([s('a',0)],{getModel:()=>mesh,maxStones:0}),/limit/);
});
