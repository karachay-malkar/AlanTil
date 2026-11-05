/**
 * Spatially grouped permanent Kunlum Common100 stone geometry.
 * Larger chunks reduce draw calls without ever changing the stone shapes.
 */
export const RUIN_CHUNK_SIZE=90;
export const ruinChunkKey=(x,z,layer=0)=>layer+':'+Math.floor(x/RUIN_CHUNK_SIZE)+':'+Math.floor(z/RUIN_CHUNK_SIZE);
export function groupRuinSegments(entries){
 const chunks=new Map();
 for(const {seg,layer} of entries){
  const x=(seg.a[0]+seg.b[0])*.5,z=(seg.a[1]+seg.b[1])*.5;
  const key=ruinChunkKey(x,z,layer);
  let chunk=chunks.get(key);
  if(!chunk){
   const cx=Math.floor(x/RUIN_CHUNK_SIZE),cz=Math.floor(z/RUIN_CHUNK_SIZE);
   chunk={key,layer,segments:[],bounds:{
    minX:cx*RUIN_CHUNK_SIZE,maxX:(cx+1)*RUIN_CHUNK_SIZE,
    minZ:cz*RUIN_CHUNK_SIZE,maxZ:(cz+1)*RUIN_CHUNK_SIZE
   }};
   chunks.set(key,chunk);
  }
  chunk.segments.push(seg);
  for(const p of [seg.a,seg.b]){
   chunk.bounds.minX=Math.min(chunk.bounds.minX,p[0]);
   chunk.bounds.maxX=Math.max(chunk.bounds.maxX,p[0]);
   chunk.bounds.minZ=Math.min(chunk.bounds.minZ,p[1]);
   chunk.bounds.maxZ=Math.max(chunk.bounds.maxZ,p[1]);
  }
 }
 return [...chunks.values()];
}
export function ruinChunkDistance(camera,bounds){
 const x=Math.max(bounds.minX-camera.x,0,camera.x-bounds.maxX);
 const z=Math.max(bounds.minZ-camera.z,0,camera.z-bounds.maxZ);
 return Math.hypot(x,z);
}
