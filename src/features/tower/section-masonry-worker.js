/** Authored-rock section solver. Purchase mutations remain on existing V2 RPC until v3
 * authoritative section RPC is deployed and explicit prices approved. */
import {ROCK_PACK} from '../../../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../../../packages/tower-game/rock-shapes.mjs';
import {mapContactJoints,deformContactMesh} from '../../../packages/tower-game/masonry-contact.mjs?v=17.3.0';
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
 const started=performance.now();
 try{
  if(!Array.isArray(sections)||sections.length>250)throw new TypeError('Invalid section request');
  const result=buildSectionMasonry(sections,{
   getModel,rockCounts,contactEngine:mapContactJoints,
   deform:(mesh,rock,joints)=>deformContactMesh(mesh,rock,joints,{maxDisplacement:.12,maxRefinementPasses:1}),
   maxStones:mobile?360:850
  });
  const batches=result.sections.map(b=>({...b}));
  self.postMessage({generation,phase:'geometry',geometryVersion:result.geometryVersion,
   sections:batches,sectionCount:sections.length,stoneCount:result.stones.length,
   jointCount:result.joints.length,bridgeCount:result.joints.filter(j=>j.bridged).length,
   timeMs:performance.now()-started},
   batches.flatMap(b=>[b.positions.buffer,b.colors.buffer,b.indices.buffer]));
  try{
   const infill=packMasonryVolume(result.stones,profiles,{
    cache,spacing:mobile?.25:.19,maxTriangles:mobile?20000:48000,
    maxJoints:mobile?220:440,maxFragmentsPerJoint:mobile?40:80
   });
   self.postMessage({generation,phase:'infill',infill,timeMs:performance.now()-started},
    ['stonePositions','stoneColors','mortarPositions','mortarColors'].map(k=>infill[k].buffer));
  }catch(error){
   self.postMessage({generation,phase:'infill',infillError:String(error?.message||error)});
  }
 }catch(error){self.postMessage({generation,error:String(error?.message||error)});}
};