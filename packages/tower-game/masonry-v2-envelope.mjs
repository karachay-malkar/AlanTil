/**
 * Conservative V2 display-envelope certificate, in physical metres.
 *
 * The server accepts the ORIGINAL packed meshes and rejects collisions using
 * conservative convex hulls. A cosmetic deformation can never be used to
 * purchase, support or move a saved stone. In addition, keep each fitted hull
 * strictly separated on an original separating AABB axis for every pair:
 *
 *   |delta_A| + |delta_B| <= original_axis_gap - reserve.
 *
 * This is deliberately stricter than the server's full SAT: when AABBs
 * overlap but the true convex hulls do not, no visual warp is permitted.
 * No additional server permissions or persisted geometry are introduced.
 */
export const V2_MASONRY_POLICY = Object.freeze({
 version: 2,
 maxStretchM: .020,
 separationReserveM: .001,
 maxVisibleStones: 250,
});

/** Largest certified AABB separation on a world axis. Zero means uncertified. */
export function certifiedAxisGapM(a,b){
 if(!a?.bbox?.min||!b?.bbox?.min)throw new TypeError('Missing authoritative source bounding box');
 let gap=0;
 for(let axis=0;axis<3;axis++){
  const amin=a.bbox.min[axis],amax=a.bbox.max[axis],bmin=b.bbox.min[axis],bmax=b.bbox.max[axis];
  if(![amin,amax,bmin,bmax].every(Number.isFinite))throw new TypeError('Invalid source bounding box');
  gap=Math.max(gap,bmin-amax,amin-bmax);
 }
 return Math.max(0,gap);
}

/**
 * Every pair receives the SAME half-gap cap. Consequently deforming both
 * stones by any directions inside their Euclidean caps cannot close the
 * original SAT-certified gap. No geometry hash or player-supplied constraint
 * is accepted: only original bodies derived from saved stone transforms.
 */
export function certifiedV2StretchBudgets(bodies,{maxStretchM=V2_MASONRY_POLICY.maxStretchM,reserveM=V2_MASONRY_POLICY.separationReserveM}={}){
 if(!Array.isArray(bodies)||bodies.length>V2_MASONRY_POLICY.maxVisibleStones||
   !Number.isFinite(maxStretchM)||maxStretchM<0||maxStretchM>.020||
   !Number.isFinite(reserveM)||reserveM<.00035)throw new RangeError('Invalid conservative masonry policy');
 const limits=Array(bodies.length).fill(maxStretchM);
 let certifiedPairs=0,blockedPairs=0,minimumAxisGapM=Infinity;
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  const gap=certifiedAxisGapM(bodies[i],bodies[j]);
  minimumAxisGapM=Math.min(minimumAxisGapM,gap);
  const allowance=Math.max(0,Math.min(maxStretchM,(gap-reserveM)/2));
  limits[i]=Math.min(limits[i],allowance);
  limits[j]=Math.min(limits[j],allowance);
  if(allowance>0)certifiedPairs++;else blockedPairs++;
 }
 return {limits,certifiedPairs,blockedPairs,
  minimumAxisGapM:Number.isFinite(minimumAxisGapM)?minimumAxisGapM:null,
  policyVersion:V2_MASONRY_POLICY.version};
}
