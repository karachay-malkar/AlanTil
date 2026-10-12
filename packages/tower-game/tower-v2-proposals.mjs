/**
 * Read-only, GRIDLESS preview for AlanTil 17.1.
 * Not a trusted server authority, no save, payments or mutation.
 * Coordinates use physical meters internally and the 25cm CELL scale only
 * when converting back to the legacy scene's rendering coordinate convention.
 */
import {ROCK_PACK} from '../../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from './rock-shapes.mjs';
import {GRID_SIZE,HEIGHT_LIMIT,STONE_CONFIGURATIONS} from './core.mjs';
import {stoneMeshFromAuthored,bodyForTowerBlock,towerBlockFromBody,worldStoneDimensions,validateRockType,CELL_METERS} from './stone-mesh-adapter.mjs';
import {findPlacement,checkPlacement,POLICY} from './stone-placement-v2.mjs';

const cachedMeshes=new Map();
const category=t=>t==='stone'?'small':t;
function originalFor(block){
 const collection=ROCK_PACK[category(block.type)],variant=block.variant||0;
 if(!collection||!Number.isInteger(variant)||variant<0||variant>=collection.length)throw new TypeError('Invalid authored stone variant');
 const key=block.type+':'+variant;
 if(!cachedMeshes.has(key))cachedMeshes.set(key,originalRockMesh(collection[variant],variant));
 return cachedMeshes.get(key);
}
function validStone(block){
 if(!block||!validateRockType(block.type)||!Number.isInteger(block.rotation)||block.rotation<0||block.rotation>7||
    ![block.x,block.y,block.z].every(Number.isFinite)||
    ![block.sx,block.sy,block.sz].every(Number.isInteger))return false;
 const allowed=STONE_CONFIGURATIONS[block.type]||[];
 return allowed.some(d=>d[0]===block.sx&&d[1]===block.sy&&d[2]===block.sz);
}
/** Geometry results are diagnostic only; caller must NEVER submit them to v1 RPC. */
export function resolveTowerV2Proposal({stone,camera,blocks=[],mode='auto',maxCandidates=24}={}){
 if(!validStone(stone))return{ok:false,reason:'invalid selected stone'};
 if(!Array.isArray(blocks)||blocks.some(b=>!validStone(b))){
  if(Array.isArray(blocks)&&blocks.some(b=>b&&!validateRockType(b.type)))return{ok:false,reason:'mixed elements unsupported in V2 preview'};
  return{ok:false,reason:'invalid legacy geometry'};
 }
 if(!Array.isArray(camera?.target)||camera.target.length!==3||!camera.target.every(Number.isFinite))return{ok:false,reason:'invalid camera'};
 if(!['ground','upper','auto'].includes(mode)||!Number.isInteger(maxCandidates)||maxCandidates<1||maxCandidates>60)return{ok:false,reason:'invalid search policy'};
 if(camera.target[0]<0||camera.target[0]>GRID_SIZE*CELL_METERS||camera.target[2]<0||camera.target[2]>GRID_SIZE*CELL_METERS)return{ok:false,reason:'outside tower footprint'};
 try{
  const base=stoneMeshFromAuthored(originalFor(stone),stone);
  const old=blocks.map(b=>bodyForTowerBlock(originalFor(b),b));
  const forward=Array.isArray(camera.forward)?camera.forward:[0,0,1];
  const yaw=Math.atan2(Number(forward[2])||0,Number(forward[0])||1);
  const result=findPlacement(base,old,{x:camera.target[0],z:camera.target[2],yaw,mode,fixedOrientation:true},{...POLICY,maxCandidates});
  if(!result.ok)return{ok:false,reason:result.reason,candidates:result.candidates,timeMs:result.timeMs};
  const proposed=towerBlockFromBody(result.body,stone);
  const dims=worldStoneDimensions(proposed);
  if(proposed.x<0||proposed.z<0||proposed.x+dims[0]>GRID_SIZE||proposed.z+dims[2]>GRID_SIZE||proposed.y+dims[1]>HEIGHT_LIMIT)return{ok:false,reason:'outside tower envelope'};
  const confirmed=bodyForTowerBlock(originalFor(proposed),proposed);
  const quality=checkPlacement(confirmed,old);
  if(!quality.ok)return{ok:false,reason:quality.reason};
  return{ok:true,block:proposed,metrics:{...quality,area:Number(quality.area.toFixed(6)),margin:Number(quality.margin.toFixed(6))},candidates:result.candidates,timeMs:result.timeMs,experimental:true};
 }catch(e){return{ok:false,reason:'mesh validation failed: '+String(e?.message||e)};}
}
