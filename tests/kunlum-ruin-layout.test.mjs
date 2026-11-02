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

test('all wall sections use stone-only thickness in both detail levels',()=>{
 assert.equal((facing.match(/for\(const rock of layoutKunlumRuinStones\(seg\)\)/g)||[]).length,2);
 assert.equal((facing.match(/for\(const layerDepth of \[-1,0,1\]\)/g)||[]).length,2);
 assert.match(facing,/root.userData.ruinPlacementMode='stone-only-broken-v3'/);
 assert.doesNotMatch(facing,/backing\.color\.multiplyScalar|wallBackingMaterial/);
 assert.doesNotMatch(map,/function wallBody|pushQuad\(out|addMesh\(confirmed/);
 assert.match(map,/stoneSegments|candidateSegments/);
});

test('historic map still supports cut passages, grounded rubble and versioned stone meshes',()=>{
 assert.match(scene,/dataset.kunlumRuinEngine/);
 assert.match(map,/outsidePassages\(a,b\)/);
 assert.match(map,/kunlum-stone-facing\.js\?v=17\.2\.58/);
 assert.match(map,/createKunlumWallFootings/);
});

test('upper edge has major, smooth collapsed spans without floating top blocks',()=>{
 const heights=Array.from({length:40},(_,i)=>kunlumRuinCrown(1.6,2+i*.45,3));
 assert.ok(heights.every(v=>v>=1.6*.27&&v<1.6));
 assert.ok(Math.max(...heights)-Math.min(...heights)>.25);
});

test('all authored historical placement remains reproducible',()=>{
 const segment={a:[-12,-3],b:[20,3],width:.65,height:1.8,heightAt:(x,z)=>.025*x+.03*z};
 const stones=layoutKunlumRuinStones(segment);
 assert.ok(stones.length>60);
 assert.deepEqual(stones,layoutKunlumRuinStones(segment));
 assert.ok(stones.some(s=>s.row===0));
 assert.ok(stones.every(s=>Number.isFinite(s.y)&&s.height>.08));
});
