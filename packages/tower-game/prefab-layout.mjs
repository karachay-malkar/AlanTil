import {worldDimensions} from './core.mjs';
/** Prebuilt section placement. Pure envelope checks; does not alter authored rock meshes. */
export const PREFAB_CELL_METERS=.25;
export const PREFAB_WORLD_CELLS=60;
export const PREFAB_HEIGHT_CELLS=80;
export const PREFAB_TYPES=Object.freeze([
 {id:'1x1x1',size:[1,1,1]},
 {id:'2x2x2',size:[2,2,2]},
 {id:'2x2x3',size:[2,2,3]},
 {id:'2x3x4',size:[2,3,4]},
 {id:'4x4x4',size:[4,4,4]}
].map(t=>Object.freeze({...t,size:Object.freeze(t.size)})));
const byId=new Map(PREFAB_TYPES.map(t=>[t.id,t]));
export function prefabSize(type){const s=byId.get(type)?.size;if(!s)throw new TypeError('Unknown prefabricated section');return [...s];}
export function prefabBounds(b){
 const s=b?.type==='masonry_section'?prefabSize(b.sectionId):worldDimensions(b);
 const r=b.rotation||0;
 const d=b?.type==='masonry_section'&&r%2?[s[2],s[1],s[0]]:s;
 return {min:[b.x,b.y,b.z],max:[b.x+d[0],b.y+d[1],b.z+d[2]],size:d};
}
const overlap=(a,b,k)=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k]);
export function hasPrefabSupport(blocks,proposed){
 const a=prefabBounds(proposed);
 if(a.min[1]===0)return true;
 const candidates=blocks.filter(b=>{const x=prefabBounds(b);return Math.abs(x.max[1]-a.min[1])<1e-4;});
 if(!candidates.length)return false;
 // Samples detect false support from a single tiny corner. Server must use authoritative check.
 let supported=0;
 for(let i=0;i<7;i++)for(let j=0;j<7;j++){
  const x=a.min[0]+(i+.5)/7*a.size[0],z=a.min[2]+(j+.5)/7*a.size[2];
  if(candidates.some(b=>{const p=prefabBounds(b);return x>=p.min[0]-1e-4&&x<=p.max[0]+1e-4&&z>=p.min[2]-1e-4&&z<=p.max[2]+1e-4;}))supported++;
 }
 return supported>=35;
}
export function validatePrefabPlacement(blocks,section){
 if(!section||section.type!=='masonry_section'||!byId.has(section.sectionId)||!Number.isInteger(section.variant)||section.variant<0||section.variant>3||!Number.isInteger(section.rotation)||section.rotation<0||section.rotation>3)
  return {ok:false,reason:'Недопустимая готовая секция'};
 if(![section.x,section.y,section.z].every(Number.isFinite))return{ok:false,reason:'Некорректное положение'};
 const a=prefabBounds(section);
 if(a.min.some(v=>v<0)||a.max[0]>PREFAB_WORLD_CELLS||a.max[1]>PREFAB_HEIGHT_CELLS||a.max[2]>PREFAB_WORLD_CELLS)
  return {ok:false,reason:'Секция выходит за границы участка'};
 if(blocks.some(b=>{if(b.id===section.id)return false;const c=prefabBounds(b);return [0,1,2].every(k=>overlap(a,c,k)>1e-4);}))return{ok:false,reason:'Место занято'};
 if(!hasPrefabSupport(blocks,section))return{ok:false,reason:'Нужна опора под секцией'};
 return{ok:true,reason:''};
}
/** The camera-facing contact side is selected, not a hidden grid cell. */
export function positionAgainst(section,hit){
 const normal=hit?.normal||{x:0,y:1,z:0};const d=prefabBounds({...section,x:0,y:0,z:0}).size;
 if(hit?.block){
  const b=prefabBounds(hit.block);
  const origin={x:(b.min[0]+b.max[0]-d[0])/2,y:b.min[1],z:(b.min[2]+b.max[2]-d[2])/2};
  if(normal.x>0)origin.x=b.max[0];else if(normal.x<0)origin.x=b.min[0]-d[0];
  if(normal.y>0)origin.y=b.max[1];else if(normal.y<0)origin.y=b.min[1]-d[1];
  if(normal.z>0)origin.z=b.max[2];else if(normal.z<0)origin.z=b.min[2]-d[2];
  return{...section,...origin};
 }
 const p=hit?.position||[7.5,0,7.5];
 return{...section,x:p[0]/PREFAB_CELL_METERS-d[0]/2,y:0,z:p[2]/PREFAB_CELL_METERS-d[2]/2};
}
export function touchingPrefabPairs(blocks){
 const result=[];
 for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++){
  const a=prefabBounds(blocks[i]),b=prefabBounds(blocks[j]);
  for(let axis=0;axis<3;axis++){
   if(Math.abs(a.max[axis]-b.min[axis])>1e-4&&Math.abs(b.max[axis]-a.min[axis])>1e-4)continue;
   const u=(axis+1)%3,v=(axis+2)%3;
   if(overlap(a,b,u)<=.02||overlap(a,b,v)<=.02)continue;
   result.push({a:blocks[i].id,b:blocks[j].id,axis:['x','y','z'][axis],
    point:[0,1,2].map(k=>k===axis?Math.abs(a.max[k]-b.min[k])<1e-4?a.max[k]:b.max[k]:(Math.max(a.min[k],b.min[k])+Math.min(a.max[k],b.max[k]))/2),
    span:[0,1,2].map(k=>k===axis?0:Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k]))});
  }
 }
 return result;
}
