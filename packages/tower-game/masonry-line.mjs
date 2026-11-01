import {prefabBounds,validatePrefabPlacement} from './prefab-layout.mjs';
import {isApprovedMasonryType} from './approved-prefab.mjs';

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
 // A row repeats the exact section selected by the player.
 // Never randomize its variant or yaw; every element keeps the same footprint.
 const result=[];
 for(let i=0;i<count;i++){
  result.push({...first,
   id:i===0?first.id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
   x:first.x+(axis==='x'?direction*i*step:0),
   y:first.y,
   z:first.z+(axis==='z'?direction*i*step:0)});
 }
 return {ok:true,reason:'',sections:result,axis};
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
