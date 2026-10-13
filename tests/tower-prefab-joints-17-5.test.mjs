import test from 'node:test';import assert from 'node:assert/strict';
import {resolvePrefabJoints,validateSectionJoints,JOINT_INTERFACE} from '../packages/tower-game/prefab-joints.mjs';
const manifest={version:'17.5.0',types:[{id:'2x2x2',jointInterface:JOINT_INTERFACE}],connectors:{x:{file:'/x.glb',interface:JOINT_INTERFACE},y:{file:'/y.glb',interface:JOINT_INTERFACE},z:{file:'/z.glb',interface:JOINT_INTERFACE},corner:{file:'/corner.glb',interface:JOINT_INTERFACE}}};
const make=(id,x=0,y=0,z=0,geometryVersion='17.5.0')=>({id,x,y,z,sectionId:'2x2x2',type:'masonry_section',variant:0,rotation:0,geometryVersion});
test('interface tiles are prebuilt and never scaled to fit arbitrary spans',()=>{
 const r=resolvePrefabJoints([make('a'),make('b',2,0,0),make('c',0,2,0)],manifest);
 assert.equal(r.ok,true);assert.equal(r.pairs.length,2);assert.equal(r.joints.length,8);
 assert.ok(r.joints.every(x=>x.file.startsWith('/')&&x.point.length===3&&x.profile===JOINT_INTERFACE));
 assert.equal(r.joints.filter(x=>x.axis==='x').length,4);
 assert.equal(r.joints.filter(x=>x.axis==='y').length,4);
});
test('missing or incompatible prefabricated joints forbid joining instead of arbitrary runtime filler',()=>{
 const a=make('a');const legacy=make('b',2,0,0,'17.4.1');
 assert.equal(validateSectionJoints([a],legacy,manifest).ok,false);
 assert.equal(validateSectionJoints([],legacy,manifest).ok,true);
 assert.equal(validateSectionJoints([a],make('far',10,0,0),manifest).ok,true);
 const broken={...manifest,connectors:{}};
 assert.equal(validateSectionJoints([a],make('b',2,0,0),broken).ok,false);
});

test('right-angle masonry corner uses authored corner tiles and fixed geometry',()=>{
 const r=resolvePrefabJoints([make('core'),make('east',2,0,0),make('north',0,0,2)],manifest);
 assert.equal(r.ok,true);assert.equal(r.pairs.length,2);
 assert.equal(r.joints.filter(j=>j.axis==='corner').length,2);
 assert.ok(r.joints.filter(j=>j.axis==='corner').every(j=>j.file==='/corner.glb'));
});