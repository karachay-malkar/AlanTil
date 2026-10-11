import {bounds} from './core.mjs';
import {rockContains} from './masonry-geometry.mjs';

const STONES=new Set(['stone','medium','long','big']), OPENINGS=new Set(['door','window']);
const AXES=['x','y','z'];
const DIRS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const CORNERS=[
 [[1,0,0],[1,1,0],[1,1,1],[1,0,1]],
 [[0,0,1],[0,1,1],[0,1,0],[0,0,0]],
 [[0,1,0],[0,1,1],[1,1,1],[1,1,0]],
 [[0,0,1],[0,0,0],[1,0,0],[1,0,1]],
 [[0,0,1],[1,0,1],[1,1,1],[0,1,1]],
 [[1,0,0],[0,0,0],[0,1,0],[1,1,0]],
];
const hash=(x,y=0,z=0,salt=0)=>{
 let n=(Math.imul(x|0,73856093)^Math.imul(y|0,19349663)^Math.imul(z|0,83492791)^salt^0x45d9f3b)|0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);n^=n>>>16;
 return (n>>>0)/4294967296;
};
const signature=b=>[b.x,b.y,b.z,b.sx,b.sy,b.sz,b.rotation||0,b.variant||0,b.id].join(':');
const overlap=(a,b,c,d)=>[Math.max(a,c),Math.min(b,d)];

export function findMasonryJoints(blocks){
 if(!Array.isArray(blocks))return [];
 const solids=blocks.filter(b=>STONES.has(b.type)).map(b=>({block:b,box:bounds(b),key:signature(b)}))
   .sort((a,b)=>a.key.localeCompare(b.key));
 const planes=new Map();
 for(const entry of solids)for(let axis=0;axis<3;axis++){
  const a=AXES[axis];
  for(let side=0;side<2;side++){
   const plane=entry.box[a+(side?'1':'0')],key=a+':'+plane;
   if(!planes.has(key))planes.set(key,[[],[]]);
   planes.get(key)[side].push(entry);
  }
 }
 const joints=[];
 for(const [key,sides] of planes){
  const axis=AXES.indexOf(key[0]),transverse=[0,1,2].filter(i=>i!==axis);
  const tiles=new Map();
  const tileKeys=box=>{
   const out=[],a=AXES[transverse[0]],b=AXES[transverse[1]];
   for(let i=Math.floor(box[a+'0']/4);i<=Math.floor((box[a+'1']-.001)/4);i++)
    for(let j=Math.floor(box[b+'0']/4);j<=Math.floor((box[b+'1']-.001)/4);j++)out.push(i+':'+j);
   return out;
  };
  for(const entry of sides[0])for(const tile of tileKeys(entry.box)){
   if(!tiles.has(tile))tiles.set(tile,[]);
   tiles.get(tile).push(entry);
  }
  for(const entry of sides[1]){
   const matches=new Map();
   for(const tile of tileKeys(entry.box))for(const other of tiles.get(tile)||[])matches.set(other.key,other);
   for(const other of [...matches.values()].sort((a,b)=>a.key.localeCompare(b.key))){
    const ranges=transverse.map(i=>overlap(entry.box[AXES[i]+'0'],entry.box[AXES[i]+'1'],other.box[AXES[i]+'0'],other.box[AXES[i]+'1']));
    if(ranges.some(([lo,hi])=>hi-lo<.55))continue;
    joints.push({axis,plane:Number(key.slice(2)),a:entry.block,b:other.block,ranges,transverse,
      key:[entry.key,other.key].sort().join('|')});
   }
  }
 }
 return joints.sort((a,b)=>a.key.localeCompare(b.key));
}

function cavity(joint,profiles,openings,spacing,otherSolids=[]){
 const {axis,plane,ranges,transverse,a,b}=joint;
 const min=[0,0,0],max=[0,0,0];
 min[axis]=plane-.7;max[axis]=plane+.7;
 for(let i=0;i<2;i++){min[transverse[i]]=ranges[i][0];max[transverse[i]]=ranges[i][1];}
 const sizes=min.map((v,i)=>Math.ceil((max[i]-v)/spacing));
 if(sizes.some(v=>v<=0)||sizes.reduce((a,b)=>a*b,1)>30000)return null;
 const [nx,ny,nz]=sizes,stride=nx*ny,count=stride*nz,dimension=min.map((v,i)=>(max[i]-v)/sizes[i]);
 const aSolid=new Uint8Array(count),bSolid=new Uint8Array(count),blocked=new Uint8Array(count);
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const i=x+nx*y+stride*z,p=[x,y,z].map((v,k)=>min[k]+(v+.5)*dimension[k]);
  aSolid[i]=+rockContains(a,p,profiles);bSolid[i]=+rockContains(b,p,profiles);
  blocked[i]=+(openings.some(o=>p[0]>=o.x0-.08&&p[0]<=o.x1+.08&&p[1]>=o.y0-.08&&p[1]<=o.y1+.08&&p[2]>=o.z0-.08&&p[2]<=o.z1+.08)
    ||otherSolids.some(o=>p[0]>=o.box.x0&&p[0]<=o.box.x1&&p[1]>=o.box.y0&&p[1]<=o.box.y1&&p[2]>=o.box.z0&&p[2]<=o.box.z1&&rockContains(o.block,p,profiles)));
 }
 function distances(solids){
  const dist=new Uint8Array(count).fill(255),queue=new Int32Array(count);let head=0,tail=0;
  for(let i=0;i<count;i++)if(solids[i]){dist[i]=0;queue[tail++]=i;}
  while(head<tail){
   const i=queue[head++],d=dist[i]+1;if(d>4)continue;
   const z=Math.floor(i/stride),y=Math.floor((i-z*stride)/nx),x=i%nx;
   for(const [dx,dy,dz]of DIRS){
    const xx=x+dx,yy=y+dy,zz=z+dz;
    if(xx<0||xx>=nx||yy<0||yy>=ny||zz<0||zz>=nz)continue;
    const n=xx+nx*yy+stride*zz;
    if(d<dist[n]){dist[n]=d;queue[tail++]=n;}
   }
  }
  return dist;
 }
 const da=distances(aSolid),db=distances(bSolid),mask=new Uint8Array(count);
 let countFilled=0;
 for(let i=0;i<count;i++){
  if(aSolid[i]||bSolid[i]||blocked[i])continue;
  const radius=axis===1?2:3;
  if(da[i]>radius||db[i]>radius)continue;
  mask[i]=1;countFilled++;
 }
 // Remove isolated flakes. Nothing may be placed solely from an AABB seam.
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const i=x+nx*y+stride*z;if(!mask[i])continue;
  let neighbors=0;
  for(const [dx,dy,dz]of DIRS){
   const xx=x+dx,yy=y+dy,zz=z+dz;
   if(xx<0||xx>=nx||yy<0||yy>=ny||zz<0||zz>=nz)continue;
   if(mask[xx+nx*yy+stride*zz])neighbors++;
  }
  if(neighbors<2){mask[i]=0;countFilled--;}
 }
 return {nx,ny,nz,stride,min,dimension,mask,aSolid,bSolid,countFilled};
}

function nearestSeed(x,y,z){
 // Stable jittered 3D Voronoi cells yield irregular, coherent rubble fragments.
 const w=2.8,cx=Math.floor(x/w),cy=Math.floor(y/w),cz=Math.floor(z/w);
 let nearest=Infinity,key=0;
 for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const a=cx+dx,b=cy+dy,c=cz+dz;
  const sx=(a+.17+.66*hash(a,b,c,1))*w,sy=(b+.17+.66*hash(a,b,c,2))*w,sz=(c+.17+.66*hash(a,b,c,3))*w;
  const length=(x-sx)**2*.9+(y-sy)**2*1.2+(z-sz)**2*.85;
  if(length<nearest){nearest=length;key=(Math.imul(a,73856093)^Math.imul(b,19349663)^Math.imul(c,83492791))|0;}
 }
 return key;
}
const empty=()=>({stonePositions:[],stoneColors:[],mortarPositions:[],mortarColors:[],candidateCells:0,filledCells:0,joints:0});

function surface(volume,joint){
 const out=empty();out.candidateCells=volume.countFilled;out.filledCells=volume.countFilled;
 const {nx,ny,nz,stride,min,dimension,mask,aSolid,bSolid}=volume;
 const positions=joint.axis===1?out.mortarPositions:out.stonePositions;
 const colors=joint.axis===1?out.mortarColors:out.stoneColors;
 const tint=joint.axis===1?[.365,.35,.325]:[.62,.61,.56];
 const raw=(x,y,z)=>[min[0]+x*dimension[0],min[1]+y*dimension[1],min[2]+z*dimension[2]];
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const idx=x+nx*y+stride*z;if(!mask[idx])continue;
  const key=nearestSeed(x+min[0]/dimension[0],y+min[1]/dimension[1],z+min[2]/dimension[2]);
  const variation=(hash(key,0,0,8)-.5)*.15;
  for(let face=0;face<6;face++){
   const [dx,dy,dz]=DIRS[face],xx=x+dx,yy=y+dy,zz=z+dz;
   if(xx>=0&&xx<nx&&yy>=0&&yy<ny&&zz>=0&&zz<nz){
    const n=xx+nx*yy+stride*zz;
    if(mask[n]||aSolid[n]||bSolid[n])continue;
   }
   const shade=face===2?1.08:face===3?.81:face===0||face===4?.95:.87;
   const color=tint.map(v=>Math.min(1,Math.max(.04,(v+variation)*shade)));
   const corners=CORNERS[face].map(v=>{
    const point=raw(x+v[0],y+v[1],z+v[2]),jitter=.055*Math.min(...dimension);
    return point.map((val,k)=>Math.max(min[k],Math.min(min[k]+[nx,ny,nz][k]*dimension[k],val+(hash(x+v[0],y+v[1],z+v[2],k+11)-.5)*jitter)));
   });
   const center=[0,1,2].map(i=>corners.reduce((sum,p)=>sum+p[i],0)/4);
   const perpendicular=Math.floor(face/2),sign=face%2===0?1:-1;
   center[perpendicular]+=sign*(hash(x,y,z,face+60)-.5)*Math.min(...dimension)*.14;
   for(let k=0;k<4;k++)for(const p of [corners[k],corners[(k+1)%4],center]){
    positions.push(...p);colors.push(...color);
   }
   // Mortar is visible only between different Voronoi fragments, not on every voxel.
   if(joint.axis!==1)for(let edge=0;edge<4;edge++){
    const left=CORNERS[face][edge],right=CORNERS[face][(edge+1)%4];
    const normalAxis=Math.floor(face/2);
    const tangent=[0,1,2].find(k=>k!==normalAxis&&left[k]===right[k]);
    if(tangent===undefined)continue;
    const neighbor=[x,y,z];neighbor[tangent]+=left[tangent]===0?-1:1;
    if(neighbor.some((v,k)=>v<0||v>=[nx,ny,nz][k]))continue;
    const other=neighbor[0]+nx*neighbor[1]+stride*neighbor[2];
    if(!mask[other])continue;
    const exposed=neighbor.slice();exposed[normalAxis]+=face%2===0?1:-1;
    if(exposed.every((v,k)=>v>=0&&v<[nx,ny,nz][k])){
     const i=exposed[0]+nx*exposed[1]+stride*exposed[2];
     if(mask[i]||aSolid[i]||bSolid[i])continue;
    }
    const neighborSeed=nearestSeed(neighbor[0]+min[0]/dimension[0],neighbor[1]+min[1]/dimension[1],neighbor[2]+min[2]/dimension[2]);
    if(neighborSeed===key||neighborSeed<key)continue;
    const strip=.085,nudge=(face%2===0?1:-1)*Math.min(...dimension)*.017;
    const lift=p=>p.map((v,k)=>v+(k===normalAxis?nudge:0));
    const inset=p=>p.map((v,k)=>v*(1-strip)+center[k]*strip+(k===normalAxis?nudge:0));
    const p0=lift(corners[edge]),p1=lift(corners[(edge+1)%4]);
    for(const triangle of [[p0,p1,inset(corners[(edge+1)%4])],[p0,inset(corners[(edge+1)%4]),inset(corners[edge])]])
     for(const p of triangle){positions.push(...p);colors.push(.31,.30,.275);}
   }
  }
 }
 return out;
}

/** Fully tessellated rubble infill from real occupied/free volume in grid cells.
 * Derived presentation only: no saved blocks, no paid elements, no raycast targets.
 * A shared pair-cache makes repeated snapshots and layer refreshes cheap.
 */
export function packMasonryVolume(blocks,profiles,{spacing=.19,maxTriangles=180000,maxJoints=4500,cache=null}={}){
 if(!profiles||!Array.isArray(blocks)||spacing<.10||spacing>.40)return empty();
 const openings=blocks.filter(b=>!STONES.has(b.type)).map(bounds);
 const stoneBoxes=blocks.filter(b=>STONES.has(b.type)).map(b=>({block:b,box:bounds(b),signature:signature(b)}));
 const openingSignature=blocks.filter(b=>!STONES.has(b.type)).map(signature).sort().join('/');
 const out=empty(),joints=findMasonryJoints(blocks).slice(0,maxJoints);
 const store=cache||new Map();
 for(const joint of joints){
  const corridor=[0,1,2].map(i=>i===joint.axis?[joint.plane-.7,joint.plane+.7]:joint.ranges[joint.transverse.indexOf(i)]);
  const neighbors=stoneBoxes.filter(entry=>
   entry.block.id!==joint.a.id&&entry.block.id!==joint.b.id&&
   corridor.every(([lo,hi],i)=>entry.box[AXES[i]+'0']<hi&&entry.box[AXES[i]+'1']>lo)
  );
  const surroundings=neighbors.map(e=>e.signature).sort().join('/');
  const key=joint.key+'|'+openingSignature+'|'+surroundings+'|'+spacing;
  let piece=store.get(key);
  if(!piece){const grid=cavity(joint,profiles,openings,spacing,neighbors);piece=grid?surface(grid,joint):empty();store.set(key,piece);}
  const triangles=(piece.stonePositions.length+piece.mortarPositions.length)/9;
  if((out.stonePositions.length+out.mortarPositions.length)/9+triangles>maxTriangles)break;
  for(const [target,values]of [[out.stonePositions,piece.stonePositions],[out.stoneColors,piece.stoneColors],[out.mortarPositions,piece.mortarPositions],[out.mortarColors,piece.mortarColors]])
   for(let k=0;k<values.length;k++)target.push(values[k]);
  out.candidateCells+=piece.candidateCells;out.filledCells+=piece.filledCells;out.joints++;
 }
 if(cache){
  // Keep recently used joints to avoid expensive revoxelization on layer toggles.
  // Bound memory without retaining an unbounded history of saved revisions.
  if(cache.size>Math.max(128,joints.length*2)){
   const obsolete=cache.size-Math.max(128,joints.length*2);
   for(const key of [...cache.keys()].slice(0,obsolete))cache.delete(key);
  }
 }
 return {
  stonePositions:Float32Array.from(out.stonePositions),stoneColors:Float32Array.from(out.stoneColors),
  mortarPositions:Float32Array.from(out.mortarPositions),mortarColors:Float32Array.from(out.mortarColors),
  candidateCells:out.candidateCells,filledCells:out.filledCells,joints:out.joints,
 };
}
