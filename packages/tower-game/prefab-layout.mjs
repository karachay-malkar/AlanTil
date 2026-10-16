import {worldDimensions} from './core.mjs';
/** One section = one immutable prefabricated masonry asset. Positions are integer 25-cm cells. */
export const PREFAB_CELL_METERS=.25;
export const PREFAB_WORLD_CELLS=60;
export const PREFAB_HEIGHT_CELLS=80;
export const PREFAB_TYPES=Object.freeze([
 {id:'1x1x1',size:[1,1,1]},
 {id:'2x2x2',size:[2,2,2]},
 {id:'2x2x3',size:[2,2,3]},
 {id:'2x3x4',size:[2,3,4]},
 {id:'4x4x4',size:[4,4,4]},
 {id:'window-4x5x2',size:[4,5,2]},
 {id:'door-7x9x2',size:[7,9,2]},
 {id:'gate-18x10x2',size:[18,10,2]}
].map(t=>Object.freeze({...t,size:Object.freeze(t.size)})));
const byId=new Map(PREFAB_TYPES.map(t=>[t.id,t]));
const EPS=1e-5;
export function prefabSize(type){const s=byId.get(type)?.size;if(!s)throw new TypeError('Unknown prefabricated section');return [...s];}
export function worldToGrid(meters){if(!Number.isFinite(meters))throw new TypeError('Invalid world coordinate');return Math.round(meters/PREFAB_CELL_METERS);}
export function gridToWorld(cells){if(!Number.isFinite(cells))throw new TypeError('Invalid grid coordinate');return cells*PREFAB_CELL_METERS;}
export function snapPrefabPosition(coords){return Object.fromEntries(['x','y','z'].map(k=>[k,Math.round(Number(coords[k]))]));}
export function prefabBounds(b){
 const s=b?.type==='masonry_section'?prefabSize(b.sectionId):worldDimensions(b);
 const r=b.rotation||0;
 const d=b?.type==='masonry_section'&&r%2?[s[2],s[1],s[0]]:s;
 return {min:[b.x,b.y,b.z],max:[b.x+d[0],b.y+d[1],b.z+d[2]],size:d};
}
const overlap=(a,b,k)=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k]);
/** Union of every supporting rectangle must cover the ENTIRE footprint.
 * End-point partition handles historical fractional geometry without sampling holes.
 */
export function hasPrefabSupport(blocks,proposed){
 const a=prefabBounds(proposed);
 if(a.min[1]===0)return true;
 const supports=blocks.map(prefabBounds).filter(b=>Math.abs(b.max[1]-a.min[1])<EPS&&overlap(a,b,0)>EPS&&overlap(a,b,2)>EPS);
 if(!supports.length)return false;
 const xs=[a.min[0],a.max[0]],zs=[a.min[2],a.max[2]];
 for(const b of supports){xs.push(Math.max(a.min[0],b.min[0]),Math.min(a.max[0],b.max[0]));zs.push(Math.max(a.min[2],b.min[2]),Math.min(a.max[2],b.max[2]));}
 const xcuts=[...new Set(xs)].sort((a,b)=>a-b),zcuts=[...new Set(zs)].sort((a,b)=>a-b);
 for(let i=0;i<xcuts.length-1;i++)for(let j=0;j<zcuts.length-1;j++){
  if(xcuts[i+1]-xcuts[i]<EPS||zcuts[j+1]-zcuts[j]<EPS)continue;
  const x=(xcuts[i]+xcuts[i+1])/2,z=(zcuts[j]+zcuts[j+1])/2;
  if(!supports.some(b=>x>=b.min[0]-EPS&&x<=b.max[0]+EPS&&z>=b.min[2]-EPS&&z<=b.max[2]+EPS))return false;
 }
 return true;
}
export function validatePrefabPlacement(blocks,section,options={}){
 const maxVariants=options.maxVariants??8;
 if(!section||section.type!=='masonry_section'||!byId.has(section.sectionId)||!Number.isInteger(section.variant)||section.variant<0||section.variant>=maxVariants||!Number.isInteger(section.rotation)||section.rotation<0||section.rotation>3)
  return {ok:false,reason:'Недопустимая готовая секция'};
 if(![section.x,section.y,section.z].every(v=>Number.isFinite(v)))return{ok:false,reason:'Некорректная позиция'};
 if(![section.x,section.y,section.z].every(v=>Number.isInteger(v))&&!(options.allowLegacyOffGrid&&section.geometryVersion==='17.4.1'))return{ok:false,reason:'Секция должна быть привязана к сетке 25 см'};
 const a=prefabBounds(section);
 if(a.min.some(v=>v<0)||a.max[0]>PREFAB_WORLD_CELLS||a.max[1]>PREFAB_HEIGHT_CELLS||a.max[2]>PREFAB_WORLD_CELLS)
  return{ok:false,reason:'Секция выходит за границы участка'};
 if(blocks.some(b=>{if(b.id===section.id)return false;const c=prefabBounds(b);return [0,1,2].every(k=>overlap(a,c,k)>EPS);}))return{ok:false,reason:'Место занято'};
 if(!hasPrefabSupport(blocks,section))return{ok:false,reason:'Основание должно полностью опираться на нижние секции'};
 return{ok:true,reason:''};
}
/** Camera / touch identifies a location; only a 25-cm grid determines the result.
 * Never center-align or magnetically slide along a neighbouring section face.
 */
export function positionAgainst(section,hit){
 const n=hit?.normal||{x:0,y:1,z:0};const d=prefabBounds({...section,x:0,y:0,z:0}).size;
 const p=hit?.position||[7.5,0,7.5];
 const origin={x:worldToGrid(p[0])-Math.floor(d[0]/2),y:worldToGrid(p[1]),z:worldToGrid(p[2])-Math.floor(d[2]/2)};
 if(hit?.block){
  const b=prefabBounds(hit.block);
  if(n.x>.5)origin.x=b.max[0];else if(n.x<-.5)origin.x=b.min[0]-d[0];
  if(n.y>.5)origin.y=b.max[1];else if(n.y<-.5)origin.y=b.min[1]-d[1];
  if(n.z>.5)origin.z=b.max[2];else if(n.z<-.5)origin.z=b.min[2]-d[2];
 }else origin.y=0;
 return {...section,...snapPrefabPosition(origin)};
}
export function getPlacementGrid(section){
 const b=prefabBounds(section);
 return{stepMeters:PREFAB_CELL_METERS,origin:[...b.min],size:[...b.size],face:b.min[1]===0?'ground':'contact'};
}
export function touchingPrefabPairs(blocks){
 const result=[];
 for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++){
  const a=prefabBounds(blocks[i]),b=prefabBounds(blocks[j]);
  for(let axis=0;axis<3;axis++){
   const forward=Math.abs(a.max[axis]-b.min[axis])<EPS;
   const reverse=Math.abs(b.max[axis]-a.min[axis])<EPS;
   if(!forward&&!reverse)continue;
   const u=(axis+1)%3,v=(axis+2)%3;
   if(overlap(a,b,u)<EPS||overlap(a,b,v)<EPS)continue;
   const min=[0,1,2].map(k=>k===axis?(forward?a.max[k]:b.max[k]):Math.max(a.min[k],b.min[k]));
   const max=[0,1,2].map(k=>k===axis?min[k]:Math.min(a.max[k],b.max[k]));
   result.push({a:blocks[i].id,b:blocks[j].id,axis:['x','y','z'][axis],min,max,
    point:min.map((v,k)=>(v+max[k])/2),span:max.map((v,k)=>v-min[k]),
    aFace:forward?'+':'-',bFace:forward?'-':'+'});
  }
 }
 return result;
}