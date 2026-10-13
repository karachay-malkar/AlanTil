/** Unsnapped section-envelope placement proposals; preview only.
 * The authoritative server must recheck physical authored-mesh collisions,
 * contacts, ownership, funds and idempotency before any paid mutation.
 */
import {sectionEnvelope} from './section-masonry.mjs';
const LIMIT=[60,80,60],EPS=1e-5;
const intersect=(a0,a1,b0,b1)=>Math.max(0,Math.min(a1,b1)-Math.max(a0,b0));
function box(b){const a=sectionEnvelope(b);return{lo:a.min,hi:a.max};}
export function validateSectionPlacement(placed,candidate,{minSupport=.32}={}){
 if(!Array.isArray(placed)||!candidate)return{ok:false,reason:'invalid'};
 if(![candidate.x,candidate.y,candidate.z,candidate.sx,candidate.sy,candidate.sz].every(Number.isFinite)||
  [candidate.sx,candidate.sy,candidate.sz].some(v=>v<=0))return{ok:false,reason:'invalid'};
 const a=box(candidate);
 if(a.lo.some(v=>v<0-EPS)||a.hi.some((v,i)=>v>LIMIT[i]+EPS))return{ok:false,reason:'bounds'};
 for(const b of placed){if(b.id===candidate.id)continue;const other=box(b);
  if([0,1,2].every(i=>intersect(a.lo[i],a.hi[i],other.lo[i],other.hi[i])>EPS))return{ok:false,reason:'collision'};
 }
 if(a.lo[1]<EPS)return{ok:true,reason:'',support:1,ground:true};
 const beneath=placed.filter(b=>Math.abs(box(b).hi[1]-a.lo[1])<.025);
 if(!beneath.length)return{ok:false,reason:'insufficient-support',support:0};
 // A fixed sample grid estimates contact coverage without assuming integer cells.
 let count=0;const n=11;
 for(let ix=0;ix<n;ix++)for(let iz=0;iz<n;iz++){
  const x=a.lo[0]+(ix+.5)*(a.hi[0]-a.lo[0])/n,z=a.lo[2]+(iz+.5)*(a.hi[2]-a.lo[2])/n;
  if(beneath.some(b=>{const r=box(b);return x>=r.lo[0]-EPS&&x<=r.hi[0]+EPS&&z>=r.lo[2]-EPS&&z<=r.hi[2]+EPS;}))count++;
 }
 const support=count/(n*n);
 if(support<minSupport)return{ok:false,reason:'insufficient-support',support};
 const cx=(a.lo[0]+a.hi[0])/2,cz=(a.lo[2]+a.hi[2])/2;
 if(!beneath.some(b=>{const r=box(b);return cx>=r.lo[0]-EPS&&cx<=r.hi[0]+EPS&&cz>=r.lo[2]-EPS&&cz<=r.hi[2]+EPS;}))
  return{ok:false,reason:'unstable-centre',support};
 return{ok:true,reason:'',ground:false,support};
}
export function findSectionPlacements({size,sections=[],camera,maxResults=5}={}){
 if(!Array.isArray(size)||size.length!==3||size.some(v=>!Number.isFinite(v)||v<=0)||!Array.isArray(sections)||!Array.isArray(camera?.target)||camera.target.length!==3)return [];
 const target=camera.target;if(!target.every(Number.isFinite))return [];
 const [sx,sy,sz]=size,candidates=new Map();
 const add=(x,y,z)=>{
  const p=[x,y,z];if(!p.every(Number.isFinite))return;
  const key=p.map(v=>v.toFixed(5)).join(':');if(candidates.has(key))return;
  const block={id:'__proposal__',type:'masonry_section',x,y,z,sx,sy,sz,rotation:0};
  const check=validateSectionPlacement(sections,block);if(!check.ok)return;
  const center=[x+sx/2,y+sy/2,z+sz/2],distance=Math.hypot(...center.map((n,i)=>n-target[i]));
  const forward=Array.isArray(camera.forward)?camera.forward:null;
  const facing=forward?forward[0]*(center[0]-target[0])+forward[1]*(center[1]-target[1])+forward[2]*(center[2]-target[2]):0;
  const score=(check.support||0)*3-distance*.18+facing*.025;
  candidates.set(key,{position:p,score,valid:true,check});
 };
 add(target[0]-sx/2,0,target[2]-sz/2);
 for(const b of sections){
  const a=sectionEnvelope(b),[x,y,z]=a.min,[dx,dy,dz]=a.size;
  const alignX=x+(dx-sx)/2,alignZ=z+(dz-sz)/2;
  for(const level of [0]){
   add(x-sx,level,alignZ);add(x+dx,level,alignZ);
   add(alignX,level,z-sz);add(alignX,level,z+dz);
  }
  for(const skew of [0,-.27,.27])add(alignX+skew,y+dy,alignZ-skew);
 }
 return [...candidates.values()].sort((a,b)=>b.score-a.score||a.position.join(':').localeCompare(b.position.join(':'))).slice(0,Math.max(1,Math.min(10,maxResults)));
}
