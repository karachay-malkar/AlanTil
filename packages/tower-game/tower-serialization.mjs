/** Stable schema-v3 representation. Payment fields belong to the server only. */
import {SECTION_GEOMETRY_VERSION,sectionEnvelope} from './section-masonry.mjs';
export const TOWER_SECTION_SCHEMA_VERSION=3;
const CELL_METERS=.25;
const modelFamily=type=>type==='stone'?'small':type;
const vector=(arr,n)=>Array.isArray(arr)&&arr.length===n&&arr.every(Number.isFinite);
const goodId=v=>typeof v==='string'&&v.length>0&&v.length<=256;
/** Caller provides the solved positions, never a regenerated approximation. */
export function serializeSection(section,stones,{infill=[],joints=[]}={}){
 if(!section||!goodId(section.id)||section.type!=='masonry_section'||!Array.isArray(stones)||!Array.isArray(infill)||!Array.isArray(joints))throw new TypeError('Invalid section record');
 const {size}=sectionEnvelope(section);
 const result={schemaVersion:TOWER_SECTION_SCHEMA_VERSION,geometryVersion:SECTION_GEOMETRY_VERSION,sectionId:section.id,type:'masonry_section',
  size:[section.sx,section.sy,section.sz],transform:{position:[section.x,section.y,section.z].map(v=>v*CELL_METERS),rotation:[0,0,0,1],orientationCode:section.rotation||0},
  stones:stones.map(s=>({id:s.id,modelId:modelFamily(s.type)+':'+s.variant,
   position:[s.x,s.y,s.z].map(v=>v*CELL_METERS),rotation:[0,0,0,1],scale:[s.sx,s.sy,s.sz].map(v=>v*CELL_METERS)})),
  infill:structuredClone(infill),joints:structuredClone(joints)};
 if(!vector(size,3)||size.some(n=>n<=0))throw new TypeError('Invalid section dimensions');
 return parseSection(result);
}
export function parseSection(input){
 if(!input||input.schemaVersion!==3)throw new TypeError('Invalid schemaVersion');
 if(input.type!=='masonry_section'||!goodId(input.sectionId)||!Number.isInteger(input.geometryVersion)||input.geometryVersion<1
  ||!vector(input.size,3)||input.size.some(n=>n<=0||n>80)||!vector(input.transform?.position,3)||!vector(input.transform?.rotation,4)
  ||!Number.isInteger(input.transform?.orientationCode)||input.transform.orientationCode<0||input.transform.orientationCode>7
  ||!Array.isArray(input.stones)||input.stones.length>600||!Array.isArray(input.infill)||!Array.isArray(input.joints))throw new TypeError('Invalid masonry section');
 const ids=new Set();
 for(const stone of input.stones){
  if(!goodId(stone?.id)||ids.has(stone.id))throw new TypeError('Invalid or duplicate stone ID');
  ids.add(stone.id);
  if(typeof stone.modelId!=='string'||!/^(small|medium|long|big):\d+$/.test(stone.modelId)||!vector(stone.position,3)||!vector(stone.rotation,4)
    ||!vector(stone.scale,3)||stone.scale.some(v=>v<=0||v>20))throw new TypeError('Invalid authored stone transform');
 }
 return input;
}
/** Non-destructive adapter. Migration never charges, rewrites or deletes data. */
export function migrateLegacySnapshot(snapshot){
 if(!snapshot||!Array.isArray(snapshot.elements))throw new TypeError('Invalid legacy tower snapshot');
 return {schemaVersion:TOWER_SECTION_SCHEMA_VERSION,revision:snapshot.revision,silver:snapshot.silver,gold:snapshot.gold,
  legacyFormat:snapshot.format||1,legacyElements:structuredClone(snapshot.elements),sections:[]};
}
