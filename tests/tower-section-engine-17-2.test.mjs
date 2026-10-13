import test from 'node:test';
import assert from 'node:assert/strict';
import {SECTION_CATALOG,generateSectionStones,validateSectionLayout} from '../packages/tower-game/section-masonry.mjs';
import {findSectionJoints,affectedSections} from '../packages/tower-game/section-joints.mjs';
import {findSectionPlacements,validateSectionPlacement} from '../packages/tower-game/section-placement.mjs';
import {serializeSection,parseSection,migrateLegacySnapshot} from '../packages/tower-game/tower-serialization.mjs';
import {buildSectionGeometry} from '../packages/tower-game/section-geometry.mjs';
const section=(id,x,y,z,[sx,sy,sz])=>({id,type:'masonry_section',x,y,z,sx,sy,sz,rotation:0});
const sampleMesh={positions:Float32Array.from([-.5,-.5,-.5,.5,-.5,-.5,0,.5,-.5,0,0,.5]),
 colors:Float32Array.from(Array(12).fill(.7)),indices:Uint16Array.from([0,1,2,0,2,3,0,3,1,1,3,2])};
test('all 5 required section geometries are deterministically subdivided into non-overlapping envelopes',()=>{
 assert.deepEqual(SECTION_CATALOG.map(s=>s.key),['1x1x1','2x2x2','2x2x3','2x3x4','4x4x4']);
 assert.ok(SECTION_CATALOG.every(x=>x.priceSilver===null));
 for(const def of SECTION_CATALOG){const p=section(def.key,5,0,5,def.size),a=generateSectionStones(p);assert.deepEqual(a,generateSectionStones(p));assert.equal(validateSectionLayout(p,a).ok,true);}
});
test('section-to-section joints appear only at shared faces',()=>{
 const a=section('left',0,0,0,[2,2,2]),b=section('right',2,0,0,[2,2,2]),far=section('far',9,0,0,[2,2,2]);
 const stones=[...generateSectionStones(a),...generateSectionStones(b),...generateSectionStones(far)];
 const contacts=findSectionJoints([a,b,far],stones);assert.ok(contacts.length);assert.ok(contacts.every(x=>x.leftParent==='left'&&x.rightParent==='right'));
 assert.deepEqual(affectedSections([a,b,far],'left'),['left','right']);
});
test('continuous camera candidates reject overlapping and unsupported geometry',()=>{
 const base=section('base',2,0,2,[2,2,2]);
 const result=findSectionPlacements({size:[2,2,2],sections:[base],camera:{target:[4.1,1,3],forward:[1,0,0]}});
 assert.ok(result.length>0);assert.ok(result.every(x=>x.valid));
 assert.equal(validateSectionPlacement([base],{...base,id:'candidate'}).reason,'collision');
 assert.equal(validateSectionPlacement([],{...base,id:'floating',y:10}).reason,'insufficient-support');
});
test('render uses authored indexed mesh and never changes its vertices',()=>{
 const p=section('render',0,0,0,[2,2,2]),before=[...sampleMesh.positions];
 const [batch]=buildSectionGeometry([p],{getModel:()=>sampleMesh,counts:{small:1,medium:1,long:1,big:1}});
 assert.ok(batch.triangles>0);assert.ok(batch.stones>0);assert.deepEqual([...sampleMesh.positions],before);
 assert.deepEqual([...batch.indices.slice(0,12)],[...sampleMesh.indices]);
});
test('v3 persistence records exact stone identities and leaves old tower intact',()=>{
 const p=section('saved',0,0,0,[2,2,2]),stones=generateSectionStones(p),encoded=serializeSection(p,stones);
 assert.deepEqual(parseSection(JSON.parse(JSON.stringify(encoded))),encoded);
 assert.equal(encoded.stones.length,stones.length);
 const old={format:2,elements:[{id:'legacy'}],silver:19,gold:3,revision:7};
 const result=migrateLegacySnapshot(old);assert.deepEqual(result.legacyElements,old.elements);assert.equal(result.silver,19);assert.deepEqual(old.elements,[{id:'legacy'}]);
});
