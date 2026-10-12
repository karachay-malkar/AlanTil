/** Only supplied small ROCK_PACK source triangles are ever emitted as stone.
 * No voxel stone meshes, planar veneers, or material-color impostors.
 * Occupancy is tracked separately on fine samples so two original pebbles may
 * occupy distinct parts of one coarse seam cell without colliding.
 */
const parity=p=>(p[0]>p[1])+(p[0]>p[2])+(p[1]>p[2]);
const rotations=[];
for(const p of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]])
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])
  if((parity(p)%2?-1:1)*x*y*z===1)rotations.push([p,[x,y,z]]);
const rot=(v,i)=>{const [p,s]=rotations[i%24];return p.map((a,k)=>v[a]*s[k]);};
const inverse=(v,i)=>{const [p,s]=rotations[i%24],out=[0,0,0];for(let k=0;k<3;k++)out[p[k]]=v[k]*s[k];return out;};
const hash=x=>{let h=Math.imul(x+0x9e3779b9,0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return (h^(h>>>16))>>>0;};
export function packOriginalPebbles(g,meshes,fields,contains,{subdivisions=3,maxFragments=240,maxTriangles=25000,isSolidAt=null}={}){
 const n=[g.nx,g.ny,g.nz].map(v=>v*subdivisions),plane=n[0]*n[1],total=plane*n[2];
 const step=g.dimension.map(d=>d/subdivisions),id=(x,y,z)=>x+n[0]*y+plane*z;
 const allowed=new Uint8Array(total),used=new Uint8Array(total),exterior=[];
 const faces=g.exteriorFaces||[0,1,2].filter(a=>a!==g.seamAxis).flatMap(a=>[[a,0],[a,1]]);
 const visible=p=>faces.some(([axis,side])=>{
  const depth=side?g.min[axis]+n[axis]*step[axis]-p[axis]:p[axis]-g.min[axis];
  return depth-step[axis]*.5<n[axis]*step[axis]*.2-1e-8;
 });
 for(let z=0;z<n[2];z++)for(let y=0;y<n[1];y++)for(let x=0;x<n[0];x++){
  const coarse=Math.floor(x/subdivisions)+g.nx*Math.floor(y/subdivisions)+g.stride*Math.floor(z/subdivisions);
  if(!g.mask[coarse])continue;
  const p=[x,y,z].map((v,k)=>g.min[k]+(v+.5)*step[k]);
  if(isSolidAt?.(p))continue;
  const at=id(x,y,z);allowed[at]=1;if(visible(p))exterior.push(at);
 }
 const max=step.map(d=>Math.max(2,Math.floor(.60/d)));
 const small=step.map(d=>Math.max(2,Math.round(.18/d)));
 const sizes=[
  max,[max[0],max[1],small[2]],[max[0],small[1],max[2]],[small[0],max[1],max[2]],
  max.map(v=>Math.max(3,Math.floor(v*.7))),
  max.map(v=>Math.max(2,Math.floor(v*.48))),
  max.map(v=>Math.max(2,Math.floor(v*.30))),small,[3,3,3],
 ];
 const patterns=[];
 for(let model=0;model<meshes.length;model++)for(let variant=0;variant<sizes.length;variant++){
  const size=sizes[variant];
  for(let r=0;r<24;r+=3){
   const offsets=[];
   for(let z=0;z<size[2];z++)for(let y=0;y<size[1];y++)for(let x=0;x<size[0];x++){
    const p=[x,y,z].map((v,k)=>(v+.5)/size[k]-.5);
    if(contains(fields[model],inverse(p,r).map(v=>v+.5)))offsets.push([x,y,z]);
   }
   if(offsets.length<3)continue;
   const centroid=offsets.reduce((acc,v)=>acc.map((n,k)=>n+v[k]),[0,0,0]).map(v=>v/offsets.length);
   let anchor=0,minDistance=Infinity;
   for(let k=0;k<offsets.length;k++){
    const d=offsets[k].reduce((sum,value,axis)=>sum+(value-centroid[axis])**2,0);
    if(d<minDistance){anchor=k;minDistance=d;}
   }
   patterns.push({model,variant,r,size,offsets,anchor,volume:offsets.length,
    triangles:meshes[model].indices.length/3});
  }
 }
 patterns.sort((a,b)=>b.volume-a.volume||a.model-b.model||a.r-b.r);
 const positions=[],colors=[],coverage=new Uint8Array(g.nx*g.ny*g.nz*subdivisions**3);
 let fragments=0,triangles=0,occupiedSamples=0;
 const candidate=(seed,pattern,anchorIndex)=>{
  const z=Math.floor(seed/plane),y=Math.floor((seed-z*plane)/n[0]),x=seed%n[0];
  const anchor=pattern.offsets[anchorIndex],origin=[x-anchor[0],y-anchor[1],z-anchor[2]];
  if(origin.some((v,k)=>v<0||v+pattern.size[k]>n[k]))return null;
  for(const offset of pattern.offsets){
   const at=id(origin[0]+offset[0],origin[1]+offset[1],origin[2]+offset[2]);
   if(!allowed[at]||used[at])return null;
  }
  return origin;
 };
 const emit=(pattern,origin)=>{
  const mesh=meshes[pattern.model],size=pattern.size.map((v,k)=>v*step[k]);
  const center=origin.map((v,k)=>g.min[k]+(v+pattern.size[k]/2)*step[k]);
  for(const vi of mesh.indices){
   const p=rot([mesh.positions[vi*3],mesh.positions[vi*3+1],mesh.positions[vi*3+2]],pattern.r);
   for(let k=0;k<3;k++)positions.push(center[k]+p[k]*size[k]);
   for(let k=0;k<3;k++){
    const srgb=mesh.colors[vi*3+k]??.5;
    colors.push(srgb<=.04045?srgb/12.92:((srgb+.055)/1.055)**2.4);
   }
  }
  for(const delta of pattern.offsets){
   const x=origin[0]+delta[0],y=origin[1]+delta[1],z=origin[2]+delta[2],at=id(x,y,z);
   used[at]=1;occupiedSamples++;
   const cell=Math.floor(x/subdivisions)+g.nx*Math.floor(y/subdivisions)+g.stride*Math.floor(z/subdivisions);
   const sub=x%subdivisions+subdivisions*(y%subdivisions)+subdivisions**2*(z%subdivisions);
   coverage[cell*subdivisions**3+sub]=1;
  }
  fragments++;triangles+=pattern.triangles;
 };
 // Stone skins first; reserve remaining volume for the *real* inner mortar.
 exterior.sort((a,b)=>hash(a)-hash(b));
 for(const seed of exterior){
  if(fragments>=maxFragments||triangles>=maxTriangles)break;
  if(used[seed])continue;
  const rng=hash(seed);let best=null;
  for(let trial=0;trial<Math.min(88,patterns.length);trial++){
   const pattern=patterns[(trial*37+(rng%29))%patterns.length];
   if(triangles+pattern.triangles>maxTriangles)continue;
   for(let offset=0;offset<3;offset++){
    const key=offset===0?pattern.anchor:hash(seed+offset*71)%pattern.offsets.length;
    const origin=candidate(seed,pattern,key);if(!origin)continue;
    if(!best||pattern.volume>best.pattern.volume)best={pattern,origin};
    break;
   }
  }
  if(best)emit(best.pattern,best.origin);
 }
 return {positions,colors,coverage,fragments,triangles,occupiedSamples,
  truncated:fragments>=maxFragments||triangles>=maxTriangles};
}
