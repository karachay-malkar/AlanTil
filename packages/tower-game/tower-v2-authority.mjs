/** V2 physical-source geometry attestation.
 * The PostgreSQL endpoint computes triangles from authoritative saved poses and
 * the seeded authored meshes. No cosmetic deformation can ever become support
 * or modify a saved stone. Fail closed if any server/client topology or revision
 * differs; preserve raw source stones when the manifest is missing or stale.
 */
import {ROCK_PACK} from '../../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from './rock-shapes.mjs';
import {bodyForTowerBlock} from './stone-mesh-adapter.mjs';
export const V2_GEOMETRY_VERSION=1;
export const V2_VERTEX_EPSILON_M=0.000003;
const fail=reason=>({ok:false,reason,bodies:[],revision:null});
const finiteTriplet=v=>Array.isArray(v)&&v.length===3&&v.every(x=>typeof x==='number'&&Number.isFinite(x));
export function verifyV2GeometryManifest(blocks,revision,manifest){
 if(!Array.isArray(blocks)||!Number.isSafeInteger(revision)||revision<0)return fail('LOCAL_SNAPSHOT_INVALID');
 if(!manifest||manifest.format!==2||manifest.geometryVersion!==V2_GEOMETRY_VERSION||manifest.revision!==revision||!Array.isArray(manifest.bodies))return fail('SERVER_REVISION_OR_VERSION_MISMATCH');
 if(manifest.bodies.length!==blocks.length)return fail('SERVER_STONE_COUNT_MISMATCH');
 const server=new Map();
 for(const entry of manifest.bodies){
  if(!entry||typeof entry.id!=='string'||!entry.id||server.has(entry.id)||!Array.isArray(entry.v)||!Array.isArray(entry.f))return fail('SERVER_STONE_ID_OR_DATA_INVALID');
  server.set(entry.id,entry);
 }
 const seen=new Set(),certified=[];
 for(const block of blocks){
  if(!block||typeof block.id!=='string'||seen.has(block.id))return fail('LOCAL_STONE_ID_INVALID');
  seen.add(block.id);
  const corresponding=server.get(block.id);
  if(!corresponding)return fail('SERVER_STONE_MISSING');
  const kind=block.type==='stone'?'small':block.type;
  const source=ROCK_PACK[kind]?.[block.variant];
  if(!source)return fail('UNKNOWN_SOURCE_MESH');
  let body;
  try{body=bodyForTowerBlock(originalRockMesh(source,block.variant),block);}catch{return fail('LOCAL_PHYSICAL_GEOMETRY_INVALID');}
  if(corresponding.v.length!==body.vertices.length||corresponding.f.length!==body.mesh.faces.length)return fail('SERVER_TOPOLOGY_MISMATCH');
  for(let i=0;i<body.vertices.length;i++){
   const serverPoint=corresponding.v[i];
   if(!finiteTriplet(serverPoint)||serverPoint.some((v,k)=>Math.abs(v-body.vertices[i][k])>V2_VERTEX_EPSILON_M))return fail('SERVER_VERTEX_MISMATCH');
  }
  for(let i=0;i<body.mesh.faces.length;i++){
   const ids=corresponding.f[i],expected=body.mesh.faces[i];
   if(!Array.isArray(ids)||ids.length!==3||ids.some((v,k)=>!Number.isInteger(v)||v!==expected[k]))return fail('SERVER_FACE_MISMATCH');
  }
  certified.push({id:block.id,body});
 }
 return{ok:true,reason:'SERVER_GEOMETRY_MATCH',revision,bodies:certified};
}
