/**
 * AlanTil v2 exploratory, read-only, no-grid placement core.
 * Mesh surfaces stay AUTHORED and unchanged; collision volume is conservative
 * convex hull because input GLB is OPEN and has no reliable inside/outside.
 * No stored game coordinates, currency or multiplayer RPC are altered.
 */
const EPS=1e-9;
export const POLICY=Object.freeze({penetrationToleranceM:.00035,contactToleranceM:.018,minContactAreaM2:.008,minCOMMarginM:.012,maxCandidates:30});
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=a=>Math.hypot(a[0],a[1],a[2]);
const oriented=(v,c,s)=>[c*v[0]-s*v[2],v[1],s*v[0]+c*v[2]];
function bounds(vertices){let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const v of vertices)for(let j=0;j<3;j++){min[j]=Math.min(min[j],v[j]);max[j]=Math.max(max[j],v[j]);}return{min,max};}
/** Cache all world vertices and collision axes so no mesh transforms are re-run on every axis. */
export function makeBody(mesh,position=[0,0,0],yaw=0){
 if(!mesh||!Array.isArray(mesh.vertices)||!Array.isArray(mesh.faces)||!Array.isArray(position)||!position.every(Number.isFinite))throw new TypeError('Invalid authored stone');
 const c=Math.cos(yaw),s=Math.sin(yaw),vertices=mesh.vertices.map(v=>{const p=oriented(v,c,s);return[p[0]+position[0],p[1]+position[1],p[2]+position[2]];});
 const normalAxes=mesh.hullNormals.map(n=>oriented(n,c,s)),edgeAxes=mesh.hullEdges.map(e=>oriented(e,c,s));
 const bbox=bounds(vertices),center=oriented(mesh.center,c,s).map((v,i)=>v+position[i]);
 // Actual indexed source triangles, not generated cubes or contact surfaces.
 const triangles=mesh.faces.map(([ia,ib,ic])=>{
  const a=vertices[ia],b=vertices[ib],d=vertices[ic];const denom=(b[2]-d[2])*(a[0]-d[0])+(d[0]-b[0])*(a[2]-d[2]);
  return{a,b,d,denom,x0:Math.min(a[0],b[0],d[0]),x1:Math.max(a[0],b[0],d[0]),z0:Math.min(a[2],b[2],d[2]),z1:Math.max(a[2],b[2],d[2])};
 });
 return{mesh,vertices,normalAxes,edgeAxes,triangles,bbox,center,position:[...position],yaw};
}
function projection(vertices,axis){let min=Infinity,max=-Infinity;for(const v of vertices){const x=dot(v,axis);if(x<min)min=x;if(x>max)max=x;}return[min,max];}
function separatingAxis(a,b,axis,tol){const alen=nrm(axis);if(alen<1e-8)return false;const [lo1,hi1]=projection(a.vertices,axis),[lo2,hi2]=projection(b.vertices,axis);return Math.min(hi1,hi2)-Math.max(lo1,lo2)<=tol*alen;}
/** SAT on convex hull: face normals + ALL edge cross products; touching is legal. */
export function penetrates(a,b,tol=POLICY.penetrationToleranceM){
 for(let k=0;k<3;k++)if(a.bbox.max[k]<=b.bbox.min[k]+tol||b.bbox.max[k]<=a.bbox.min[k]+tol)return false;
 if(gjkStatus(a,b)==='separated')return false;
 for(const n of a.normalAxes)if(separatingAxis(a,b,n,tol))return false;
 for(const n of b.normalAxes)if(separatingAxis(a,b,n,tol))return false;
 // This part is necessary: face-normal-only SAT misses edge-edge separation.
 for(const e of a.edgeAxes)for(const f of b.edgeAxes){const axis=cross(e,f);if(separatingAxis(a,b,axis,tol))return false;}
 return true;
}
/** Faster GJK broad phase over authored convex point clouds.
 * Result is a conservative hint ONLY: uncertain cases use full SAT.
 * This never replaces exact SAT acceptance on an overlapping pair.
 */
function supportPoint(a,b,dir){
 let ah=-Infinity,bh=Infinity,pa,pb;
 for(const v of a.vertices){const k=dot(v,dir);if(k>ah){ah=k;pa=v;}}
 for(const v of b.vertices){const k=dot(v,dir);if(k<bh){bh=k;pb=v;}}
 return[pa[0]-pb[0],pa[1]-pb[1],pa[2]-pb[2]];
}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const neg=a=>[-a[0],-a[1],-a[2]];
const triple=(a,b,c)=>cross(cross(a,b),c);
/** Returns separated / intersecting / uncertain; only separated can prune SAT. */
export function gjkStatus(a,b){
 let d=sub(a.center,b.center);if(nrm(d)<1e-8)d=[1,0,0];
 let simplex=[supportPoint(a,b,d)];d=neg(simplex[0]);
 for(let i=0;i<24;i++){
  if(nrm(d)<1e-8)return'uncertain';
  const point=supportPoint(a,b,d);
  if(dot(point,d)<-1e-7)return'separated';
  const A=point,AO=neg(A);simplex.unshift(A);
  if(simplex.length===2){
   const B=simplex[1],AB=sub(B,A);
   if(dot(AB,AO)>0){d=triple(AB,AO,AB);if(nrm(d)<1e-8)return'uncertain';}
   else{simplex=[A];d=AO;}
  }else if(simplex.length===3){
   const B=simplex[1],C=simplex[2],AB=sub(B,A),AC=sub(C,A),ABC=cross(AB,AC);
   if(dot(cross(ABC,AC),AO)>0){
    if(dot(AC,AO)>0){simplex=[A,C];d=triple(AC,AO,AC);}
    else if(dot(AB,AO)>0){simplex=[A,B];d=triple(AB,AO,AB);}
    else{simplex=[A];d=AO;}
   }else if(dot(cross(AB,ABC),AO)>0){
    if(dot(AB,AO)>0){simplex=[A,B];d=triple(AB,AO,AB);}
    else{simplex=[A];d=AO;}
   }else if(dot(ABC,AO)>0){d=ABC;}
   else{simplex=[A,C,B];d=neg(ABC);}
  }else if(simplex.length===4){
   const B=simplex[1],C=simplex[2],D=simplex[3],AB=sub(B,A),AC=sub(C,A),AD=sub(D,A);
   const sides=[[B,C,D],[C,D,B],[D,B,C]];
   let outside=false;
   for(const [u,v,opp]of sides){
    let axis=cross(sub(u,A),sub(v,A));
    if(dot(axis,sub(opp,A))>0)axis=neg(axis);
    if(dot(axis,AO)>1e-10){simplex=[A,u,v];d=axis;outside=true;break;}
   }
   if(!outside)return'intersecting';
  }
 }
 return'uncertain';
}

/** Exact vertical intersection of triangle planes at x/z. Never invent stone faces. */
export function surfaceY(body,x,z,kind){let result=kind==='bottom'?Infinity:-Infinity;
 for(const t of body.triangles){if(x<t.x0-1e-7||x>t.x1+1e-7||z<t.z0-1e-7||z>t.z1+1e-7||Math.abs(t.denom)<EPS)continue;
  const u=((t.b[2]-t.d[2])*(x-t.d[0])+(t.d[0]-t.b[0])*(z-t.d[2]))/t.denom;
  const v=((t.d[2]-t.a[2])*(x-t.d[0])+(t.a[0]-t.d[0])*(z-t.d[2]))/t.denom;
  if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001){const y=u*t.a[1]+v*t.b[1]+(1-u-v)*t.d[1];result=kind==='bottom'?Math.min(result,y):Math.max(result,y);}
 }
 return Number.isFinite(result)?result:null;
}
function patchMetrics(contact,n,dx,dz,com,minSamples){
 const seen=new Uint8Array(n*n),components=[];
 for(let i=0;i<n*n;i++){
  if(!contact[i]||seen[i])continue;
  const queue=[i],member=new Set([i]);seen[i]=1;
  for(let k=0;k<queue.length;k++){
   const p=queue[k],x=p%n,z=Math.floor(p/n);
   for(const q of [x>0?p-1:-1,x<n-1?p+1:-1,z>0?p-n:-1,z<n-1?p+n:-1])if(q>=0&&contact[q]&&!seen[q]){seen[q]=1;member.add(q);queue.push(q);}
  }
  components.push({member,queue});
 }
 let chosen=null,area=0,margin=-1;
 for(const comp of components){
  const area0=comp.queue.length*dx*dz;
  // Approximate COM support on an ACTUAL connected sample patch, not a convex
  // polygon joining unrelated islands. No claim of true rigid-body dynamics.
  const ix=Math.round(com[0]),iz=Math.round(com[1]);
  if(ix<0||ix>=n||iz<0||iz>=n||!comp.member.has(ix+iz*n))continue;
  let edgeDist=Infinity;
  for(const p of comp.queue){const x=p%n,z=Math.floor(p/n);const boundary=x===0||z===0||x===n-1||z===n-1||!comp.member.has(p-1)||!comp.member.has(p+1)||!comp.member.has(p-n)||!comp.member.has(p+n);
   if(boundary)edgeDist=Math.min(edgeDist,Math.hypot((x-com[0])*dx,(z-com[1])*dz));
  }
  if(area0>area){area=area0;margin=edgeDist;chosen=comp;}
 }
 return{area,margin,samples:chosen?.queue.length||0,patches:components.length,validSamples:contact.filter(Boolean).length,conservativeConnected:true};
}
export function supportMetrics(body,existing=[],policy=POLICY,ground=false){
 const n=15,[minx,,minz]=body.bbox.min,[maxx,,maxz]=body.bbox.max,dx=(maxx-minx)/(n-1),dz=(maxz-minz)/(n-1);
 if(dx<EPS||dz<EPS)return{ok:false,reason:'degenerate mesh',area:0,margin:0};
 const contact=new Uint8Array(n*n);let minGap=Infinity;
 for(let zi=0;zi<n;zi++)for(let xi=0;xi<n;xi++){
  const x=minx+dx*xi,z=minz+dz*zi,lo=surfaceY(body,x,z,'bottom');if(lo===null)continue;
  let top=ground?0:-Infinity;
  if(!ground)for(const other of existing){if(x<other.bbox.min[0]||x>other.bbox.max[0]||z<other.bbox.min[2]||z>other.bbox.max[2]||other.bbox.min[1]>lo+policy.contactToleranceM)continue;
   const h=surfaceY(other,x,z,'top');if(h!==null&&h>top)top=h;
  }
  if(!Number.isFinite(top))continue;
  const gap=lo-top;minGap=Math.min(minGap,gap);
  if(gap>=-policy.penetrationToleranceM &&gap<=policy.contactToleranceM)contact[zi*n+xi]=1;
 }
 const com=[(body.center[0]-minx)/dx,(body.center[2]-minz)/dz];
 const patch=patchMetrics(contact,n,dx,dz,com);
 const ok=patch.area>=policy.minContactAreaM2&&patch.margin>=policy.minCOMMarginM&&patch.samples>=7;
 return{ok,reason:ok?'supported':'insufficient connected supporting patch',area:patch.area,margin:patch.margin,minGap:Number.isFinite(minGap)?minGap:null,samples:patch.samples,patches:patch.patches};
}
function overlapXZ(a,b){return a.bbox.max[0]>=b.bbox.min[0]&&a.bbox.min[0]<=b.bbox.max[0]&&a.bbox.max[2]>=b.bbox.min[2]&&a.bbox.min[2]<=b.bbox.max[2];}
export function checkPlacement(body,placed,options={}){
 const colliding=placed.filter(other=>penetrates(body,other));
 if(colliding.length)return{ok:false,reason:'intersection',colliding:colliding.length};
 if(body.bbox.min[1]<-.0005)return{ok:false,reason:'below ground'};
 const ground=body.bbox.min[1]<=.001;
 const support=supportMetrics(body,placed,options.policy||POLICY,ground);
 return{...support,ground,colliding:0};
}
/**
 * Grid-free camera target solver. Never snaps coordinates. Attempts bounded by
 * maxCandidates. Leaves ALL existing stone positions immutable; fails closed.
 * mode: ground | upper | auto. Caller controls camera target and yaw.
 */
/** Exact-for-convex-SAT continuous interval of Y translations that overlap b.
 * The candidate `a` is fixed in XZ at y=0. Intersect the intervals induced
 * by EVERY face and edge-cross SAT axis. Replaces repeated binary-search SAT.
 */
export function overlapYInterval(a,b,tol=POLICY.penetrationToleranceM){
 if(a.bbox.max[0]<=b.bbox.min[0]+tol||b.bbox.max[0]<=a.bbox.min[0]+tol||
    a.bbox.max[2]<=b.bbox.min[2]+tol||b.bbox.max[2]<=a.bbox.min[2]+tol)return null;
 let min=-Infinity,max=Infinity;
 function clip(axis){
  const alen=nrm(axis);if(alen<1e-9)return true;
  const [a0,a1]=projection(a.vertices,axis),[b0,b1]=projection(b.vertices,axis),dy=axis[1];
  if(Math.abs(dy)<1e-9)return Math.min(a1,b1)-Math.max(a0,b0)>tol*alen;
  const lo=(b0+tol*alen-a1)/dy,hi=(b1-tol*alen-a0)/dy;
  min=Math.max(min,Math.min(lo,hi));max=Math.min(max,Math.max(lo,hi));
  return max>min;
 }
 for(const n of a.normalAxes)if(!clip(n))return null;
 for(const n of b.normalAxes)if(!clip(n))return null;
 for(const e of a.edgeAxes)for(const f of b.edgeAxes)if(!clip(cross(e,f)))return null;
 return Number.isFinite(min)&&Number.isFinite(max)?{min,max}:null;
}
export function findPlacement(mesh,placed,target={x:0,z:0,yaw:0,mode:'auto'},policy=POLICY){
 const start=performance.now();let candidates=0,best=null;
 const offsets=[0,.025,-.025,.055,-.055,.095,-.095,.14,-.14];
 const rotations=[0,.13,-.13];
 outer:for(const da of rotations)for(const r of offsets){
  if(candidates>=policy.maxCandidates)break outer;
  const x=target.x+r*Math.cos(target.yaw),z=target.z+r*Math.sin(target.yaw),yaw=target.yaw+da;
  const basic=makeBody(mesh,[x,0,z],yaw);
  const neighbors=placed.filter(p=>overlapXZ(basic,p));
  const groundY=-basic.bbox.min[1],intervals=neighbors.map(p=>overlapYInterval(basic,p,policy.penetrationToleranceM)).filter(Boolean);
  const available=[];
  if(target.mode!=='upper')available.push(groundY);
  if(target.mode!=='ground')for(const section of intervals){
   const y=section.max+.0005;
   if(y>=groundY+.008&&!intervals.some(s=>y>s.min&&y<s.max))available.push(y);
  }
  available.sort((a,b)=>a-b);
  // Do not test a duplicate pose. Ground and upper are separate UX choices.
  for(const y of [...new Set(available.map(v=>Math.round(v*1e5)/1e5))]){
   candidates++;if(candidates>policy.maxCandidates)break outer;
   const body=makeBody(mesh,[x,y,z],yaw);
   const check=checkPlacement(body,placed,{policy});
   if(!check.ok)continue;
   const dist=Math.abs(r),score=check.area*10+check.margin*2-dist*.3-(target.mode==='upper'&&check.ground?.2:0);
   if(best===null||score>best.score)best={ok:true,body,check,score};
   if(check.area>=.015&&check.margin>=.020&&dist<=.026)return{...best,candidates,timeMs:performance.now()-start};
  }
 }
 return best?{...best,candidates,timeMs:performance.now()-start}:{ok:false,reason:'no mechanically supported placement found',candidates,timeMs:performance.now()-start};
}
