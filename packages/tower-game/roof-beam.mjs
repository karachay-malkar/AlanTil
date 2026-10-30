/** Independent timber beam, with an adjustable overhang. 25 cm logical cells. */
import {KUNLUM_BUILD_PARCEL as SITE} from './kunlum-parcel.mjs';
export const ROOF_BEAM_VERSION='17.2-roof-beam.1';
export const roofBeamId=cells=>'roof-beam-'+cells;
export const roofBeamLength=id=>/^roof-beam-([1-9]|[1-3][0-9]|40)$/.test(id||'')?Number(id.slice(10)):null;
export const isRoofBeamId=id=>roofBeamLength(id)!==null;
export function roofBeamBounds(b){
 const n=roofBeamLength(b?.sectionId);if(n===null)throw new TypeError('Unknown roof beam');
 const size=b.rotation%2?[1,1,n]:[n,1,1];
 return {min:[b.x,b.y,b.z],max:[b.x+size[0],b.y+1,b.z+size[2]],size};
}
/** The aim marks a support point, not the beam's end. shift moves the beam along its length. */
export function positionRoofBeamAgainst(b,hit,shift=0){
 if(!hit?.block||hit.block.type!=='masonry_section'||!Number.isInteger(hit.supportTop))return null;
 const n=roofBeamLength(b.sectionId);if(n===null)return null;
 const axis=b.rotation%2?2:0;
 const position=[Math.round(hit.position[0]*4),hit.supportTop,Math.round(hit.position[2]*4)];
 position[axis]+=-Math.floor(n/2)+shift;
 return {...b,x:position[0],y:position[1],z:position[2]};
}
export function validateRoofBeamPlacement(blocks,beam,boundsOf){
 const n=roofBeamLength(beam?.sectionId);
 if(beam?.type!=='roof_beam'||n===null||beam.geometryVersion!==ROOF_BEAM_VERSION||
 beam.variant!==0||![0,1,2,3].includes(beam.rotation)||![beam.x,beam.y,beam.z].every(Number.isInteger))
  return {ok:false,reason:'Недопустимая балка'};
 const box=roofBeamBounds(beam);
 if(box.min.some(v=>v<0)||box.max[0]>SITE.widthM*4||box.max[1]>80||box.max[2]>SITE.depthM*4)
  return {ok:false,reason:'Балка за пределами участка'};
 const overlap=(a,b,k)=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k]);
 const supported=blocks.some(b=>{
  if(b.id===beam.id||b.type!=='masonry_section')return false;
  const support=boundsOf(b);
  return support.max[1]===box.min[1]&&overlap(support,box,0)>0&&overlap(support,box,2)>0;
 });
 return supported?{ok:true,reason:''}:{ok:false,reason:'Нужна точка опирания'};
}
