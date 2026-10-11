import {performance} from 'node:perf_hooks';
import {ROCK_PACK} from '../../assets/tower/processed-rocks.mjs';
import {buildStoneProfiles} from '../../packages/tower-game/masonry-geometry.mjs';
import {packMasonryVolume} from '../../packages/tower-game/masonry-packing.mjs';
const profiles=buildStoneProfiles(ROCK_PACK);
for(const count of [2,5,15,50]){
 const blocks=Array.from({length:count},(_,i)=>({
  id:'m'+i,type:'medium',x:(i%10)*2,y:0,z:Math.floor(i/10)*2,
  sx:2,sy:2,sz:2,rotation:0,variant:i%5
 }));
 const t=performance.now();
 const r=packMasonryVolume(blocks,profiles,{spacing:.12,maxTriangles:200000});
 const record={
  count,joints:r.joints,fragments:r.fragments,candidateCells:r.candidateCells,
  stoneFilledCells:r.stoneFilledCells,
  stoneCoveragePercent:Number((100*r.stoneCoverage).toFixed(2)),
  residualFreeVolume:Number(r.residualFreeVolume.toFixed(4)),
  mortarSurfaceCells:r.mortarSurfaceCells,
  triangles:(r.stonePositions.length+r.mortarPositions.length)/9,
  truncated:r.truncated,elapsedMs:Math.round(performance.now()-t)
 };
 if(r.stoneFilledCells!==r.filledCells)throw Error('False stone volume metric');
 if(r.stoneFilledCells>r.candidateCells)throw Error('Impossible occupancy');
 if(r.stonePositions.length!==r.stoneColors.length)throw Error('Broken stone vertex colors');
 if(r.mortarPositions.length!==r.mortarColors.length)throw Error('Broken mortar vertex colors');
 console.log(JSON.stringify(record));
}
