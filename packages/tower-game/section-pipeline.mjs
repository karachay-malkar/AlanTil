/**
 * Masonry assembly stage independent of DOM, Three.js, DB and purchase protocol.
 * Inject existing authored-rock model loading, contact deformation and voxel
 * rubble packing; never invent replacement meshes or charge the wallet.
 */
import {SECTION_GEOMETRY_VERSION,generateSectionStones} from './section-masonry.mjs';
import {findSectionJoints} from './section-joints.mjs';
import {buildSectionGeometry} from './section-geometry.mjs';
export function buildSectionMasonry(sections,{getModel,rockCounts,contactEngine=null,deform=null,infillEngine=null,maxStones=800}={}){
 if(typeof getModel!=='function')throw new TypeError('An authored-rock getModel is required');
 if(!Array.isArray(sections)||!Number.isInteger(maxStones)||maxStones<1||maxStones>10000)throw new TypeError('Invalid masonry section limit');
 const stones=[];
 for(const section of sections){
  if(section?.type!=='masonry_section')throw new TypeError('Unexpected section type');
  stones.push(...generateSectionStones(section,{rockCounts:rockCounts||undefined,maxStones}));
  if(stones.length>maxStones)throw new RangeError('Masonry section limit exceeded');
 }
 const joints=findSectionJoints(sections,stones),contacts=contactEngine?contactEngine(stones):new Map();
 if(!(contacts instanceof Map))throw new TypeError('Contact engine must return a Map');
 const batches=buildSectionGeometry(sections,{getModel,counts:rockCounts,contacts,deform});
 const infill=infillEngine?infillEngine(stones,contacts):null;
 return {geometryVersion:SECTION_GEOMETRY_VERSION,sections:batches,stones,joints,infill};
}
