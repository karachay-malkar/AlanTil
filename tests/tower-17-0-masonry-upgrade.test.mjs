import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATALOG,STONE_CONFIGURATIONS,PURCHASABLE_STONE_TYPES,worldDimensions,validatePlacement,encodeTower,decodeTower} from '../packages/tower-game/core.mjs';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {adaptRockMesh,expandInfillRock,inspectRockMesh} from '../packages/tower-game/rock-adaptation.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const dims=[[2,1,1],[2,2,1],[2,2,2],[3,1,1],[3,2,1],[4,1,1],[4,2,1],[5,1,1],[5,2,1],[2,3,3],[2,3,4],[3,4,4]];
test('the 12 purchasable stone cards use exactly the approved cell sizes',()=>{
 assert.deepEqual(PURCHASABLE_STONE_TYPES,['medium','long','big']);
 assert.deepEqual(Object.values(STONE_CONFIGURATIONS).slice(1).flat(),dims);
 assert.deepEqual(STONE_CONFIGURATIONS.stone,[[1,1,1]]);
 assert.equal(CATALOG.medium.price,4);assert.equal(CATALOG.long.price,8);assert.equal(CATALOG.big.price,24);
 for(const t of PURCHASABLE_STONE_TYPES)for(const [sx,sy,sz] of STONE_CONFIGURATIONS[t])
  assert.equal(validatePlacement([],{type:t,id:'a',x:0,y:0,z:0,sx,sy,sz,rotation:0}).ok,true);
 assert.equal(validatePlacement([],{type:'big',id:'a',x:0,y:0,z:0,sx:3,sy:3,sz:3,rotation:0}).ok,false);
});
test('2×3×4 has all six spatial permutations and 0–5 historic rotations do not change',()=>{
 const input={type:'big',x:1,y:0,z:2,sx:2,sy:3,sz:4,id:'a'};
 const sizes=[0,1,2,3,4,5,6,7].map(rotation=>worldDimensions({...input,rotation}));
 assert.deepEqual(sizes.slice(0,6),[[2,3,4],[4,3,2],[2,3,4],[4,3,2],[3,2,4],[2,4,3]]);
 assert.deepEqual(sizes[6],[3,4,2]);assert.deepEqual(sizes[7],[4,2,3]);
 assert.equal(new Set(sizes.map(x=>x.join())).size,6);
 for(const rotation of [6,7])assert.equal(validatePlacement([],{...input,rotation}).ok,true);
 for(const rotation of [6,7])assert.equal(validatePlacement([],{...input,type:'stone',sx:1,sy:1,sz:1,rotation}).ok,false);
});
test('legacy stone ID, rotation, refund metadata and serialized catalog ordering are immutable',()=>{
 const legacy={id:'historic',type:'stone',x:0,y:0,z:0,sx:1,sy:1,sz:1,rotation:0,paidCurrency:'silver',paidAmount:1};
 const modern={id:'modern',type:'big',x:2,y:0,z:2,sx:2,sy:3,sz:4,rotation:7,variant:4,paidCurrency:'gold',paidAmount:3};
 assert.deepEqual(decodeTower(encodeTower([legacy,modern])),[legacy,modern]);
 assert.deepEqual(encodeTower([legacy,modern]).map(row=>row[1]),[0,3]);
});
test('source rock silhouettes stay irregular while extension remains inside the cell',()=>{
 const counts={};for(const [type,arr]of Object.entries(ROCK_PACK)){
  counts[type]=arr.length;
  for(let i=0;i<arr.length;i++){
   const source=originalRockMesh(arr[i],i),adapted=adaptRockMesh(source);
   const result=inspectRockMesh(adapted);
   assert.equal(result.invalidTriangles,0,type+' '+i);
   assert.equal(result.outOfBounds,0,type+' '+i);
   assert.ok(result.triangles>=source.indices.length/3);
   assert.ok(result.maxEdge<=.185,type+' '+i);
  }
 }
 assert.deepEqual(counts,{small:7,medium:5,long:4,big:7});
});
test('catalog never starts placement on pointer drag, and keeps an existing ghost',()=>{
 const ui=read('src/features/tower/index.js');
 assert.match(ui,/PURCHASABLE_STONE_TYPES\.flatMap/);
 assert.match(ui,/const keepGhost=s\.tool==='place'&&s\.positionTouched/);
 assert.match(ui,/s\.positionTouched=keepGhost/);
 assert.doesNotMatch(ui,/dragging=|pointermove.*pickAt|function stopDragging/);
 const css=read('src/features/tower/tower.css');
 assert.match(css,/touch-action:pan-x/);
});
test('database disallows new 1×1×1 purchases without rewriting historic elements',()=>{
 const sql=read('supabase/migrations/20261012010000_tower_12_configurations_and_orientations.sql');
 assert.match(sql,/when 'stone' then false/);
 assert.match(sql,/\(dx,dy,dz\) in \(\(2,1,1\),\(2,2,1\),\(2,2,2\)\)/);
 assert.match(sql,/\(dx,dy,dz\) in \(\(2,3,3\),\(2,3,4\),\(3,4,4\)\)/);
 assert.match(sql,/if e->>10='silver'/);
 assert.match(sql,/OPERATION_ID_REUSED/);
 assert.match(sql,/p_action='remove'/);
 assert.match(sql,/rot>5 and typ not in/);
});

test('seven authored small stones may expand into contacts without cubic replacement',()=>{
 const signatures=new Set();
 for(let i=0;i<ROCK_PACK.small.length;i++){
  const original=originalRockMesh(ROCK_PACK.small[i],i);
  const expanded=expandInfillRock(original);
  assert.equal(expanded.indices.length,original.indices.length);
  assert.equal(expanded.positions.length,original.positions.length);
  const metric=mesh=>Array.from(mesh.positions).reduce((sum,v)=>sum+Math.abs(v),0)/mesh.positions.length;
  assert.ok(metric(expanded)>metric(original)*1.15,'enlarge actual irregular stone contours');
  const diagnostics=inspectRockMesh(expanded);
  assert.equal(diagnostics.invalidTriangles,0);
  assert.equal(diagnostics.outOfBounds,0);
  signatures.add(Buffer.from(expanded.positions.buffer).toString('base64'));
 }
 assert.equal(signatures.size,7);
});

test('subdivided authored main stones acquire real nonplanar rock relief',()=>{
 for(const category of ['medium','long','big']){
  const source=originalRockMesh(ROCK_PACK[category][0]);
  const flat=adaptRockMesh(source,{relief:0});
  const sculpted=adaptRockMesh(source);
  assert.deepEqual(sculpted.indices,flat.indices);
  assert.equal(sculpted.positions.length,flat.positions.length);
  const originalCount=source.positions.length;
  let changed=0;
  for(let i=originalCount;i<flat.positions.length;i++)if(Math.abs(flat.positions[i]-sculpted.positions[i])>1e-4)changed++;
  assert.ok(changed>=15,category+' facets retain nonplanar chipped rock relief');
  assert.equal(inspectRockMesh(sculpted).invalidTriangles,0);
  assert.equal(inspectRockMesh(sculpted).outOfBounds,0);
 }
});
