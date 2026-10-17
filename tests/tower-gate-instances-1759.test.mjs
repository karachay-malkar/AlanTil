import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const recipes=read('assets/tower/prefabs/balkar71/placements-17_5_9.json');
const old=read('assets/tower/prefabs/balkar71/placements-17_5_5.json');
const report=read('assets/tower/prefabs/gate-stone-17_5_4-metrics.json');
const kinds=['1x1x1','2x2x2','2x2x3','2x3x4','4x4x4'];
test('all 486 approved source gate rocks remain addressed by fixed 25 instance recipes',()=>{
 assert.equal(recipes.version,'17.5.9');
 assert.equal(recipes.shapes.length,486);
 assert.equal(new Set(recipes.shapes).size,486);
 assert.ok(recipes.shapes.some(n=>n.startsWith('GATE_MAIN_')));
 assert.ok(recipes.shapes.some(n=>n.startsWith('GATE_CHINKING_')));
 assert.equal(Object.keys(recipes.variants).length,5);
 let sum=0;
 const valid=new Set(recipes.shapes);
 for(const kind of kinds){
  const variants=recipes.variants[kind];
  assert.equal(variants.length,5);
  const unique=new Set();
  for(let i=0;i<variants.length;i++){
   const v=variants[i];sum+=v.rocks;
   assert.equal(v.rocks,v.placement.length);
   assert.ok(v.rocks>0&&v.rocks<=512);
   unique.add(v.sha256);
   assert.equal(v.sourceApprovedDensity,report.types[kind][i].density);
   assert.ok(v.faceCoverage.length===6);
   for(const item of v.placement){
    assert.ok(valid.has(item[0]));
    assert.equal(item.length,13);
    assert.ok(item.slice(1).every(Number.isFinite));
    // Only a rigid rotation plus ONE uniform scale is permitted:
    // no cubic shearing, axis stretching or runtime mesh deformation.
    const rows=[[item[1],item[2],item[3]],[item[5],item[6],item[7]],[item[9],item[10],item[11]]];
    const squared=rows.map(r=>r.reduce((s,x)=>s+x*x,0));
    assert.ok(Math.max(...squared)-Math.min(...squared)<1e-4);
    for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){
     const dot=rows[a].reduce((s,x,j)=>s+x*rows[b][j],0);
     assert.ok(Math.abs(dot)<1e-4,'not a rigid stone rotation');
    }
   }
  }
  assert.equal(unique.size,5);
 }
 assert.equal(recipes.totalPlacements,sum);
 assert.equal(sum,2880);
});
test('existing 17.5.5 tower saves keep the unmodified old shapes and placements',()=>{
 assert.equal(old.version,'17.5.5');
 assert.equal(old.shapes.length,63);
 assert.equal(old.totalPlacements,913);
 const compact=readFileSync(new URL('../packages/tower-game/compact-stone-prefab.mjs',import.meta.url),'utf8');
 assert.match(compact,/COMPACT_STONE_VERSION='17\.5\.5'/);
});
