import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BAGANA_PREFABS,BAGANA_RENDER_VERSION_V2} from '../packages/tower-game/bagana-prefab.mjs';
import {measureBaganaCrown,seatBaganaCrownGlb} from '../tools/tower/bagana-crown-seat.mjs';
import {measureBaganaSupport} from '../tools/tower/bagana-stone-seat.mjs';
import {roofBeamId,roofBeamBounds} from '../packages/tower-game/roof-beam.mjs';
test('all 15 real timber crowns contact the roof log with their stone bases preserved',()=>{
 assert.equal(BAGANA_PREFABS.length,15);
 for(const spec of BAGANA_PREFABS){
  const bytes=readFileSync(new URL('..'+spec.file,import.meta.url));
  const c=measureBaganaCrown(bytes,spec);
  assert.match(c.generator,/timber v6/,'model needs correction: '+spec.id);
  assert.ok(Math.abs(c.seat-(c.logicalTop+.012))<.004,'log must contact timber: '+spec.id+' '+JSON.stringify(c));
  if(spec.form===1)assert.ok(c.top>c.logicalTop+.24,'fork tips protrude beyond effective height: '+spec.id);
  if(spec.form===2)assert.ok(c.top>=c.logicalTop+.010,'flat top touches log: '+spec.id);
  if(spec.form===3)assert.ok(c.top>c.logicalTop+.055,'saddle is raised: '+spec.id);
  const foot=measureBaganaSupport(bytes);
  assert.equal(foot.uncovered,0,'wood foot must stand on stone: '+spec.id);
  assert.ok(foot.maxGap<=.005,'no gap below post: '+spec.id);
  assert.ok(foot.maxPenetration<=.028,'no excessive penetration in stone: '+spec.id);
  assert.throws(()=>seatBaganaCrownGlb(bytes,spec),/never rebake a seated crown/);
 }
});
test('fork prongs extend beyond the logical height but support coordinates remain unchanged',()=>{
 const spec=BAGANA_PREFABS.find(x=>x.form===1&&x.woodCells===10);
 const c=measureBaganaCrown(readFileSync(new URL('..'+spec.file,import.meta.url)),spec);
 const beam={type:'roof_beam',sectionId:roofBeamId(8),rotation:0,x:0,y:spec.size[1],z:0};
 assert.equal(roofBeamBounds(beam).min[1],spec.size[1]);
 assert.ok(c.top>c.logicalTop+.24);
 assert.ok(Math.abs(c.seat-(c.logicalTop+.012))<.004);
});
test('GLB render cache invalidated for corrected meshes',()=>{
 assert.equal(BAGANA_RENDER_VERSION_V2,'17.2-bagana-wood-rock.9');
 const scene=readFileSync(new URL('../src/features/tower/prefab-scene.js',import.meta.url),'utf8');
 assert.match(scene,/BAGANA_RENDER_VERSION_V2/);
});