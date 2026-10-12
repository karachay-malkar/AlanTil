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
  if(d<-.11||d>.60)continue;
  let footprint=1;
  for(let i=0;i<2;i++){
   const axis=j.other[i],p=point[axis],[lo,hi]=j.ranges[i];
   footprint*=smooth((p-lo+.07)/.18)*smooth((hi+.07-p)/.18);
  }
  if(footprint<.0001)continue;
  const band=smooth((.62-d)/.50)*footprint;
  const aim=contactSurface(j,point)-side*.021;
  const desired=Math.max(-.055,Math.min(.39,side*(aim-point[j.axis])));
  total[j.axis]+=side*desired*band;
 }
 const length=Math.hypot(...total);return length>.42?total.map(v=>v*.42/length):total;
}
export function deformContactMesh(mesh,block,joints){
 const positions=mesh.positions.slice();
 if(!joints?.length)return {...mesh,positions};
 for(let i=0;i<positions.length;i+=3){
  const p=[positions[i],positions[i+1],positions[i+2]],world=localToWorld(block,p);
  const delta=contactDisplacement(world,block.id,joints);
  const displaced=worldToLocal(block,world.map((v,k)=>v+delta[k]));
  positions.set(displaced,i);
 }
 return {...mesh,positions};
}
export function unwarpContactPoint(point,id,joints){
 let q=point.slice();for(let i=0;i<5;i++){
  const shift=contactDisplacement(q,id,joints);
  q=point.map((v,k)=>v-shift[k]);
 }return q;
}
