/** Build deterministic, certified V2 visual surfaces and source-only infill.
 * Heavy triangle ray casts and warps run inside the masonry Web Worker.
 * The returned fitted positions are RENDER DATA, never saved/physical blocks.
 */
import {ROCK_PACK} from '../../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from './rock-shapes.mjs';
import {repairRockDisplayWinding} from './rock-display-winding.mjs';
import {adaptRockMesh} from './rock-adaptation.mjs';
import {bodyForTowerBlock} from './stone-mesh-adapter.mjs';
import {fitV2DisplayMesh} from './masonry-v2-fit.mjs';
import {packV2AuthoredInfill} from './masonry-v2-authored.mjs';
import {certifiedV2StretchBudgets,V2_MASONRY_POLICY} from './masonry-v2-envelope.mjs';

const kinds=new Set(['stone','medium','long','big']);
const valid=b=>b&&kinds.has(b.type)&&typeof b.id==='string'&&
 [b.sx,b.sy,b.sz,b.x,b.y,b.z,b.rotation,b.variant].every(Number.isFinite)&&
 Number.isInteger(b.rotation)&&b.rotation>=0&&b.rotation<=7&&
 Number.isInteger(b.variant)&&b.variant>=0&&
 ROCK_PACK[b.type==='stone'?'small':b.type]?.[b.variant];
const compare=(a,b)=>String(a.id).localeCompare(String(b.id));

export function buildV2CertifiedPresentation(blocks,options={}){
 if(!Array.isArray(blocks)||blocks.length>250)throw new RangeError('Too many V2 stones');
 const started=performance.now();
 const entries=blocks.filter(valid).sort(compare).map(block=>{
  const key=block.type==='stone'?'small':block.type;
  const original=originalRockMesh(ROCK_PACK[key][block.variant],block.variant);
  const display=adaptRockMesh(repairRockDisplayWinding(original));
  return {block,original,display,body:bodyForTowerBlock(original,block)};
 });
 const contract=certifiedV2StretchBudgets(entries.map(e=>e.body));
 const fitted=[];const renderBodies=new Map();let movedVertices=0,maxMoveM=0;
 for(let i=0;i<entries.length;i++){
  const {block,display,body}=entries[i];const budget=contract.limits[i];
  if(budget<=.000001)continue;
  const near=[];
  for(let j=0;j<entries.length;j++)if(j!==i){
   const other=entries[j].body;
   if([0,1,2].every(axis=>other.bbox.max[axis]+.16>=body.bbox.min[axis]&&other.bbox.min[axis]-.16<=body.bbox.max[axis]))near.push(other);
  }
  if(!near.length)continue;
  const fit=fitV2DisplayMesh(display,block,body,near,{maxStretchM:budget});
  if(!fit.movedVertices||!fit.maxMoveM)continue;
  const fittedBody=bodyForTowerBlock({...display,positions:fit.positions},block);
  // Never deform any authored surface through the ground plane. The source
  // hull is still the authoritative server collision and support geometry.
  if(fittedBody.bbox.min[1]<-.0005)continue;
  fitted.push({id:block.id,positions:fit.positions,movedVertices:fit.movedVertices,
   maxMoveM:fit.maxMoveM,certifiedBudgetM:budget});
  renderBodies.set(block.id,fittedBody);
  movedVertices+=fit.movedVertices;maxMoveM=Math.max(maxMoveM,fit.maxMoveM);
 }
 const infill=packV2AuthoredInfill(blocks,{...options,renderBodies});
 return {...infill,fits:fitted,movedVertices,maxMoveM,
  masonryContractVersion:contract.policyVersion,
  blockedFitPairs:contract.blockedPairs,certifiedFitPairs:contract.certifiedPairs,
  minimumAxisGapM:contract.minimumAxisGapM,
  maxStretchM:V2_MASONRY_POLICY.maxStretchM,
  computeMs:performance.now()-started};
}
