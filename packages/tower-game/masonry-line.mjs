import {prefabBounds,validatePrefabPlacement} from './prefab-layout.mjs';
import {approvedVariantCount,isApprovedMasonryType} from './approved-prefab.mjs';

/** Pure, deterministic contiguous masonry-line planner. Grid units are 25 cm. */
export const MAX_MASONRY_LINE=60;
/**
 * first and last are snapped section origins. The first is always included.
 * The last endpoint chooses axis and distance; no diagonal half-module joints.
 */
export function planMasonryLine({first,last=null,maxCount=MAX_MASONRY_LINE}){
 if(!first||!isApprovedMasonryType(first.sectionId))
  return {ok:false,reason:'LINE_UNSUPPORTED',sections:[]};
 if(!last)return {ok:true,reason:'',sections:[first],axis:null};
 const {size}=prefabBounds(first);
 const dx=last.x-first.x,dz=last.z-first.z;
 const axis=Math.abs(dx)>=Math.abs(dz)?'x':'z';
 const step=axis==='x'?size[0]:size[2];
 const delta=axis==='x'?dx:dz;
 const direction=delta<0?-1:1;
 const count=Math.max(1,Math.round(Math.abs(delta)/step)+1);
 if(count>maxCount)return {ok:false,reason:'LINE_TOO_LONG',sections:[]};
 // Mix approved variants and safe 90-degree orientations without changing
 // the selected footprint. Stable seeded shuffle keeps a dragged preview fixed.
 const yaw=size[0]===size[2]?[0,1,2,3]:[first.rotation%2,(first.rotation%2)+2];
 const choices=[];
 for(let variant=0;variant<approvedVariantCount(first.sectionId);variant++)
  for(const rotation of yaw)choices.push({variant,rotation});
 let seed=2166136261;
 for(const char of `${first.sectionId}:${first.variant}:${first.rotation}:${first.x}:${first.y}:${first.z}`)
  seed=Math.imul(seed^char.charCodeAt(0),16777619);
 function random(){
  seed=(seed+0x6d2b79f5)|0;
  let value=seed;
  value=Math.imul(value^(value>>>15),value|1);
  value^=value+Math.imul(value^(value>>>7),value|61);
  return ((value^(value>>>14))>>>0)/4294967296;
 }
 const same=(a,b)=>a.variant===b.variant&&a.rotation===b.rotation;
 let remaining=[],previous=first;
 const result=[];
 for(let i=0;i<count;i++){
  if(i>0&&!remaining.length){
   remaining=choices.filter(choice=>i!==1||!same(choice,first));
   for(let j=remaining.length-1;j>0;j--){
    const k=Math.floor(random()*(j+1));
    [remaining[j],remaining[k]]=[remaining[k],remaining[j]];
   }
   if(same(remaining[0],previous)){
    const swap=remaining.findIndex(choice=>!same(choice,previous));
    if(swap>0)[remaining[0],remaining[swap]]=[remaining[swap],remaining[0]];
   }
  }
  const choice=i===0?first:remaining.shift();
  result.push({...first,
   variant:choice.variant,rotation:choice.rotation,
   id:i===0?first.id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
   x:first.x+(axis==='x'?direction*i*step:0),
   y:first.y,
   z:first.z+(axis==='z'?direction*i*step:0)});
  previous=choice;
 }
 return {ok:true,reason:'',sections:result,axis};
}
/** Moving a draft endpoint does not change the other anchor or any saved section. */
export function editMasonryEndpoint(first,last,index,position){
 if(!first||!position||!Number.isInteger(position.x)||!Number.isInteger(position.z))
  return {first,last};
 if(index===0)return {first:{...first,x:position.x,z:position.z},last};
 if(index===1&&last)return {first,last:{...last,x:position.x,z:position.z}};
 return {first,last};
}
/** Rewind: remove end first; the next undo releases the start for a new tap. */
export function undoMasonryEndpoint(first,last){
 return last?{first,last:null}:{first:null,last:null};
}
/** Validate the ENTIRE operation, not just the most recently selected block. */
export function checkMasonryLine(existing,sections,manifest,validateJoints=null){
 if(!Array.isArray(sections)||!sections.length||sections.length>MAX_MASONRY_LINE)
  return {ok:false,reason:'LINE_TOO_LONG'};
 if(existing.length+sections.length>250)return {ok:false,reason:'TOWER_SECTION_LIMIT'};
 const all=[...existing];
 for(const block of sections){
  const valid=validatePrefabPlacement(all,block);
  if(!valid.ok)return valid;
  all.push(block);
 }
 if(validateJoints){
  const joined=validateJoints(all.filter(b=>b.type==='masonry_section'),manifest);
  if(!joined.ok)return joined;
 }
 return {ok:true,reason:''};
}
