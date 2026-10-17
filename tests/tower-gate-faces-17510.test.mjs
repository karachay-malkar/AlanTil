import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const raw=read('assets/tower/prefabs/balkar71/placements-17_5_9.json');
const fixed=read('assets/tower/prefabs/balkar71/placements-17_5_10.json');
test('25 face-packed variants only use the same 486 actual gate rocks and fixed matrices',()=>{
 assert.equal(fixed.version,'17.5.10');
 assert.deepEqual(fixed.shapes,raw.shapes);
 assert.equal(fixed.shapes.length,486);
 assert.deepEqual(Object.keys(fixed.variants),Object.keys(raw.variants));
 let before=0,after=0,minBefore=0,minAfter=0,rocks=0;
 for(const [kind,variants] of Object.entries(fixed.variants)){
  assert.equal(variants.length,5);
  assert.equal(new Set(variants.map(r=>r.sha256)).size,5);
  variants.forEach((r,i)=>{
   assert.ok(r.rocks<=512&&r.rocks>0);
   assert.equal(r.rocks,r.placement.length);
   assert.equal(r.faceCoverage.length,6);
   assert.equal(r.beforeFaceCoverage.length,6);
   assert.ok(Math.abs(r.beforeOccupancy-raw.variants[kind][i].occupancy)<.00006);
   assert.ok(r.occupancy>=r.beforeOccupancy);
   assert.ok(r.placement.every(p=>p.length===13&&fixed.shapes.includes(p[0])&&p.slice(1).every(Number.isFinite)));
   before+=r.beforeOccupancy;after+=r.occupancy;
   minBefore+=Math.min(...r.beforeFaceCoverage);
   minAfter+=r.minFaceCoverage;
   rocks+=r.rocks;
  });
 }
 assert.ok(after>before,'actual convex-voxel occupancy must improve');
 assert.ok(minAfter>minBefore,'six-face coverage must improve on average');
 assert.equal(rocks,fixed.totalPlacements);
 console.log('FACE_PACK_25_MEAN_FILL',after/25,'MEAN_WORST_FACE',minAfter/25,'STONES',rocks);
});
