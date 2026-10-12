import test from 'node:test';
import assert from 'node:assert/strict';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {fillAuthoredCavity} from '../packages/tower-game/masonry-authored-infill.mjs';
const models=ROCK_PACK.small.map((source,i)=>originalRockMesh(source,i));
const grid=(nx=7,ny=6,nz=3)=>({nx,ny,nz,stride:nx*ny,min:[0,0,0],dimension:[.12,.12,.12],mask:new Uint8Array(nx*ny*nz).fill(1)});
test('all seven genuine authored small stones enter the packer',()=>{
 assert.equal(models.length,7);
 const result=fillAuthoredCavity(grid(),models);
 assert.equal(result.modelsConsidered,7);
 assert.ok(result.fragments>0);
 assert.equal(result.stonePositions.length,result.stoneColors.length);
 assert.equal(result.stonePositions.length%9,0);
 assert.equal(result.mortarPositions.length,result.mortarColors.length);
 assert.ok(result.stoneCoverage>0&&result.stoneCoverage<=1);
});
test('stone volume is measured independently of dark mortar, never reported as fake full coverage',()=>{
 const result=fillAuthoredCavity(grid(7,6,3),models);
 assert.ok(result.candidateCells>=result.stoneFilledCells);
 assert.equal(result.filledCells,result.stoneFilledCells);
 assert.equal(result.stoneCoverage,result.stoneFilledCells/result.candidateCells);
 assert.ok(result.residualFreeVolume>=0);
 assert.ok(Math.abs(result.residualFreeVolume-(result.candidateCells-result.stoneFilledCells)*(.12**3))<1e-10);
 assert.ok(result.mortarSurfaceCells>=0);
});
test('excluded opening voxels and empty cavities cannot be purchased or filled',()=>{
 const g=grid();
 g.mask.fill(0);
 assert.equal(fillAuthoredCavity(g,models).fragments,0);
 assert.equal(fillAuthoredCavity(g,models).stoneCoverage,0);
 g.mask.fill(1);for(let z=0;z<g.nz;z++)for(let y=0;y<g.ny;y++)g.mask[3+g.nx*y+g.stride*z]=0;
 const result=fillAuthoredCavity(g,models);
 assert.ok(result.candidateCells<g.mask.length);
 assert.ok(result.stoneFilledCells<=result.candidateCells);
});

test('mortar surface normals match all six grid directions',()=>{
 const result=fillAuthoredCavity(grid(1,1,1),models,{maxFragments:0});
 assert.equal(result.mortarPositions.length,6*6*3);
 const expected=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
 for(let f=0;f<6;f++){
  const i=f*18,p=result.mortarPositions;
  const a=p.slice(i,i+3),b=p.slice(i+3,i+6),c=p.slice(i+6,i+9);
  const u=b.map((v,k)=>v-a[k]),v=c.map((value,k)=>value-a[k]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  assert.ok(n.reduce((sum,value,k)=>sum+value*expected[f][k],0)>0,'face '+f+' normal');
  const axis=Math.floor(f/2),boundary=f%2===0?0:.12;
  for(const index of [i,i+3,i+6])assert.ok(Math.abs(p[index+axis]-boundary)<1e-8,'face '+f+' plane');
 }
});
test('stone fragment budget exhaustion is explicit and never counts mortar as stone',()=>{
 const result=fillAuthoredCavity(grid(7,6,3),models,{maxFragments:0});
 assert.equal(result.truncated,true);
 assert.equal(result.fragments,0);
 assert.equal(result.stoneFilledCells,0);
 assert.equal(result.stoneCoverage,0);
 assert.ok(Math.abs(result.residualFreeVolume-result.candidateCells*.12**3)<1e-10);
});

test('subvoxel volume measurements separate stone, residual and penetration',()=>{
 const result=fillAuthoredCavity(grid(7,6,3),models);
 const expected=7*6*3*.12**3;
 assert.ok(Math.abs(result.candidateFreeVolume-expected)<1e-9);
 assert.ok(result.stonePhysicalVolume>0&&result.stonePhysicalVolume<=result.candidateFreeVolume);
 assert.ok(Math.abs(result.residualFreeVolume+result.stonePhysicalVolume-result.candidateFreeVolume)<1e-9);
 assert.ok(Math.abs(result.stoneCoverage-result.stonePhysicalVolume/result.candidateFreeVolume)<1e-9);
 assert.equal(result.mortarPhysicalVolume,0,'surface-only dark backing must never count as solid mortar');
 assert.equal(result.penetrationVolume,0);
});
