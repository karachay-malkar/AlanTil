/** V2 derived infill, geometry-only; NEVER an element, payment, or support.
 * Every visible pebble triangle comes from one of seven supplied ROCK_PACK.small
 * meshes. Cavities are scanned between ACTUAL source triangles, not grid boxes.
 * All collision decisions use conservative sourced-hull SAT.
 * This is visual infill, NOT proof of a friction-locked masonry joint.
 */
import {ROCK_PACK} from '../../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from './rock-shapes.mjs';
import {repairRockDisplayWinding} from './rock-display-winding.mjs';
import {bodyForTowerBlock} from './stone-mesh-adapter.mjs';
import {makeBody,penetrates} from './stone-placement-v2.mjs';
import {findSurfaceJoints,rayExtent} from './masonry-v2-joints.mjs';

const ax=[[1,2],[0,2],[0,1]];
const small=Object.freeze(ROCK_PACK.small.map((item,index)=>repairRockDisplayWinding(originalRockMesh(item,index))));
const srgbLinear=value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4;
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const norm=v=>Math.hypot(...v);
const unit=v=>{const l=norm(v);return l>1e-10?v.map(x=>x/l):null;};
function axesOf(values){const out=[],seen=new Set();for(const v of values){const a=unit(v);if(!a)continue;if(a.find(x=>Math.abs(x)>1e-7)<0)for(let i=0;i<3;i++)a[i]=-a[i];const key=a.map(x=>Math.round(x*10000)).join(',');if(!seen.has(key)){seen.add(key);out.push(a);}}return out;}
function pebbleTemplate(source,dimensions){
 const vertices=[];for(let i=0;i<source.positions.length;i+=3)vertices.push(dimensions.map((d,k)=>d*source.positions[i+k]));
 const faces=[],normals=[],edges=[];
 for(let i=0;i<source.indices.length;i+=3){const [a,b,c]=[source.indices[i],source.indices[i+1],source.indices[i+2]];
  const u=sub(vertices[b],vertices[a]),v=sub(vertices[c],vertices[a]);faces.push([a,b,c]);normals.push(cross(u,v));edges.push(u,sub(vertices[c],vertices[b]),sub(vertices[a],vertices[c]));}
 return{vertices,faces,hullNormals:axesOf(normals),hullEdges:axesOf(edges),center:[0,1,2].map(k=>vertices.reduce((s,v)=>s+v[k],0)/vertices.length)};
}
function validBlock(b){return b&&['stone','medium','long','big'].includes(b.type)&&[b.sx,b.sy,b.sz,b.x,b.y,b.z,b.rotation,b.variant].every(Number.isFinite)&&Number.isInteger(b.rotation)&&Number.isInteger(b.variant)&&ROCK_PACK[b.type==='stone'?'small':b.type]?.[b.variant];}
function sourceBody(b){const t=b.type==='stone'?'small':b.type;return bodyForTowerBlock(originalRockMesh(ROCK_PACK[t][b.variant],b.variant),b);}
const stable=(a,b)=>String(a.id).localeCompare(String(b.id));
function pairKey(a,b){return [String(a.id),String(b.id)].sort().join('|');}
/** A cavity exists between two real triangle surfaces. Hull SAT alone cannot
 * test such concave free space because the hull fills legitimate cavities.
 * Check the actual narrow corridor for each source vertex, each edge midpoint
 * and each triangle centroid instead; no solid/closed-mesh assumption.
 */
function dot(a,b){return a.reduce((s,v,k)=>s+v*b[k],0);}
// Proper non-coplanar triangle intersections. Both edge directions are tested.
// Boundary grazing is deliberately allowed; the source meshes are open.
function hitsSegmentTriangle(a,b,t){
 const e1=sub(t.b,t.a),e2=sub(t.d,t.a),dir=sub(b,a),p=cross(dir,e2),det=dot(e1,p);
 if(Math.abs(det)<1e-11)return false;
 const inv=1/det,s=sub(a,t.a),u=dot(s,p)*inv;
 if(u<=1e-5||u>=1-1e-5)return false;
 const q=cross(s,e1),v=dot(dir,q)*inv;
 if(v<=1e-5||u+v>=1-1e-5)return false;
 const travel=dot(e2,q)*inv;
 return travel>1e-5&&travel<1-1e-5;
}
function trianglesCross(first,second){
 for(const a of first.triangles)for(const b of second.triangles){
  const min1=[0,1,2].map(k=>Math.min(a.a[k],a.b[k],a.d[k])),max1=[0,1,2].map(k=>Math.max(a.a[k],a.b[k],a.d[k]));
  const min2=[0,1,2].map(k=>Math.min(b.a[k],b.b[k],b.d[k])),max2=[0,1,2].map(k=>Math.max(b.a[k],b.b[k],b.d[k]));
  if([0,1,2].some(k=>min1[k]>max2[k]||min2[k]>max1[k]))continue;
  for(const [u,v]of [[a.a,a.b],[a.b,a.d],[a.d,a.a]])if(hitsSegmentTriangle(u,v,b))return true;
  for(const [u,v]of [[b.a,b.b],[b.b,b.d],[b.d,b.a]])if(hitsSegmentTriangle(u,v,a))return true;
 }
 return false;
}
function fitsRealTriangleGap(pebble,left,right,axis){
 const [u,v]=ax[axis];
 const clear=p=>{
  const high=rayExtent(left,axis,p[u],p[v],'high');
  const low=rayExtent(right,axis,p[u],p[v],'low');
  return high!==null&&low!==null&&p[axis]>=high+.001&&p[axis]<=low-.001;
 };
 for(const p of pebble.vertices)if(!clear(p))return false;
 for(const {a,b,d} of pebble.triangles){
  const center=a.map((x,k)=>(x+b[k]+d[k])/3);
  if(!clear(center))return false;
  for(const [l,r] of [[a,b],[b,d],[d,a]])if(!clear(l.map((x,k)=>(x+r[k])/2)))return false;
 }
 if(trianglesCross(pebble,left)||trianglesCross(pebble,right))return false;
 return true;
}
function triangleSoup(placements){
 const positions=[],colors=[];
 for(const placement of placements){const mesh=small[placement.sourceVariant];
  for(const id of mesh.indices){for(let k=0;k<3;k++)positions.push(placement.center[k]+mesh.positions[id*3+k]*placement.dimensions[k]);
   for(let k=0;k<3;k++)colors.push(srgbLinear(mesh.colors[id*3+k]));
  }
 }
 return{stonePositions:Float32Array.from(positions),stoneColors:Float32Array.from(colors),mortarPositions:new Float32Array(0),mortarColors:new Float32Array(0)};
}
/** Enforce deterministic output irrespective of incoming save-row ordering. */
export function packV2AuthoredInfill(blocks,{maxStones=48,maxJoints=160,steps=9,perJoint=2}={}){
 if(!Array.isArray(blocks)||blocks.length<2)return{...triangleSoup([]),placements:[],fragments:0,joints:0,scannedPairs:0,truncated:false,unit:'meters',sourceOnly:true};
 if(blocks.length>250)throw new RangeError('V2 stone limit');
 const entries=blocks.filter(validBlock).sort(stable).map(b=>({block:b,body:sourceBody(b)}));
 const pebbles=[],placements=[];let joints=0,scannedPairs=0,truncated=false;
 const limit=Math.max(0,Math.min(120,Math.floor(maxStones)));
 for(let j=1;j<entries.length;j++){
  for(let i=0;i<j;i++){
   const A=entries[i],B=entries[j];
   if(joints>=maxJoints||placements.length>=limit){truncated=true;break;}
   // Broadphase only; the actual joints are found by intersections with source triangles.
   if([0,1,2].some(k=>A.body.bbox.max[k]+.17<B.body.bbox.min[k]||B.body.bbox.max[k]+.17<A.body.bbox.min[k]))continue;
   scannedPairs++;
   const scans=findSurfaceJoints([A.body,B.body],1,{minGap:.036,maxGap:.16,steps,minSamples:7});
   for(const seam of scans){
    joints++;const axis=seam.axis;
    if(placements.length>=limit){truncated=true;break;}
    // Widest areas first, but sample only at real interior rays on both source surfaces.
    const candidates=seam.points.slice().sort((a,b)=>b.gap-a.gap||a.position[1]-b.position[1]);
    let accepted=0;
    for(let k=0;k<candidates.length&&accepted<perJoint;k+=Math.max(1,Math.floor(candidates.length/12))){
     const ray=candidates[k],gap=ray.gap;
     // A small source rock is compressed along the joint normal, while the
     // other dimensions stay 90..150mm. No new sculpted geometry is introduced.
     const dimensions=[.09,.09,.09];dimensions[axis]=Math.min(.12,Math.max(.025,gap*.68));
     const center=ray.position;
     const [u,v]=ax[axis];
     const first=A.body.center[axis]<B.body.center[axis]?A.body:B.body;
     const second=first===A.body?B.body:A.body;
     const firstEnd=rayExtent(first,axis,center[u],center[v],'high');
     const secondStart=rayExtent(second,axis,center[u],center[v],'low');
     if(firstEnd===null||secondStart===null||secondStart-firstEnd<.036)continue;
     for(let attempt=0;attempt<small.length;attempt++){
      const variant=(i*7+j*3+k+attempt)%small.length,mesh=small[variant];
      const body=makeBody(pebbleTemplate(mesh,dimensions),center);
      if(body.bbox.min[1]<-.0005)continue;
      // A source pebble must be close to both real contacting surfaces.
      const leftClearance=body.bbox.min[axis]-firstEnd,rightClearance=secondStart-body.bbox.max[axis];
      if(leftClearance<-.006||rightClearance<-.006||leftClearance>.031||rightClearance>.031)continue;
      // Always test against unrelated stones and every previous pebble by SAT;
      // for the two defining stones, use their actual sourced triangle cavity.
      if(!fitsRealTriangleGap(body,first,second,axis))continue;
      if(pebbles.some(other=>penetrates(body,other)))continue;
      if(entries.some(entry=>entry.body!==first&&entry.body!==second&&penetrates(body,entry.body)))continue;
      pebbles.push(body);
      placements.push({sourceVariant:variant,center:[...center],dimensions,axis,between:pairKey(A.block,B.block),gap,leftClearance,rightClearance});
      accepted++;break;
     }
    }
   }
  }
  if(truncated)break;
 }
 return{...triangleSoup(placements),placements,fragments:placements.length,joints,scannedPairs,truncated,unit:'meters',sourceOnly:true};
}
