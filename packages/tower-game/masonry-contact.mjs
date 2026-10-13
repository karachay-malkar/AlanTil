/** Local deterministic contact geometry. Grid placement, purchases, and saved
 * tower data remain untouched. Both faces share the same irregular seam. */
import {bounds} from './core.mjs';
const TYPES=new Set(['stone','medium','long','big']),A=['x','y','z'];
const smooth=t=>{const q=Math.max(0,Math.min(1,t));return q*q*(3-2*q);};
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;};
const overlap=(a,b)=>[Math.max(a[0],b[0]),Math.min(a[1],b[1])];
export function findContactJoints(blocks){
 const stones=blocks.filter(b=>TYPES.has(b.type)).map(b=>({block:b,box:bounds(b)}));
 const planes=new Map();
 for(const e of stones)for(let axis=0;axis<3;axis++)for(const side of [-1,1]){
  const coord=e.box[A[axis]+(side<0?'0':'1')],key=axis+':'+coord;
  if(!planes.has(key))planes.set(key,[[],[]]);
  planes.get(key)[side<0?0:1].push(e);
 }
 const output=[];
 for(const [key,sides]of planes){
  const axis=Number(key[0]),plane=Number(key.slice(2)),other=[0,1,2].filter(a=>a!==axis);
  for(const left of sides[1])for(const right of sides[0]){
   if(left===right)continue;
   const ranges=other.map(a=>overlap([left.box[A[a]+'0'],left.box[A[a]+'1']],[right.box[A[a]+'0'],right.box[A[a]+'1']]));
   if(ranges.some(([lo,hi])=>hi-lo<.55))continue;
   const ids=[String(left.block.id),String(right.block.id)].sort();
   output.push({axis,plane,other,ranges,left:left.block.id,right:right.block.id,
    key:ids.join(':')+':'+axis+':'+plane});
  }
 }
 return output.sort((a,b)=>a.key.localeCompare(b.key));
}
export function mapContactJoints(blocks){
 const map=new Map();for(const joint of findContactJoints(blocks))for(const id of [joint.left,joint.right]){
  if(!map.has(id))map.set(id,[]);map.get(id).push(joint);
 }return map;
}
const turn=(p,r)=>{const [x,y,z]=p;switch(r||0){
 case 1:return [z,y,-x];case 2:return [-x,y,-z];case 3:return [-z,y,x];
 case 4:return [y,-x,z];case 5:return [x,-z,y];
 case 6:return [y,z,x];case 7:return [z,x,y];default:return [x,y,z];
}};
const unturn=(p,r)=>{const [x,y,z]=p;switch(r||0){
 case 1:return [-z,y,x];case 2:return [-x,y,-z];case 3:return [z,y,-x];
 case 4:return [-y,x,z];case 5:return [x,z,-y];
 case 6:return [z,x,y];case 7:return [y,z,x];default:return [x,y,z];
}};
export function localToWorld(block,p){
 const size=[block.sx,block.sy,block.sz];
 const box=bounds(block),center=[(box.x0+box.x1)/2,(box.y0+box.y1)/2,(box.z0+box.z1)/2];
 const rotated=turn(p.map((v,i)=>v*size[i]),block.rotation);
 return rotated.map((v,i)=>v+center[i]);
}
export function worldToLocal(block,p){
 const box=bounds(block),center=[(box.x0+box.x1)/2,(box.y0+box.y1)/2,(box.z0+box.z1)/2];
 return unturn(p.map((v,i)=>v-center[i]),block.rotation).map((v,i)=>v/[block.sx,block.sy,block.sz][i]);
}
function contactSurface(joint,point){
 const [u,v]=joint.other,seed=hash(joint.key)%1000;
 return joint.plane+.032*Math.sin(point[u]*4.4+seed*.017)*Math.cos(point[v]*5.3+seed*.011)
  +.014*Math.sin(point[u]*10.3+point[v]*7.1+seed*.013);
}
export function contactDisplacement(point,id,joints){
 if(!joints?.length)return [0,0,0];
 const total=[0,0,0];
 for(const j of joints){
  const side=j.left===id?1:j.right===id?-1:0;if(!side)continue;
  const d=side*(j.plane-point[j.axis]);
  if(d<-.08||d>1.12)continue;
  let footprint=1;
  for(let i=0;i<2;i++){
   const axis=j.other[i],p=point[axis],[lo,hi]=j.ranges[i];
   footprint*=smooth((p-lo+.07)/.18)*smooth((hi+.07-p)/.18);
  }
  if(footprint<.0001)continue;
  const band=smooth((1.12-d)/.30)*footprint;
  const aim=contactSurface(j,point)-side*.021;
  const desired=Math.max(-.035,Math.min(.69,side*(aim-point[j.axis])));
  total[j.axis]+=side*desired*band;
 }
 const length=Math.hypot(...total);return length>.70?total.map(v=>v*.70/length):total;
}
/**
 * Add vertices to the CONTACT PATCH only. Split every marked shared edge in
 * both adjacent faces so there are no T-junctions or invented source rocks.
 * The source positions/triangles are immutable and unchanged when isolated.
 */
export function refineContactMesh(mesh,block,joints,{maxPasses=3,maxTriangles=6000}={}){
 if(!joints?.length)return {positions:mesh.positions.slice(),colors:mesh.colors.slice(),indices:mesh.indices.slice()};
 const p=Array.from(mesh.positions),colors=Array.from(mesh.colors);
 let faces=Array.from(mesh.indices);
 const sideNear=point=>joints.some(j=>{
  const distance=Math.abs(j.plane-point[j.axis]);
  if(distance>1.28)return false;
  return j.other.every((axis,i)=>point[axis]>=j.ranges[i][0]-.22&&point[axis]<=j.ranges[i][1]+.22);
 });
 const wpoint=i=>localToWorld(block,p.slice(i*3,i*3+3));
 const key=(i,j)=>i<j?i+':'+j:j+':'+i;
 for(let pass=0;pass<maxPasses;pass++){
  const marked=new Set(),mid=new Map();
  for(let i=0;i<faces.length;i+=3){
   const ids=faces.slice(i,i+3),pts=ids.map(wpoint);
   const center=[0,1,2].map(k=>(pts[0][k]+pts[1][k]+pts[2][k])/3);
   if(!sideNear(center)&&!pts.some(sideNear))continue;
   for(let e=0;e<3;e++){
    const first=e,second=(e+1)%3;
    if(Math.hypot(...pts[first].map((v,k)=>v-pts[second][k]))>.16)marked.add(key(ids[first],ids[second]));
   }
  }
  if(!marked.size)break;
  // Polygon fan keeps each triangle's source winding, and every shared edge
  // has the exact same inserted midpoint in adjacent source triangles.
  const midpoint=(a,b)=>{
   const k=key(a,b);if(mid.has(k))return mid.get(k);
   const index=p.length/3;
   for(let axis=0;axis<3;axis++){
    p.push((p[a*3+axis]+p[b*3+axis])/2);
    colors.push((colors[a*3+axis]+colors[b*3+axis])/2);
   }
   mid.set(k,index);return index;
  };
  const next=[];
  for(let i=0;i<faces.length;i+=3){
   const [a,b,c]=faces.slice(i,i+3),polygon=[a];
   if(marked.has(key(a,b)))polygon.push(midpoint(a,b));
   polygon.push(b);
   if(marked.has(key(b,c)))polygon.push(midpoint(b,c));
   polygon.push(c);
   if(marked.has(key(c,a)))polygon.push(midpoint(c,a));
   if(polygon.length===3){next.push(a,b,c);continue;}
   const centroid=p.length/3;
   for(let k=0;k<3;k++){
    p.push((p[a*3+k]+p[b*3+k]+p[c*3+k])/3);
    colors.push((colors[a*3+k]+colors[b*3+k]+colors[c*3+k])/3);
   }
   for(let j=0;j<polygon.length;j++)next.push(centroid,polygon[j],polygon[(j+1)%polygon.length]);
  }
  if(next.length/3>maxTriangles)break;
  faces=next;
 }
 const ArrayType=p.length/3>65535?Uint32Array:Uint16Array;
 return {positions:Float32Array.from(p),colors:Float32Array.from(colors),indices:ArrayType.from(faces)};
}
export function deformContactMesh(mesh,block,joints,{maxDisplacement=.70}={}){
 if(!Number.isFinite(maxDisplacement)||maxDisplacement<0||maxDisplacement>.70)throw new RangeError('Invalid contact displacement limit');
 if(!joints?.length)return {...mesh,positions:mesh.positions.slice(),indices:mesh.indices.slice()};
 const refined=refineContactMesh(mesh,block,joints),base=refined.positions;
 const displacement=new Float32Array(base.length);
 let moved=0,maxContactDisplacement=0;
 for(let i=0;i<base.length;i+=3){
  const world=localToWorld(block,[base[i],base[i+1],base[i+2]]);
  const raw=contactDisplacement(world,block.id,joints);
  const magnitude=Math.hypot(...raw);
  const d=magnitude>maxDisplacement?raw.map(value=>value*maxDisplacement/magnitude):raw;
  if(Math.hypot(...d)>1e-5)moved++;
  maxContactDisplacement=Math.max(maxContactDisplacement,Math.hypot(...d));
  const corrected=worldToLocal(block,world.map((v,k)=>v+d[k]));
  for(let k=0;k<3;k++)displacement[i+k]=corrected[k]-base[i+k];
 }
 // Keep each source triangle's original orientation, reducing only the
 // local displacement around narrow triangles rather than shrinking the
 // entire contact deformation across the stone.
 const result=base.slice(),f=refined.indices,weight=new Float32Array(base.length/3).fill(1);
 const normal=(q,ids)=>{
  const a=ids[0]*3,b=ids[1]*3,c=ids[2]*3;
  const u=[q[b]-q[a],q[b+1]-q[a+1],q[b+2]-q[a+2]];
  const v=[q[c]-q[a],q[c+1]-q[a+1],q[c+2]-q[a+2]];
  return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 };
 let invalid=0;
 for(let attempt=0;attempt<50;attempt++){
  for(let i=0;i<result.length;i++)result[i]=base[i]+displacement[i]*weight[Math.floor(i/3)];
  invalid=0;const affected=new Set();
  for(let i=0;i<f.length;i+=3){
   const ids=[f[i],f[i+1],f[i+2]],a=normal(base,ids),b=normal(result,ids);
   if(a.reduce((total,x,k)=>total+x*b[k],0)>1e-11)continue;
   invalid++;
   for(const id of ids)affected.add(id);
  }
  if(!invalid)break;
  for(const id of affected)weight[id]*=.60;
 }
 let effective=0;for(let i=0;i<displacement.length;i+=3){
  effective=Math.max(effective,Math.hypot(...[0,1,2].map(k=>displacement[i+k]*weight[i/3])));
 }
 return {...refined,positions:result,contactMovedVertices:moved,
  maxContactDisplacement:effective,invalidContactFaces:invalid};
}
export function unwarpContactPoint(point,id,joints){
 let q=point.slice();for(let i=0;i<5;i++){
  const shift=contactDisplacement(q,id,joints);
  q=point.map((v,k)=>v-shift[k]);
 }return q;
}
