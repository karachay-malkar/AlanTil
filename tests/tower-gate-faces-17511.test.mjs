import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const candidate=read('assets/tower/prefabs/balkar71/placements-17_5_11.json');
const baseline=read('assets/tower/prefabs/balkar71/placements-17_5_9.json');
const dims=new Set(['1x1x1','2x2x2','2x2x3','2x3x4','4x4x4']);
test('25 face-scored recipes are genuine, deterministic, bounded instance transforms',()=>{
 assert.equal(candidate.version,'17.5.11');
 assert.equal(candidate.library,baseline.library);
 assert.deepEqual(candidate.shapes,baseline.shapes);
 assert.equal(candidate.shapes.length,486);
 assert.deepEqual(new Set(Object.keys(candidate.variants)),dims);
 let count=0,stones=0,oldDensity=0,newDensity=0,oldFace=0,newFace=0;
 const allowed=new Set(candidate.shapes);
 for(const [kind,variants] of Object.entries(candidate.variants)){
  assert.equal(variants.length,5);
  assert.equal(new Set(variants.map(x=>x.sha256)).size,5);
  for(let index=0;index<5;index++){
   const row=variants[index];
   count++;stones+=row.placement.length;
   assert.ok(row.placement.length>=1&&row.placement.length<=512);
   assert.equal(row.rocks,row.placement.length);
   assert.ok(row.occupancy>=row.beforeOccupancy-1e-5);
   assert.equal(row.faceCoverage.length,6);
   assert.ok(row.faceCoverage.every(x=>x>=0&&x<=1));
   assert.ok(Number.isFinite(row.minFaceCoverage));
   oldDensity+=row.beforeOccupancy;newDensity+=row.occupancy;
   oldFace+=Math.min(...row.beforeFaceCoverage);
   newFace+=row.minFaceCoverage;
   for(const matrix of row.placement){
    assert.equal(matrix.length,13);
    assert.ok(allowed.has(matrix[0]));
    assert.ok(matrix.slice(1).every(Number.isFinite));
   }
  }
 }
 assert.equal(count,25);
 assert.equal(stones,candidate.totalPlacements);
 assert.ok(newDensity>oldDensity,'Stone occupancy must improve');
 assert.ok(newFace>oldFace,'Exposed faces must improve');
 console.log('REAL_STONE_FACE_SCORE',JSON.stringify({
  meanDensity:newDensity/count,meanMinFace:newFace/count,
  minimumFace:Math.min(...Object.values(candidate.variants).flatMap(v=>v.map(x=>x.minFaceCoverage))),
  totalPlacements:stones}));
});
