/** Bounded V2 presentation warp of actual authored vertices at real facing
 * surfaces. No generated triangles; persisted and server-collision models stay
 * unchanged. A maximum 20mm movement per vertex is displayed only if the
 * neighbour has a real intersected facing triangle and an empty measured gap.
 * Both sides may move at most 40% of their own gap: never toward overlap.
 */
import {rayExtent} from './masonry-v2-joints.mjs';
const TRANSVERSE=[[1,2],[0,2],[0,1]],CELL=.25;
function inverse(v,rotation){const [x,y,z]=v;switch(rotation){
 case 1:return[-z,y,x];case 2:return[-x,y,-z];case 3:return[z,y,-x];
 case 4:return[-y,x,z];case 5:return[x,z,-y];case 6:return[z,x,y];case 7:return[y,z,x];default:return[x,y,z];
}}
export function fitV2DisplayMesh(mesh,block,body,neighbors,{maxStretchM=.020}={}){
 if(!mesh?.positions?.length||!body?.vertices||mesh.positions.length!==body.vertices.length*3||!Array.isArray(neighbors))throw new TypeError('Authored mesh/stone body mismatch');
 const points=mesh.positions.slice();const spans=[block.sx,block.sy,block.sz].map(x=>x*CELL);
 const maxStretch=Math.max(0,Math.min(.020,maxStretchM));let movedVertices=0,maxMoveM=0;
 if(maxStretch===0||!neighbors.length)return{positions:points,movedVertices,maxMoveM};
 for(let j=0;j<body.vertices.length;j++){
  const world=body.vertices[j],movement=[0,0,0];
  for(let axis=0;axis<3;axis++){
   const [u,v]=TRANSVERSE[axis],nearby=neighbors.filter(other=>other!==body&&
    world[u]>=other.bbox.min[u]-.008&&world[u]<=other.bbox.max[u]+.008&&
    world[v]>=other.bbox.min[v]-.008&&world[v]<=other.bbox.max[v]+.008&&
    other.bbox.max[axis]>=body.bbox.min[axis]-.16&&other.bbox.min[axis]<=body.bbox.max[axis]+.16);
   let best=0;
   for(const other of nearby){
    const right=other.center[axis]>body.center[axis],dir=right?1:-1;
    // Only exposed vertices within the outer 35mm of the authored stone.
    const edge=right?body.bbox.max[axis]-world[axis]:world[axis]-body.bbox.min[axis];
    if(edge>.035)continue;
    const own=rayExtent(body,axis,world[u],world[v],right?'high':'low');
    const opposed=rayExtent(other,axis,world[u],world[v],right?'low':'high');
    if(own===null||opposed===null||Math.abs(own-world[axis])>.010)continue;
    const gap=dir*(opposed-own);
    if(gap<=.002||gap>.135)continue;
    // Both stones can move: each is limited to 40% of the true separation.
    const adjustment=dir*Math.min(maxStretch,gap*.40)*Math.max(0,1-edge/.035);
    if(Math.abs(adjustment)>Math.abs(best))best=adjustment;
   }
   movement[axis]=best;
  }
  const n=Math.hypot(...movement);
  if(n<1e-6)continue;
  if(n>maxStretch)for(let k=0;k<3;k++)movement[k]*=maxStretch/n;
  const delta=inverse(movement,block.rotation);
  for(let k=0;k<3;k++)points[j*3+k]=mesh.positions[j*3+k]+delta[k]/spans[k];
  const len=Math.hypot(...movement);maxMoveM=Math.max(maxMoveM,len);movedVertices++;
 }
 // Reject inverted or collapsed faces. Scale only the display displacement,
 // never modify source vertices, winding, or saved collision geometry.
 const baseline=mesh.positions,indices=mesh.indices;
 const safe=()=>{
  for(let f=0;f<indices.length;f+=3){
   const [a,b,c]=[indices[f],indices[f+1],indices[f+2]];
   const normal=(v)=>{const i=a*3,j=b*3,k=c*3;
    const x=[v[j]-v[i],v[j+1]-v[i+1],v[j+2]-v[i+2]],y=[v[k]-v[i],v[k+1]-v[i+1],v[k+2]-v[i+2]];
    return[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];};
   const n0=normal(baseline),n1=normal(points),l0=Math.hypot(...n0),l1=Math.hypot(...n1);
   if(l0<1e-10)continue;
   if(l1<l0*.12||n0.reduce((sum,v,i)=>sum+v*n1[i],0)<l0*l1*.1)return false;
  }
  return true;
 };
 if(!safe()){
  const desired=points.slice();let ratio=1;
  for(let t=0;t<10;t++){
   ratio*=.5;for(let i=0;i<points.length;i++)points[i]=baseline[i]+(desired[i]-baseline[i])*ratio;
   if(safe())break;
  }
  if(!safe())points.set(baseline);
  maxMoveM*=ratio;
 }
 return{positions:points,movedVertices,maxMoveM};
}
