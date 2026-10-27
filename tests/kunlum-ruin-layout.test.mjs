import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {layoutKunlumRuinStones} from '../src/features/tower/kunlum-ruin-layout.js';
import {kunlumRuinCrown} from '../src/features/tower/kunlum-wall-ground.js';

const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const facing=file('src/features/tower/kunlum-stone-facing.js');
const map=file('src/features/tower/kunlum-map-overlay.js');
const scene=file('src/features/tower/prefab-scene.js');

test('every ruin wall has organically spaced stones rather than identical brick slots',()=>{
 const segment={a:[0,0],b:[12,0],width:.5,height:1.6,
  heightAt:(x,z)=>.16*x+.03*z};
 const stones=layoutKunlumRuinStones(segment);
 assert.ok(stones.length>55);
 assert.deepEqual(stones,layoutKunlumRuinStones(segment),'layout must be deterministic');
 const widths=stones.map(s=>s.width);
 assert.ok(Math.max(...widths)/Math.min(...widths)>2);
 assert.ok(new Set(widths.map(v=>v.toFixed(2))).size>25);
 assert.ok(stones.some(s=>s.row===0&&s.y-s.height*.5<segment.heightAt(s.x,s.z)-.08),
  'first row must be embedded below terrain');
 assert.ok(stones.some(s=>s.row>=3),'broken upper courses must still exist');
 assert.ok(stones.every(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&s.height>.08));
});

test('actual Common100 and far faceted geometry use exactly the same placement generator',()=>{
 assert.equal((facing.match(/for\(const rock of layoutKunlumRuinStones\(seg\)\)/g)||[]).length,2);
 assert.doesNotMatch(facing,/const rows=Math.max\(2,Math.ceil\(seg.height/);
 assert.doesNotMatch(facing,/const widths=Array.from\(\{length:columns\}/);
 assert.match(facing,/Array.from\(\{length:mobile\?12:16\}/);
 assert.match(facing,/root.userData.ruinPlacementMode='shared-irregular-v2'/);
 assert.match(facing,/backing.color.multiplyScalar\(\.49\)/);
});

test('the new masonry source is observable by the real-world browser verification',()=>{
 assert.match(scene,/dataset.kunlumRuinEngine/);
 assert.match(map,/kunlum-stone-facing\.js\?v=17\.2\.35/);
 assert.match(map,/wallBackingMaterial\?\.dispose/);
});

test('upper edge variations form visible loss without creating full-height teeth',()=>{
 const heights=Array.from({length:40},(_,i)=>kunlumRuinCrown(1.6,2+i*.45,3));
 assert.ok(heights.every(v=>v>=1.23&&v<=1.55));
 assert.ok(Math.max(...heights)-Math.min(...heights)>.06);
});
