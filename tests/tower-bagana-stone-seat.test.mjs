import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BAGANA_PREFABS} from '../packages/tower-game/bagana-prefab.mjs';
import {measureBaganaSupport,seatBaganaStoneGlb} from '../tools/tower/bagana-stone-seat.mjs';

test('all 15 organic Bagana timber feet sit on actual stone triangles across the entire sole',()=>{
 assert.equal(BAGANA_PREFABS.length,15);
 for(const spec of BAGANA_PREFABS){
  const bytes=readFileSync(new URL('..'+spec.file,import.meta.url));
  const m=measureBaganaSupport(bytes);
  assert.equal(m.uncovered,0,'no point outside the stone: '+spec.id);
  assert.ok(m.maxGap<=.005,'no floating timber foot: '+spec.id+' '+m.maxGap);
  assert.ok(m.maxPenetration<=.028,'do not bury wooden feet: '+spec.id+' '+m.maxPenetration);
  assert.ok(Math.abs(m.stoneHeight-.25)<.001,'preserve stone base height: '+spec.id);
  assert.ok(m.stoneExtents.every(s=>s<=.75),'preserve buildable footprint: '+spec.id);
  const repeat=seatBaganaStoneGlb(Buffer.from(bytes),{form:spec.form});
  assert.equal(repeat.modified,false,'do not distort corrected stones twice: '+spec.id);
  assert.deepEqual(repeat.bytes,bytes);
 }
});
