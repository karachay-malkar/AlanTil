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
 assert.ok(result.candidateCells>result.stoneFilledCells);
 assert.equal(result.filledCells,result.stoneFilledCells);
 assert.equal(result.stoneCoverage,result.stoneFilledCells/result.candidateCells);
 assert.ok(result.residualFreeVolume>0);
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
