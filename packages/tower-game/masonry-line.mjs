import {prefabBounds,validatePrefabPlacement} from './prefab-layout.mjs';
import {approvedVariantCount,isApprovedMasonryType} from './approved-prefab.mjs';

/** Pure, deterministic contiguous masonry-line planner. Grid units are 25 cm. */
export const MAX_MASONRY_LINE=60;
const mix=n=>{const v=Math.sin(n*91.23+19.8)*43758.5453;return v-Math.floor(v);};
const adjacent=(a,b)=>{
 const x=prefabBounds(a),y=prefabBounds(b);
 const overlap=(k)=>Math.min(x.max[k],y.max[k])-Math.max(x.min[k],y.min[k]);
 return overlap(1)>0&&((Math.abs(x.max[0]-y.min[0])<1e-6||Math.abs(y.max[0]-x.min[0])<1e-6)&&overlap(2)>0
 ||(Math.abs(x.max[2]-y.min[2])<1e-6||Math.abs(y.max[2]-x.min[2])<1e-6)&&overlap(0)>0);
};
function choices(base){
 const count=approvedVariantCount(base.sectionId);
 if(count<1)return [];
 const [wx,,wz]=prefabBounds(base).size;
 const rotations=[0,1,2,3].filter(rotation=>{
  const b=prefabBounds({...base,rotation});
  return b.size[0]===wx&&b.size[2]===wz;
 });
 const options=[];
 for(let variant=0;variant<count;variant++)
  for(const rotation of rotations)options.push({variant,rotation});
 return options;
}
/**
 * first and last are snapped section origins. The first is always included.
 * The last endpoint chooses axis and distance; no diagonal half-module joints.
 */
export function planMasonryLine({first,last=null,existing=[],seed=0,maxCount=MAX_MASONRY_LINE}){
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
 const options=choices(first);
 const result=[];
 for(let i=0;i<count;i++){
  const position={x:first.x+(axis==='x'?direction*i*step:0),
   y:first.y,z:first.z+(axis==='z'?direction*i*step:0)};
  const base={...first,...position,id:i===0?first.id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0')};
  if(i===0){result.push(base);continue;}
  let best=null,bestScore=Infinity;
  for(const option of options){
   const candidate={...base,...option};
   const nearest=[...existing.filter(b=>b.type==='masonry_section'&&b.sectionId===first.sectionId),...result]
    .filter(b=>adjacent(b,candidate));
   const similar=nearest.filter(b=>b.variant===option.variant).length;
   const exact=nearest.filter(b=>b.variant===option.variant&&b.rotation===option.rotation).length;
   const rotationRepeat=nearest.filter(b=>b.rotation===option.rotation).length;
   const score=similar*100+exact*40+rotationRepeat*8+mix(seed+i*41+option.variant*13+option.rotation*7);
   if(score<bestScore){bestScore=score;best=candidate;}
  }
  result.push(best||base);
 }
 return {ok:true,reason:'',sections:result,axis};
}
/** Validate the ENTIRE operation, not just the most recently selected block. */
export function checkMasonryLine(existing,sections,manifest,validateJoints=null){
 if(!Array.isArray(sections)||!sections.length||sections.length>MAX_MASONRY_LINE)
  return {ok:false,reason:'LINE_TOO_LONG'};
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
