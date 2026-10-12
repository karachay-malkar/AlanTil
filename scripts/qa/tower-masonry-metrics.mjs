import {performance} from 'node:perf_hooks';
import {ROCK_PACK} from '../../assets/tower/processed-rocks.mjs';
import {buildStoneProfiles} from '../../packages/tower-game/masonry-geometry.mjs';
import {packMasonryVolume} from '../../packages/tower-game/masonry-packing.mjs';
const profiles=buildStoneProfiles(ROCK_PACK);
for(const count of [2,5,15,50])for(const maxTriangles of [90000,200000]){
 const blocks=Array.from({length:count},(_,i)=>({
  id:'m'+i,type:'medium',x:(i%10)*2,y:0,z:Math.floor(i/10)*2,
  sx:2,sy:2,sz:2,rotation:0,variant:i%5
 }));
 const t=performance.now();
 const r=packMasonryVolume(blocks,profiles,{spacing:.12,maxTriangles});
 const record={
  count,maxTriangles,joints:r.joints,fragments:r.fragments,candidateCells:r.candidateCells,
  stoneFilledCells:r.stoneFilledCells,
  stoneCoveragePercent:Number((100*r.stoneCoverage).toFixed(2)),
  candidateFreeVolume:Number(r.candidateFreeVolume.toFixed(4)),
  stonePhysicalVolume:Number(r.stonePhysicalVolume.toFixed(4)),
  penetrationVolume:Number(r.penetrationVolume.toFixed(4)),
  selfOverlapVolume:Number(r.selfOverlapVolume.toFixed(4)),
  coverageComplete:r.coverageComplete,
  residualFreeVolume:Number(r.residualFreeVolume.toFixed(4)),
  mortarSurfaceCells:r.mortarSurfaceCells,
  triangles:(r.stonePositions.length+r.mortarPositions.length)/9,
  truncated:r.truncated,elapsedMs:Math.round(performance.now()-t)
 };
 if(r.stoneFilledCells!==r.filledCells)throw Error('Center-cell mismatch');
 if(Math.abs(r.stonePhysicalVolume+r.residualFreeVolume-r.candidateFreeVolume)>1e-5)throw Error('Volume conservation failed');
 if(r.stoneFilledCells>r.candidateCells)throw Error('Impossible occupancy');
 if((r.stonePositions.length+r.mortarPositions.length)/9>maxTriangles)throw Error('Triangle budget exceeded');
 if(r.stonePositions.length!==r.stoneColors.length)throw Error('Broken stone vertex colors');
 if(r.mortarPositions.length!==r.mortarColors.length)throw Error('Broken mortar vertex colors');
 console.log(JSON.stringify(record));
}
