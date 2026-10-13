/** Authored-rock section solver, not wired to UI or purchases until v3
 * authoritative section RPC is deployed and explicit prices approved. */
import {ROCK_PACK} from '../../../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../../../packages/tower-game/rock-shapes.mjs';
import {mapContactJoints,deformContactMesh} from '../../../packages/tower-game/masonry-contact.mjs';
import {buildStoneProfiles} from '../../../packages/tower-game/masonry-geometry.mjs';
import {packMasonryVolume} from '../../../packages/tower-game/masonry-packing.mjs';
import {buildSectionMasonry} from '../../../packages/tower-game/section-pipeline.mjs';
const cache=new Map(),meshes=new Map(),profiles=buildStoneProfiles(ROCK_PACK);
const rockCounts=Object.fromEntries(Object.entries(ROCK_PACK).map(([k,v])=>[k,v.length]));
function getModel(family,variant){
 const collection=ROCK_PACK[family];
 if(!collection||!Number.isInteger(variant)||variant<0||variant>=collection.length)throw new TypeError('Unknown authored rock');
 const key=family+':'+variant;
 if(!meshes.has(key))meshes.set(key,originalRockMesh(collection[variant],variant));
 return meshes.get(key);
}
self.onmessage=({data})=>{
 const {generation,sections,mobile=false}=data||{};
 try{
  const result=buildSectionMasonry(sections,{
   getModel,rockCounts,contactEngine:mapContactJoints,deform:deformContactMesh,
   maxStones:mobile?180:350,
   infillEngine:stones=>packMasonryVolume(stones,profiles,{
    cache,spacing:mobile?.18:.14,maxTriangles:mobile?30000:75000,
    maxJoints:mobile?300:650,maxFragmentsPerJoint:mobile?60:120
   })
  });
  const batches=result.sections.map(b=>({...b})),infill=result.infill;
  const buffers=[...batches.flatMap(b=>[b.positions.buffer,b.colors.buffer,b.indices.buffer]),
   ...['stonePositions','stoneColors','mortarPositions','mortarColors'].map(k=>infill[k].buffer)];
  self.postMessage({generation,geometryVersion:result.geometryVersion,sections:batches,
   sectionCount:sections.length,stoneCount:result.stones.length,
   jointCount:result.joints.length,infill},buffers);
 }catch(error){self.postMessage({generation,error:String(error?.message||error)});}
};
