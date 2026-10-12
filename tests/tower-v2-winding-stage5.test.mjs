import test from 'node:test';
import assert from 'node:assert/strict';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {inspectDisplayWinding,repairRockDisplayWinding} from '../packages/tower-game/rock-display-winding.mjs';

test('exactly the three known inward-facing long variants need display repair',()=>{
 const bad=[];let corrected=0;
 for(const [type,items] of Object.entries(ROCK_PACK))for(let variant=0;variant<items.length;variant++){
  const mesh=originalRockMesh(items[variant],variant),sourceIndices=Array.from(mesh.indices),positions=Array.from(mesh.positions);
  const before=inspectDisplayWinding(mesh),fixed=repairRockDisplayWinding(mesh),after=inspectDisplayWinding(fixed);
  if(before.reversed)bad.push(`${type}.${variant}`);
  corrected+=Number(before.reversed);
  assert.equal(after.reversed,false,`${type}.${variant} should have outward faces`);
  assert.equal(after.inward<=after.outward,true);
  assert.deepEqual([...mesh.indices],sourceIndices,'Never mutate authoritative source faces');
  assert.deepEqual([...mesh.positions],positions,'Never mutate source vertices');
  assert.deepEqual([...fixed.positions],positions,'Display correction may alter winding only');
  assert.equal(fixed.indices.length,mesh.indices.length);
  for(let k=0;k<fixed.indices.length;k+=3){
   if(before.reversed)assert.deepEqual([...fixed.indices.slice(k,k+3)],[sourceIndices[k],sourceIndices[k+2],sourceIndices[k+1]]);
   else assert.deepEqual([...fixed.indices.slice(k,k+3)],[sourceIndices[k],sourceIndices[k+1],sourceIndices[k+2]]);
  }
 }
 assert.equal(corrected,3);assert.deepEqual(bad,['long.1','long.2','long.3']);
});
