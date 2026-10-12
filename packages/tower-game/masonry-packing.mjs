import {bounds} from './core.mjs';
import {rockContains,rockCategory} from './masonry-geometry.mjs';
import {originalRockMesh} from './rock-shapes.mjs';
import {expandInfillRock} from './rock-adaptation.mjs';
import {fillAuthoredCavity} from './masonry-authored-infill.mjs';
import {ROCK_PACK} from '../../assets/tower/processed-rocks.mjs';
const SMALL_ROCKS=Object.freeze(ROCK_PACK.small.map((rock,i)=>expandInfillRock(originalRockMesh(rock,i))));

const STONES=new Set(['stone','medium','long','big']), OPENINGS=new Set(['door','window']);
const AXES=['x','y','z'];
const DIRS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
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
 const left=bounds(a),right=bounds(b),lowY=Math.max(left.y0,right.y0),highY=Math.min(left.y1,right.y1);
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const i=x+nx*y+stride*z,p=[x,y,z].map((v,k)=>min[k]+(v+.5)*dimension[k]);
  aSolid[i]=+rockContains(a,p,profiles);bSolid[i]=+rockContains(b,p,profiles);
  blocked[i]=+(axis!==1&&(p[1]<lowY+.18||p[1]>highY-.18)||openings.some(o=>p[0]>=o.x0-.08&&p[0]<=o.x1+.08&&p[1]>=o.y0-.08&&p[1]<=o.y1+.08&&p[2]>=o.z0-.08&&p[2]<=o.z1+.08)
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
 const candidateCells=countFilled;
 // Every independently classified free cell is accounted for; tiny residual
 // voids remain eligible for a narrow wedge or mortar substrate.
 return {nx,ny,nz,stride,min,dimension,mask,aSolid,bSolid,countFilled,candidateCells,
  seamAxis:axis,exteriorFaces:transverse.flatMap(a=>[[a,0],[a,1]])};
}

const empty=()=>({stonePositions:[],stoneColors:[],mortarPositions:[],mortarColors:[],candidateCells:0,filledCells:0,stoneFilledCells:0,mortarSurfaceCells:0,residualFreeVolume:0,candidateFreeVolume:0,stonePhysicalVolume:0,mortarPhysicalVolume:0,wedgePhysicalVolume:0,mortarForbiddenVolume:0,mortarPenetrationVolume:0,penetrationVolume:0,selfOverlapVolume:0,joints:0,fragments:0,truncated:false});

/** Fully tessellated rubble infill from real occupied/free volume in grid cells.
 * Derived presentation only: no saved blocks, no paid elements, no raycast targets.
 * A shared pair-cache makes repeated snapshots and layer refreshes cheap.
 */
export function packMasonryVolume(blocks,profiles,{spacing=.12,maxTriangles=180000,maxJoints=4500,maxFragmentsPerJoint=240,cache=null}={}){
 if(!profiles||!Array.isArray(blocks)||spacing<.08||spacing>.40)return empty();
 const openings=blocks.filter(b=>!STONES.has(b.type)).map(bounds);
 const stoneBoxes=blocks.filter(b=>STONES.has(b.type)).map(b=>({block:b,box:bounds(b),signature:signature(b)}));
 const openingSignature=blocks.filter(b=>!STONES.has(b.type)).map(signature).sort().join('/');
 const allJoints=findMasonryJoints(blocks),joints=allJoints.slice(0,maxJoints),out=empty();
 out.truncated=allJoints.length>joints.length;
 const store=cache||new Map();
 // Reserve enough GPU triangles for EVERY detected joint before adding detail.
 // Previously early joints consumed the entire mobile budget, leaving whole
 // later contacts visibly unfilled (48 of 49 in the 50-piece regression).
 const jointBudget=Math.floor(maxTriangles/Math.max(1,joints.length));
 for(const joint of joints){
  const corridor=[0,1,2].map(i=>i===joint.axis?[joint.plane-.7,joint.plane+.7]:joint.ranges[joint.transverse.indexOf(i)]);
  const neighbors=stoneBoxes.filter(entry=>
   entry.block.id!==joint.a.id&&entry.block.id!==joint.b.id&&
   corridor.every(([lo,hi],i)=>entry.box[AXES[i]+'0']<hi&&entry.box[AXES[i]+'1']>lo)
  );
  const surroundings=neighbors.map(e=>e.signature).sort().join('/');
  const key=joint.key+'|'+openingSignature+'|'+surroundings+'|'+spacing+'|'+jointBudget+'|'+maxFragmentsPerJoint;
  let piece=store.get(key);
  if(!piece){
   const grid=cavity(joint,profiles,openings,spacing,neighbors);
   const isSolidAt=p=>{
    if(rockContains(joint.a,p,profiles,0)||rockContains(joint.b,p,profiles,0))return true;
    if(openings.some(o=>p[0]>=o.x0&&p[0]<=o.x1&&p[1]>=o.y0&&p[1]<=o.y1&&p[2]>=o.z0&&p[2]<=o.z1))return true;
    return neighbors.some(o=>p[0]>=o.box.x0&&p[0]<=o.box.x1&&p[1]>=o.box.y0&&p[1]<=o.box.y1&&p[2]>=o.box.z0&&p[2]<=o.box.z1&&rockContains(o.block,p,profiles,0));
   };
   piece=grid?fillAuthoredCavity(grid,SMALL_ROCKS,{maxFragments:maxFragmentsPerJoint,maxTriangles:Math.min(jointBudget,95000),isSolidAt}):{...empty(),truncated:true};
   store.set(key,piece);
  }
  const triangles=(piece.stonePositions.length+piece.mortarPositions.length)/9;
  out.candidateCells+=piece.candidateCells;
  out.candidateFreeVolume+=piece.candidateFreeVolume||0;
  out.truncated=out.truncated||Boolean(piece.truncated);
  if((out.stonePositions.length+out.mortarPositions.length)/9+triangles>maxTriangles){
   out.truncated=true;
   out.residualFreeVolume+=piece.candidateFreeVolume||0;
   continue;
  }
  for(const [target,values]of [[out.stonePositions,piece.stonePositions],[out.stoneColors,piece.stoneColors],[out.mortarPositions,piece.mortarPositions],[out.mortarColors,piece.mortarColors]])
   for(let k=0;k<values.length;k++)target.push(values[k]);
  out.filledCells+=piece.filledCells;out.stoneFilledCells+=piece.stoneFilledCells||0;out.mortarSurfaceCells+=piece.mortarSurfaceCells||0;
  out.residualFreeVolume+=piece.residualFreeVolume||0;out.stonePhysicalVolume+=piece.stonePhysicalVolume||0;
  out.penetrationVolume+=piece.penetrationVolume||0;out.selfOverlapVolume+=piece.selfOverlapVolume||0;
  out.mortarPhysicalVolume+=piece.mortarPhysicalVolume||0;
  out.wedgePhysicalVolume+=piece.wedgePhysicalVolume||0;
  out.mortarForbiddenVolume+=piece.mortarForbiddenVolume||0;
  out.mortarPenetrationVolume+=piece.mortarPenetrationVolume||0;
  out.fragments+=piece.fragments||0;out.joints++;
 }
 if(cache){
  if(!joints.length)cache.clear();
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
  candidateCells:out.candidateCells,filledCells:out.filledCells,stoneFilledCells:out.stoneFilledCells,
  mortarSurfaceCells:out.mortarSurfaceCells,residualFreeVolume:out.residualFreeVolume,
  candidateFreeVolume:out.candidateFreeVolume,stonePhysicalVolume:out.stonePhysicalVolume,
  mortarPhysicalVolume:out.mortarPhysicalVolume,wedgePhysicalVolume:out.wedgePhysicalVolume,mortarForbiddenVolume:out.mortarForbiddenVolume,
  mortarPenetrationVolume:out.mortarPenetrationVolume,penetrationVolume:out.penetrationVolume,
  selfOverlapVolume:out.selfOverlapVolume,
  stoneCoverage:out.candidateFreeVolume?out.stonePhysicalVolume/out.candidateFreeVolume:0,
  totalCoverage:out.candidateFreeVolume?(out.stonePhysicalVolume+out.mortarPhysicalVolume)/out.candidateFreeVolume:0,
  coverageComplete:!out.truncated,joints:out.joints,fragments:out.fragments,truncated:out.truncated,
 };
}
