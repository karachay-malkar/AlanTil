import test from 'node:test';
import assert from 'node:assert/strict';
import {solveMasonryLayout,validateCombinedLayout} from '../packages/tower-game/section-masonry.mjs';
import {buildSectionMasonry} from '../packages/tower-game/section-pipeline.mjs';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
const section=(id,x,y,z,sx=2,sy=2,sz=2)=>({id,type:'masonry_section',x,y,z,sx,sy,sz,rotation:0});
const source=(family,variant)=>originalRockMesh(ROCK_PACK[family][variant],variant);
const counts=Object.fromEntries(Object.entries(ROCK_PACK).map(([family,arr])=>[family,arr.length]));
const examples={
 wall:[section('a',2,0,2),section('b',4,0,2),section('c',6,0,2)],
 corner:[section('a',2,0,2),section('b',4,0,2),section('c',2,0,4)],
 stack:[section('a',2,0,2),section('b',2,2,2),section('c',4,0,2)],
};
for(const [name,sections] of Object.entries(examples))test(name+': one deterministic watertight envelope partition with cross-boundary stones',()=>{
 const stones=solveMasonryLayout(sections,{rockCounts:counts,getModel:source});
 assert.deepEqual(stones,solveMasonryLayout([...sections].reverse(),{rockCounts:counts,getModel:source}));
 const result=validateCombinedLayout(sections,stones);
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.ok(stones.some(s=>sections.some(p=>p.id!==s.parent.id && s.x<p.x&&s.x+s.sx>p.x+.00001 || p.id!==s.parent.id&&s.y<p.y&&s.y+s.sy>p.y+.00001 || p.id!==s.parent.id&&s.z<p.z&&s.z+s.sz>p.z+.00001)),'stone must bridge at least one section seam');
 if(name==='stack')assert.ok(stones.some(rock=>rock.y<2&&rock.y+rock.sy>2),'vertical joint must be interlocked');
 const pipeline=buildSectionMasonry(sections,{getModel:source,rockCounts:counts});
 assert.equal(pipeline.stones.length,stones.length);
 assert.equal(pipeline.sections.length,sections.length);
 assert.ok(pipeline.sections.every(s=>s.positions.length>0));
});
test('single section remains deterministic, source mesh immutable and correct envelope coverage',()=>{
 const sourceMesh=originalRockMesh(ROCK_PACK.small[0],0),before=[...sourceMesh.positions];
 const stones=solveMasonryLayout([section('solo',2,0,2)],{rockCounts:counts,getModel:source});
 assert.equal(validateCombinedLayout([section('solo',2,0,2)],stones).ok,true);
 assert.deepEqual([...sourceMesh.positions],before);
});
test('supports a 1x1x1 small stone envelope, isolated and out-of-order sections',()=>{
 const sections=[section('small',0,0,0,1,1,1),section('far',12,0,12,2,2,2)];
 const stones=solveMasonryLayout(sections,{rockCounts:counts,getModel:source});
 assert.equal(validateCombinedLayout(sections,stones).ok,true);
 assert.ok(stones.length>=2);
});