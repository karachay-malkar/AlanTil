/** Preserve the 23 authored irregular meshes while extending contact patches
 * toward their cell faces. Strictly monotone per-axis warping keeps vertex
 * ordering and face winding; adaptive subdivision avoids long stretched faces.
 * Input/output local coordinates are [-.5, .5].
 */
const distance2=(p,a,b)=>{let s=0;for(let k=0;k<3;k++)s+=(p[a*3+k]-p[b*3+k])**2;return s;};
const warp=(v,strength)=>{const r=Math.min(1,Math.abs(v)*2);return Math.sign(v)*.5*(r+strength*r*(1-r));};
export function adaptRockMesh(mesh,{strength=.91,maxEdge=.14,relief=.018,subdivide=true,maxPasses=6,maxTriangles=45000}={}){
 if(!mesh?.positions||!mesh.indices||!mesh.colors||mesh.positions.length!==mesh.colors.length||mesh.positions.length%3||mesh.indices.length%3)throw new TypeError('Invalid authored mesh');
 if(!Number.isFinite(strength)||strength<0||strength>=1||!Number.isFinite(maxEdge)||maxEdge<=0)throw new RangeError('Invalid contact warp');
 if(!Number.isFinite(relief)||relief<0||relief>.06)throw new RangeError('Invalid stone relief');
 const p=Array.from(mesh.positions),colors=Array.from(mesh.colors),sourceVertexCount=mesh.positions.length/3,limits=Array.from({length:3},(_,axis)=>{
  let lo=Infinity,hi=-Infinity;for(let i=axis;i<p.length;i+=3){lo=Math.min(lo,p[i]);hi=Math.max(hi,p[i]);}
  if(hi-lo<.0001)throw new RangeError('Degenerate source rock axis');
  return [lo,hi];
 });
 // The source may occupy only part of its authored bounding cube. Normalize
 // the true extremal vertices, then distribute interior material non-linearly.
 for(let i=0;i<p.length;i++) {
  const [lo,hi]=limits[i%3];
  p[i]=warp((p[i]-lo)/(hi-lo)-.5,strength);
 }
 let faces=Array.from(mesh.indices);
 if(subdivide)for(let pass=0;pass<maxPasses;pass++){
  let oversized=false;const mid=new Map(),next=[];
  const midpoint=(a,b)=>{
   const key=a<b?a+'/'+b:b+'/'+a;
   if(mid.has(key))return mid.get(key);
   const n=p.length/3;
   for(let k=0;k<3;k++){p.push((p[a*3+k]+p[b*3+k])*.5);colors.push((colors[a*3+k]+colors[b*3+k])*.5);}
   mid.set(key,n);return n;
  };
  for(let i=0;i<faces.length;i+=3){
   const a=faces[i],b=faces[i+1],c=faces[i+2];
   if(Math.max(distance2(p,a,b),distance2(p,b,c),distance2(p,c,a))<=maxEdge**2){next.push(a,b,c);continue;}
   oversized=true;
   const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
   next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
   if(next.length/3>maxTriangles)throw new RangeError('Stone triangle budget exceeded');
  }
  faces=next;if(!oversized)break;
 }
 // Subdivision without displacement is still a planar, artificial block.
 // Sculpt new shared vertices using the ORIGINAL triangle normals so relief
 // cannot detach from the authored silhouette or produce procedural cubes.
 if(subdivide&&relief>0){
  const undeformed=p.slice();
  const normal=new Float64Array(p.length);
  for(let f=0;f<faces.length;f+=3){
   const a=faces[f],b=faces[f+1],c=faces[f+2];
   const u=[0,1,2].map(k=>p[b*3+k]-p[a*3+k]),v=[0,1,2].map(k=>p[c*3+k]-p[a*3+k]);
   const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   for(const i of [a,b,c])for(let k=0;k<3;k++)normal[i*3+k]+=n[k];
  }
  for(let i=sourceVertexCount;i<p.length/3;i++){
   const o=i*3,x=p[o],y=p[o+1],z=p[o+2];
   const length=Math.hypot(normal[o],normal[o+1],normal[o+2])||1;
   const grain=Math.sin(x*127.17+y*43.79+z*93.11)*Math.cos(z*69.23-x*37.73+y*13.21);
   const amplitude=relief*grain;
   for(let k=0;k<3;k++){
    p[o+k]=Math.max(-.5,Math.min(.5,p[o+k]+amplitude*normal[o+k]/length));
    colors[o+k]=Math.max(0,Math.min(1,colors[o+k]+grain*.025));
   }
  }
  // Bound sculpting by the actual authored triangle orientation. An individual
  // displaced vertex must never collapse or turn a face inside out.
  for(let pass=0;pass<3;pass++){
   let corrected=false;
   for(let f=0;f<faces.length;f+=3){
    const ids=[faces[f],faces[f+1],faces[f+2]];
    const cross=(positions)=>{
     const a=ids[0]*3,b=ids[1]*3,c=ids[2]*3;
     const u=[0,1,2].map(k=>positions[b+k]-positions[a+k]);
     const v=[0,1,2].map(k=>positions[c+k]-positions[a+k]);
     return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    };
    const base=cross(undeformed),now=cross(p);
    const signed=base.reduce((sum,value,k)=>sum+value*now[k],0);
    if(Math.hypot(...now)>1e-6&&signed>1e-11)continue;
    for(const id of ids)if(id>=sourceVertexCount){
     for(let k=0;k<3;k++)p[id*3+k]=undeformed[id*3+k];
     corrected=true;
    }
   }
   if(!corrected)break;
  }
 }
 const Index=p.length/3<65536?Uint16Array:Uint32Array;
 return {positions:Float32Array.from(p),colors:Float32Array.from(colors),indices:Index.from(faces)};
}
export function inspectRockMesh(mesh){
 const {positions:p,indices:indices}=mesh;let invalidTriangles=0,outOfBounds=0,maxEdge=0;
 for(const v of p)if(!Number.isFinite(v)||v<-.50001||v>.50001)outOfBounds++;
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i],b=indices[i+1],c=indices[i+2];
  if(a===b||b===c||a===c||[a,b,c].some(v=>v<0||v*3+2>=p.length)){invalidTriangles++;continue;}
  const u=[0,1,2].map(k=>p[b*3+k]-p[a*3+k]);
  const v=[0,1,2].map(k=>p[c*3+k]-p[a*3+k]);
  const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])*.5;
  if(area<1e-12)invalidTriangles++;
  maxEdge=Math.max(maxEdge,Math.sqrt(distance2(p,a,b)),Math.sqrt(distance2(p,b,c)),Math.sqrt(distance2(p,c,a)));
 }
 return {vertexCount:p.length/3,triangles:indices.length/3,invalidTriangles,outOfBounds,maxEdge};
}

/** Expand irregular authored infill contours toward available seam space.
 * This strictly monotone deformation retains every source vertex, triangle,
 * crack and asymmetry. No cubes or replacement procedural meshes are used.
 * Local fit and collision tests decide whether an expanded stone can be placed.
 */
export function expandInfillRock(mesh,{power=.48}={}){
 if(!Number.isFinite(power)||power<=0||power>1)throw new RangeError('Invalid infill expansion power');
 const base=adaptRockMesh(mesh,{subdivide:false,strength:.91});
 const positions=base.positions.slice();
 for(let i=0;i<positions.length;i++){
  const value=positions[i],normalized=Math.min(1,Math.abs(value)*2);
  positions[i]=Math.sign(value)*.5*Math.pow(normalized,power);
 }
 return {...base,positions};
}
