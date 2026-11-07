/** Spatial batches for Kunlum masonry. */
export const RUIN_CHUNK_SIZE=90;
export const ruinChunkKey=(x,z,layer=0)=>layer+':'+Math.floor(x/RUIN_CHUNK_SIZE)+':'+Math.floor(z/RUIN_CHUNK_SIZE);
export function groupRuinSegments(entries,size=RUIN_CHUNK_SIZE){
 const chunks=new Map();
 for(const {seg,layer} of entries){
  const x=(seg.a[0]+seg.b[0])*.5,z=(seg.a[1]+seg.b[1])*.5;
  const key=layer+':'+Math.floor(x/size)+':'+Math.floor(z/size);
  let chunk=chunks.get(key);
  if(!chunk){
   const cx=Math.floor(x/size),cz=Math.floor(z/size);
   chunk={key,layer,segments:[],bounds:{
    minX:Infinity,maxX:-Infinity,
    minZ:Infinity,maxZ:-Infinity
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


// Use the same distances for GPU coverage and conservative CPU batch culling.
export const FENCE_LOD_START=24;
export const FENCE_LOD_END=52;
export function fenceLodVisibility(camera,sphere){
 const distance=camera.distanceTo(sphere.center);
 return {
  near:distance-sphere.radius<FENCE_LOD_END,
  far:distance+sphere.radius>FENCE_LOD_START
 };
}

// Distance bands measured from a chunk's near edge in world metres.
// No stochastic shader fade: one rendered LOD per object, selected with hysteresis.
export const RUIN_LOD_DISTANCES=Object.freeze([26,65,130]);
export function selectRuinLOD(distance,previous=null,thresholds=RUIN_LOD_DISTANCES,hysteresis=.10){
 const valid=Number.isInteger(previous)&&previous>=0&&previous<=thresholds.length;
 if(!Number.isFinite(distance))return valid?previous:0;
 const d=Math.max(0,distance);
 if(!valid)return thresholds.reduce((level,threshold)=>level+(d>threshold?1:0),0);
 let level=previous;
 while(level<thresholds.length&&d>thresholds[level]*(1+hysteresis))level++;
 while(level>0&&d<thresholds[level-1]*(1-hysteresis))level--;
 return level;
}
