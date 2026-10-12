import {buildCoreMortar} from './masonry-core-mortar.mjs';
/** Worker-safe placement of seven authored small-rock meshes into measured
 * seam masks. Rocks are never bought, serialized or pickable.
 * Physical coverage is tracked separately from dark backing mortar.
 */
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const D=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
const AXES=[[1,2],[0,2],[0,1]];
export function buildAuthoredProfiles(mesh,res=28){
 const verts=Array.from({length:mesh.positions.length/3},(_,i)=>Array.from(mesh.positions.slice(i*3,i*3+3),v=>v+.5));
 return AXES.map(([u,v],axis)=>{
  const min=new Float32Array(res*res).fill(Infinity),max=new Float32Array(res*res).fill(-Infinity);
  for(let i=0;i<mesh.indices.length;i+=3){
   const a=verts[mesh.indices[i]],b=verts[mesh.indices[i+1]],c=verts[mesh.indices[i+2]];
   if(!a||!b||!c)continue;
   const det=(b[v]-c[v])*(a[u]-c[u])+(c[u]-b[u])*(a[v]-c[v]);
   if(Math.abs(det)<1e-10)continue;
   const x0=clamp(Math.floor(Math.min(a[u],b[u],c[u])*res-.5),0,res-1),x1=clamp(Math.ceil(Math.max(a[u],b[u],c[u])*res-.5),0,res-1);
   const y0=clamp(Math.floor(Math.min(a[v],b[v],c[v])*res-.5),0,res-1),y1=clamp(Math.ceil(Math.max(a[v],b[v],c[v])*res-.5),0,res-1);
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const X=(x+.5)/res,Y=(y+.5)/res;
    const t=((b[v]-c[v])*(X-c[u])+(c[u]-b[u])*(Y-c[v]))/det;
    const w=((c[v]-a[v])*(X-c[u])+(a[u]-c[u])*(Y-c[v]))/det;
    if(t<-.035||w<-.035||t+w>1.035)continue;
    const depth=t*a[axis]+w*b[axis]+(1-t-w)*c[axis],idx=y*res+x;
    min[idx]=Math.min(depth,min[idx]);max[idx]=Math.max(depth,max[idx]);
   }
  }
  for(let pass=0;pass<2;pass++){
   const oldMin=min.slice(),oldMax=max.slice();
   for(let y=0;y<res;y++)for(let x=0;x<res;x++){
    const i=y*res+x;if(Number.isFinite(oldMin[i]))continue;
    let lo=Infinity,hi=-Infinity,count=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     const xx=x+dx,yy=y+dy;if(xx<0||xx>=res||yy<0||yy>=res)continue;
     const j=yy*res+xx;if(!Number.isFinite(oldMin[j]))continue;
     lo=Math.min(lo,oldMin[j]);hi=Math.max(hi,oldMax[j]);count++;
    }
    if(count>=3){min[i]=lo;max[i]=hi;}
   }
  }
  return {min,max,res};
 });
}
export function authoredContains(fields,p){
 if(p.some(v=>v<0||v>1))return false;
 for(let a=0;a<3;a++){
  const [u,v]=AXES[a],f=fields[a];
  const x=clamp(Math.floor(p[u]*f.res),0,f.res-1),y=clamp(Math.floor(p[v]*f.res),0,f.res-1),i=y*f.res+x;
  if(!Number.isFinite(f.min[i])||p[a]<f.min[i]-.03||p[a]>f.max[i]+.03)return false;
 }
 return true;
}
const offset=(g,x,y,z)=>x+g.nx*y+g.stride*z;
const inGrid=(g,x,y,z)=>x>=0&&x<g.nx&&y>=0&&y<g.ny&&z>=0&&z<g.nz;
// Twenty-four proper cube rotations preserve the seven authored source forms.
const PARITY=p=>(p[0]>p[1])+(p[0]>p[2])+(p[1]>p[2]);
const CUBE_ROTATIONS=[];
for(const p of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]])
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
  if((PARITY(p)%2?-1:1)*x*y*z===1)CUBE_ROTATIONS.push([p,[x,y,z]]);
 }
const identity=CUBE_ROTATIONS.findIndex(([p,s])=>p.every((v,i)=>v===i)&&s.every(v=>v===1));
[CUBE_ROTATIONS[0],CUBE_ROTATIONS[identity]]=[CUBE_ROTATIONS[identity],CUBE_ROTATIONS[0]];
const rot=(v,r)=>{const [p,s]=CUBE_ROTATIONS[r%24];return p.map((axis,i)=>s[i]*v[axis]);};
const invrot=(v,r)=>{const [p,s]=CUBE_ROTATIONS[r%24],out=[0,0,0];for(let i=0;i<3;i++)out[p[i]]=v[i]*s[i];return out;};
function physicalMesh(result,mesh,box,min,dimension,rotation,fit=.93){
 const size=box.lo.map((v,i)=>(box.hi[i]-v+1)*dimension[i]*fit);
 const center=box.lo.map((v,i)=>min[i]+(v+box.hi[i]+1)*.5*dimension[i]);
 const shade=[.84,.86,.89,.9,.93,.97,1.02][result.fragments%7];
 const src=mesh.positions,idx=mesh.indices;
 for(let i=0;i<idx.length;i++){
  const n=idx[i]*3,p=[src[n],src[n+1],src[n+2]];
  const q=rot(p,rotation).map((v,k)=>v*size[k]);
  for(let k=0;k<3;k++)result.stonePositions.push(center[k]+q[k]);
  for(let k=0;k<3;k++){
   const srgb=mesh.colors[n+k]??.52;
   const linear=srgb<=.04045?srgb/12.92:((srgb+.055)/1.055)**2.4;
   result.stoneColors.push(Math.max(.01,Math.min(1,linear*shade)));
  }
 }
}
function mortarShell(result,g,assigned,maxTriangles){
 const min=g.min,delta=g.dimension;
 const verts=(x,y,z)=>[min[0]+x*delta[0],min[1]+y*delta[1],min[2]+z*delta[2]];
 const faces=[[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],[[0,0,1],[0,0,0],[1,0,0],[1,0,1]],[[0,1,0],[0,1,1],[1,1,1],[1,1,0]],[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]];
 outer:for(let z=0;z<g.nz;z++)for(let y=0;y<g.ny;y++)for(let x=0;x<g.nx;x++){
  const i=offset(g,x,y,z);if(!g.mask[i]||assigned[i])continue;
  for(let f=0;f<6;f++){
   const [dx,dy,dz]=D[f],xx=x+dx,yy=y+dy,zz=z+dz;
   if(inGrid(g,xx,yy,zz)&&g.mask[offset(g,xx,yy,zz)]&&!assigned[offset(g,xx,yy,zz)])continue;
   if((result.stonePositions.length+result.mortarPositions.length)/9+2>maxTriangles){result.truncated=true;break outer;}
   const c=faces[f].map(v=>verts(x+v[0],y+v[1],z+v[2]));
   for(const k of [0,1,2,0,2,3]){result.mortarPositions.push(...c[k]);result.mortarColors.push(.11,.105,.095);}
  }
  result.mortarSurfaceCells++;
 }
}
function candidateClear(mesh,lo,hi,min,delta,fit,rotation,isSolidAt){
 if(!isSolidAt)return true;
 const center=lo.map((v,k)=>min[k]+(v+hi[k]+1)*.5*delta[k]);
 const size=lo.map((v,k)=>(hi[k]-v+1)*delta[k]*fit);
 const at=j=>{
  const p=rot([mesh.positions[j*3],mesh.positions[j*3+1],mesh.positions[j*3+2]],rotation).map((v,k)=>v*size[k]);
  return p.map((v,k)=>center[k]+v);
 };
 const checked=new Set();
 for(let i=0;i<mesh.indices.length;i+=3){
  const ids=[mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]],pts=ids.map(j=>at(j));
  for(let k=0;k<3;k++)if(!checked.has(ids[k])){
   checked.add(ids[k]);if(isSolidAt(pts[k]))return false;
  }
  const avg=pts[0].map((v,k)=>(v+pts[1][k]+pts[2][k])/3);
  if(isSolidAt(avg))return false;
  for(let k=0;k<3;k++)if(isSolidAt(pts[k].map((v,j)=>(v+pts[(k+1)%3][j])/2)))return false;
 }
 return true;
}
/** Occupied stone cells are sampled from real authored meshes; enclosing boxes
 * and flat mortar faces receive NO fictitious stone volume credit. */
export function fillAuthoredCavity(grid,smallMeshes,{maxFragments=240,maxTriangles=95000,isSolidAt=null}={}){
 if(!grid||!smallMeshes?.length)throw new TypeError('Cavity mask and small authored meshes required');
 const g=grid,num=g.nx*g.ny*g.nz,mask=g.mask;
 if(num!==mask.length||g.stride!==g.nx*g.ny)throw new RangeError('Invalid cavity grid');
 const out={stonePositions:[],stoneColors:[],mortarPositions:[],mortarColors:[],modelsConsidered:smallMeshes.length,fragments:0,stoneFilledCells:0,mortarSurfaceCells:0,candidateCells:0,filledCells:0,stoneCoverage:0,residualFreeVolume:0,candidateFreeVolume:0,stonePhysicalVolume:0,mortarPhysicalVolume:0,wedgePhysicalVolume:0,mortarForbiddenVolume:0,mortarPenetrationVolume:0,penetrationVolume:0,selfOverlapVolume:0,truncated:false};
 for(let i=0;i<num;i++)out.candidateCells+=+!!mask[i];
 if(!out.candidateCells)return out;
 const occupied=new Uint8Array(num),profiles=smallMeshes.map(m=>buildAuthoredProfiles(m));
 const sampleAxis=Number.isInteger(g.seamAxis)&&maxTriangles<6500?2:3;
 const stoneTriangleBudget=Number.isInteger(g.seamAxis)?Math.floor(maxTriangles*(maxTriangles<1600?.10:maxTriangles<6500?.18:.28)):maxTriangles;
 const perCell=sampleAxis**3,coverage=new Uint8Array(num*perCell);
 const samplePoint=(x,y,z,sx,sy,sz)=>[
  g.min[0]+(x+(sx+.5)/sampleAxis)*g.dimension[0],
  g.min[1]+(y+(sy+.5)/sampleAxis)*g.dimension[1],
  g.min[2]+(z+(sz+.5)/sampleAxis)*g.dimension[2],
 ];
 const boxFree=(lo,hi)=>{
  for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++)
   if(!inGrid(g,x,y,z)||!mask[offset(g,x,y,z)]||occupied[offset(g,x,y,z)])return false;
  return true;
 };

 // Reserve actual sampled geometry, not just center voxels. Two fillers may
 // share an enclosing grid cell, but cannot occupy the same physical sample.
 const physicalFootprint=(field,lo,hi,rotation,fit)=>{
  const center=lo.map((v,k)=>g.min[k]+(v+hi[k]+1)*.5*g.dimension[k]);
  const extent=lo.map((v,k)=>(hi[k]-v+1)*g.dimension[k]);
  const samples=[];
  for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){
   const cell=offset(g,x,y,z);if(!mask[cell])return null;
   for(let sz=0;sz<sampleAxis;sz++)for(let sy=0;sy<sampleAxis;sy++)for(let sx=0;sx<sampleAxis;sx++){
    const p=samplePoint(x,y,z,sx,sy,sz);
    const local=invrot(p.map((v,k)=>(v-center[k])/(extent[k]*fit)),rotation).map(v=>v+.5);
    if(!authoredContains(field,local))continue;
    const at=cell*perCell+sx+sampleAxis*sy+sampleAxis*sampleAxis*sz;
    if(coverage[at]||isSolidAt?.(p))return null;
    samples.push(at);
   }
  }
  return samples;
 };
 const cells=Array.from({length:num},(_,i)=>i).filter(i=>mask[i]);
 // Prioritize actual authored pebbles along visible outer recesses.
 const exteriorDepth=i=>{
  const c=[i%g.nx,Math.floor(i/g.nx)%g.ny,Math.floor(i/g.stride)];
  const faces=g.exteriorFaces||[];
  return faces.length?Math.min(...faces.map(([axis,side])=>side===0?c[axis]:[g.nx,g.ny,g.nz][axis]-1-c[axis])):Infinity;
 };
 cells.sort((a,b)=>{
  const dist=exteriorDepth(a)-exteriorDepth(b);
  if(dist)return dist;
  const neighbors=i=>{
   const x=i%g.nx,y=Math.floor(i/g.nx)%g.ny,z=Math.floor(i/g.stride);let n=0;
   for(const [dx,dy,dz]of D)if(inGrid(g,x+dx,y+dy,z+dz)&&mask[offset(g,x+dx,y+dy,z+dz)])n++;
   return n;
  };return neighbors(b)-neighbors(a)||a-b;
 });
 for(const i of cells){
  if(out.fragments>=maxFragments){out.truncated=true;break;}
  if(out.stonePositions.length/9>=stoneTriangleBudget)break;
  if(occupied[i])continue;
  const x=i%g.nx,y=Math.floor(i/g.nx)%g.ny,z=Math.floor(i/g.stride),lo=[x,y,z],hi=[x,y,z];
  if(!boxFree(lo,hi))continue;
  let moved=true;
  while(moved){
   moved=false;let best=null,bestScore=-Infinity;
   for(let a=0;a<3;a++)for(const dir of [-1,1]){
    const L=lo.slice(),H=hi.slice();if(dir<0)L[a]--;else H[a]++;
    const size=L.map((v,k)=>(H[k]-v+1)*g.dimension[k]);
    if(size.some(v=>v>.60)||size.reduce((s,v)=>s*v,1)>.27||!boxFree(L,H))continue;
    const score=size.reduce((s,v)=>s+Math.sqrt(v),0)-size.reduce((s,v)=>s*v,1)*.2;
    if(score>bestScore){bestScore=score;best={L,H};}
   }
   if(best){lo.splice(0,3,...best.L);hi.splice(0,3,...best.H);moved=true;}
  }
  const rotation=(i*17+out.fragments*11)%24;
  const center=lo.map((v,k)=>(v+hi[k]+1)*.5);
  const extent=lo.map((v,k)=>(hi[k]-v+1)*g.dimension[k]);
  let model=-1,matched=[],bestFit=.93;
  for(let attempt=0;attempt<smallMeshes.length;attempt++){
   const variant=(attempt+out.fragments)%smallMeshes.length,field=profiles[variant];
   for(const fit of [.93,.82,.72,.62,.52]){
    if(!candidateClear(smallMeshes[variant],lo,hi,g.min,g.dimension,fit,rotation,isSolidAt))continue;
    const samples=[];
    for(let zz=lo[2];zz<=hi[2];zz++)for(let yy=lo[1];yy<=hi[1];yy++)for(let xx=lo[0];xx<=hi[0];xx++){
     const relative=[xx,yy,zz].map((v,k)=>(v+.5-center[k])*g.dimension[k]);
     const p=invrot(relative.map((v,k)=>v/(extent[k]*fit)),rotation).map(v=>v+.5);
     if(authoredContains(field,p))samples.push(offset(g,xx,yy,zz));
    }
    if(samples.length>matched.length){matched=samples;model=variant;bestFit=fit;}
    if(matched.length>(hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)*(hi[2]-lo[2]+1)*.48)break;
   }
   if(matched.length>(hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)*(hi[2]-lo[2]+1)*.48)break;
  }
  if(!matched.length)continue;
  let physical=null;
  const chosen=bestFit;
  for(const fit of [chosen,...[.82,.72,.62,.52,.42,.32].filter(value=>value<chosen-.001)]){
   if(!candidateClear(smallMeshes[model],lo,hi,g.min,g.dimension,fit,rotation,isSolidAt))continue;
   const trial=physicalFootprint(profiles[model],lo,hi,rotation,fit);
   if(trial?.length){physical=trial;bestFit=fit;break;}
  }
  if(!physical)continue; // Candidate collides with installed source/infill.
  if(bestFit!==chosen){
   matched=[];
   for(let zz=lo[2];zz<=hi[2];zz++)for(let yy=lo[1];yy<=hi[1];yy++)for(let xx=lo[0];xx<=hi[0];xx++){
    const p=invrot([xx,yy,zz].map((v,k)=>(v+.5-center[k])*g.dimension[k]/(extent[k]*bestFit)),rotation).map(v=>v+.5);
    if(authoredContains(profiles[model],p))matched.push(offset(g,xx,yy,zz));
   }
   if(!matched.length)continue;
  }
  if(out.stonePositions.length/9+smallMeshes[model].indices.length/3>stoneTriangleBudget)break;
  physicalMesh(out,smallMeshes[model],{lo,hi},g.min,g.dimension,rotation,bestFit);
  for(const at of physical)coverage[at]=1;
  for(const k of matched)occupied[k]=1;
  out.fragments++;out.stoneFilledCells+=matched.length;
 }
 // Under the 20/60/20 rule a real 3D central mortar solid is meshed
 // after all authored exterior rubble has been placed. The legacy
 // surface-only diagnostic remains for standalone callers without a seam.
 if(Number.isInteger(g.seamAxis)){
  const rockPalette=smallMeshes.map(mesh=>{
   const rgb=[0,0,0];const total=Math.max(1,mesh.colors.length/3);
   for(let j=0;j<mesh.colors.length;j++)rgb[j%3]+=mesh.colors[j]/total;
   return rgb.map(v=>Math.max(.07,Math.min(.6,v<=.04045?v/12.92:((v+.055)/1.055)**2.4)));
  });
  const mortar=buildCoreMortar(g,coverage,{
   isSolidAt,maxTriangles:Math.max(0,maxTriangles-out.stonePositions.length/9),
   subdivisions:sampleAxis,rockPalette,rockContours:smallMeshes.map(mesh=>mesh.positions),
  });
  for(const v of mortar.wedgePositions)out.stonePositions.push(v);
  for(const v of mortar.wedgeColors)out.stoneColors.push(v);
  for(const v of mortar.positions)out.mortarPositions.push(v);
  for(const v of mortar.colors)out.mortarColors.push(v);
  out.mortarPhysicalVolume=mortar.volume;
  out.wedgePhysicalVolume=mortar.wedgeVolume;
  out.mortarForbiddenVolume=mortar.forbiddenVolume;
  out.mortarPenetrationVolume=mortar.penetrationVolume;
  out.mortarSurfaceCells=mortar.faces;
  out.truncated=out.truncated||mortar.truncated;
 }else{
  mortarShell(out,g,occupied,maxTriangles);
 }

 // Measure occupied physical volume using samples inside the rendered source
 // meshes, NOT the greedy envelopes or a single center sample per cell.
 // A sample inside an existing large rock is penetration, never filled space.
 // Overlapping authored fragments count only once in the occupied union.
 let freeSamples=0,stoneSamples=0,penetrationSamples=0,overlapSamples=0;
 for(let z=0;z<g.nz;z++)for(let y=0;y<g.ny;y++)for(let x=0;x<g.nx;x++){
  const cell=offset(g,x,y,z);if(!mask[cell])continue;
  for(let sz=0;sz<sampleAxis;sz++)for(let sy=0;sy<sampleAxis;sy++)for(let sx=0;sx<sampleAxis;sx++){
   const at=cell*perCell+sx+sampleAxis*sy+sampleAxis*sampleAxis*sz;
   const blocked=Boolean(isSolidAt?.(samplePoint(x,y,z,sx,sy,sz)));
   if(!blocked)freeSamples++;
   if(!coverage[at])continue;
   if(blocked)penetrationSamples++;
   else{stoneSamples++;if(coverage[at]>1)overlapSamples++;}
  }
 }
 const sampleVolume=g.dimension.reduce((a,b)=>a*b,1)/perCell;
 out.candidateFreeVolume=freeSamples*sampleVolume;
 out.stonePhysicalVolume=stoneSamples*sampleVolume+out.wedgePhysicalVolume;
 out.penetrationVolume=penetrationSamples*sampleVolume;
 out.selfOverlapVolume=overlapSamples*sampleVolume;
 out.residualFreeVolume=Math.max(0,out.candidateFreeVolume-out.stonePhysicalVolume-out.mortarPhysicalVolume);
 out.filledCells=out.stoneFilledCells; // legacy diagnostic, NOT physical coverage
 out.stoneCoverage=out.candidateFreeVolume?out.stonePhysicalVolume/out.candidateFreeVolume:0;
 out.totalCoverage=out.candidateFreeVolume?(out.stonePhysicalVolume+out.mortarPhysicalVolume)/out.candidateFreeVolume:0;
 return out;
}
