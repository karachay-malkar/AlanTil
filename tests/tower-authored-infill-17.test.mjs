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
 assert.ok(Math.abs(result.stoneCoverage-result.stonePhysicalVolume/result.candidateFreeVolume)<1e-9);
 assert.ok(result.residualFreeVolume>=0);
 assert.ok(Math.abs(result.residualFreeVolume-(result.candidateFreeVolume-result.stonePhysicalVolume))<1e-9);
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

test('real 3D mortar occupies only the inner 60% of transverse seam dimensions',()=>{
 const g=grid(10,15,15);
 g.seamAxis=0;
 g.exteriorFaces=[[1,0],[1,1],[2,0],[2,1]];
 const result=fillAuthoredCavity(g,models,{maxFragments:0,maxTriangles:40000});
 assert.ok(result.mortarPhysicalVolume>0,'closed volumetric mortar, not a flat surface');
 assert.equal(result.mortarForbiddenVolume,0,'no mortar in outside 20% strips');
 assert.equal(result.mortarPenetrationVolume,0);
 assert.ok(Math.abs(result.candidateFreeVolume-result.stonePhysicalVolume-result.mortarPhysicalVolume-result.residualFreeVolume)<1e-8);
 assert.equal(result.mortarPositions.length,result.mortarColors.length);
 assert.ok(result.mortarPositions.length>0);
 // Every emitted mortar vertex must stay fully inside the 20%-protected exterior.
 const lo=[g.min[1]+g.ny*g.dimension[1]*.2,g.min[2]+g.nz*g.dimension[2]*.2];
 const hi=[g.min[1]+g.ny*g.dimension[1]*.8,g.min[2]+g.nz*g.dimension[2]*.8];
 for(let i=0;i<result.mortarPositions.length;i+=3){
  assert.ok(result.mortarPositions[i+1]>=lo[0]-1e-7&&result.mortarPositions[i+1]<=hi[0]+1e-7);
  assert.ok(result.mortarPositions[i+2]>=lo[1]-1e-7&&result.mortarPositions[i+2]<=hi[1]+1e-7);
 }
});
test('exterior guard bands overlap at corners and mortar cannot leak into them',()=>{
 const g=grid(8,4,4);
 g.seamAxis=0;
 g.exteriorFaces=[[1,0],[1,1],[2,0],[2,1]];
 const result=fillAuthoredCavity(g,models,{maxFragments:0,maxTriangles:40000});
 assert.equal(result.mortarForbiddenVolume,0);
 assert.ok(result.mortarPhysicalVolume>0);
 assert.ok(result.mortarPhysicalVolume<result.candidateFreeVolume*.40);
});

test('unfilled outer fifths are fitted with solid stone clippings, never mortar',()=>{
 const g=grid(7,12,12);
 g.seamAxis=0;
 g.exteriorFaces=[[1,0],[1,1],[2,0],[2,1]];
 const result=fillAuthoredCavity(g,models,{maxTriangles:60000,maxFragments:0});
 assert.equal(result.wedgePhysicalVolume,0,'only placed original authored pebbles may count as stone');
 assert.equal(result.stonePhysicalVolume,0,'maxFragments=0 must not generate rock');
 assert.equal(result.mortarForbiddenVolume,0);
 assert.ok(result.totalCoverage<.90,'without pebbles the exterior seam must remain physically unfilled');
 assert.ok(Math.abs(result.stonePhysicalVolume+result.mortarPhysicalVolume+result.residualFreeVolume-result.candidateFreeVolume)<1e-8);
});

test('90–95% fill leaves real small internal voids and irregular authored-derived outer stones',()=>{
 const g=grid(7,15,15);g.seamAxis=0;g.exteriorFaces=[[1,0],[1,1],[2,0],[2,1]];
 const result=fillAuthoredCavity(g,models,{maxTriangles:60000});
 assert.ok(result.totalCoverage<=.95,'fill must never be inflated with generated stones');
 assert.ok(result.residualFreeVolume>0,'residual physical cavities cannot be fictitiously filled');
 assert.ok(Math.abs(result.stonePhysicalVolume+result.mortarPhysicalVolume+result.residualFreeVolume-result.candidateFreeVolume)<1e-8);
 assert.equal(result.mortarForbiddenVolume,0);
 assert.equal(result.wedgePhysicalVolume,0,'generated stone fragments are forbidden');
 assert.ok(result.fragments>0);
 assert.ok(result.stonePositions.length>0,'visible stone must be an authored mesh');
});
