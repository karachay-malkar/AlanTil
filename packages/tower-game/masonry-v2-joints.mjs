/**
 * Real-triangle seam detection, no procedural or generated stone shapes.
 * An irregular seam is discovered only BETWEEN two authored source meshes.
 * Surfaces are open: scan is diagnostic until a watertight solid or signed
 * occupancy can verify that filling a void is physically safe.
 */
const AXES=[[1,2],[0,2],[0,1]],clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function rayExtent(body,axis,u,v,which){
 const axes=AXES[axis];let best=which==='low'?Infinity:-Infinity;
 for(const t of body.triangles){
  const a=t.a,b=t.b,c=t.d;
  const ai=axes[0],bi=axes[1];
  const loU=Math.min(a[ai],b[ai],c[ai]),hiU=Math.max(a[ai],b[ai],c[ai]);
  const loV=Math.min(a[bi],b[bi],c[bi]),hiV=Math.max(a[bi],b[bi],c[bi]);
  if(u<loU-1e-7||u>hiU+1e-7||v<loV-1e-7||v>hiV+1e-7)continue;
  const den=(b[bi]-c[bi])*(a[ai]-c[ai])+(c[ai]-b[ai])*(a[bi]-c[bi]);
  if(Math.abs(den)<1e-10)continue;
  const w=((b[bi]-c[bi])*(u-c[ai])+(c[ai]-b[ai])*(v-c[bi]))/den;
  const t2=((c[bi]-a[bi])*(u-c[ai])+(a[ai]-c[ai])*(v-c[bi]))/den;
  if(w>=-1e-6&&t2>=-1e-6&&w+t2<=1.000001){
   const x=w*a[axis]+t2*b[axis]+(1-w-t2)*c[axis];
   best=which==='low'?Math.min(best,x):Math.max(best,x);
  }
 }
 return Number.isFinite(best)?best:null;
}
/** Return sample points in real gaps, grouped by two authentic source IDs. */
export function findSurfaceJoints(placed,latestIndex=placed.length-1,{minGap=.025,maxGap=.15,steps=11,minSamples=5}={}){
 if(!placed.length||latestIndex<0||latestIndex>=placed.length)return[];
 const fresh=placed[latestIndex],joints=[];
 for(let i=0;i<placed.length;i++){
  if(i===latestIndex)continue;
  const other=placed[i];
  for(let axis=0;axis<3;axis++){
   const A=fresh.center[axis]<other.center[axis]?fresh:other,B=A===fresh?other:fresh;
   const [u,v]=AXES[axis];
   const u0=Math.max(A.bbox.min[u],B.bbox.min[u]),u1=Math.min(A.bbox.max[u],B.bbox.max[u]);
   const v0=Math.max(A.bbox.min[v],B.bbox.min[v]),v1=Math.min(A.bbox.max[v],B.bbox.max[v]);
   if(u1-u0<.065||v1-v0<.065||B.bbox.min[axis]-A.bbox.max[axis]>maxGap)continue;
   const points=[];let gapTotal=0,min=Infinity,max=-Infinity;
   for(let k=0;k<steps;k++)for(let j=0;j<steps;j++){
    const cu=u0+(j+.5)*(u1-u0)/steps,cv=v0+(k+.5)*(v1-v0)/steps;
    const posA=rayExtent(A,axis,cu,cv,'high'),posB=rayExtent(B,axis,cu,cv,'low');
    if(posA===null||posB===null)continue;
    const gap=posB-posA;if(gap<minGap||gap>maxGap)continue;
    // Another already-placed stone occupying this ray invalidates the void.
    let obstructed=false;
    for(const blocker of placed){if(blocker===A||blocker===B||cu<blocker.bbox.min[u]||cu>blocker.bbox.max[u]||cv<blocker.bbox.min[v]||cv>blocker.bbox.max[v])continue;
     const low=rayExtent(blocker,axis,cu,cv,'low'),high=rayExtent(blocker,axis,cu,cv,'high');
     if(low!==null&&high!==null&&low<posB-.001&&high>posA+.001){obstructed=true;break;}
    }
    if(obstructed)continue;
    const position=[0,0,0];position[axis]=(posA+posB)/2;position[u]=cu;position[v]=cv;
    points.push({position,gap,axis});min=Math.min(min,gap);max=Math.max(max,gap);gapTotal+=gap;
   }
   if(points.length>=minSamples)joints.push({between:[placed.indexOf(A),placed.indexOf(B)],axis,points,meanGap:gapTotal/points.length,minGap:min,maxGap:max,sampleCount:points.length});
  }
 }
 return joints.sort((a,b)=>b.sampleCount-a.sampleCount);
}
