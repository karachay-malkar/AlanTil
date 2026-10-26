import {enhanceKunlumStoneWalls} from './kunlum-stone-facing.js';
import {getApprovedStoneSurfaceGeometry} from './rock-surface.js?v=balkaria-stone-v2.1-light-ochre.2';
/**
 * Read-only overlay for the ORIGINAL, undeformed 30 m Copernicus DEM preview.
 * Historic vector-plan alignment remains explicitly one-point/unverified.
 * All elevations use the same terrain sampler as the terrain mesh beneath.
 */
export function createKunlumMapOverlay(THREE,source,{toWorld,heightAt,mobile=false,monument=null}={}){
 if(!source||!Array.isArray(source.confirmed_features)||!Array.isArray(source.auto_candidates))
  throw new Error('Invalid Kunlum vector plan');
 const root=new THREE.Group();root.name='Latest Kunlum mapped walls (read-only, no terraces)';
 const confirmed=new THREE.Group(),candidates=new THREE.Group(),passages=new THREE.Group();
 confirmed.name='Confirmed stone wall paths';candidates.name='Unverified automatic traces';
 passages.name='Confirmed and linked passages';
 root.add(confirmed,candidates,passages);
 const buffers={wall:[],house:[],retaining:[]},auto=[];
 const confirmedSegments=[],candidateSegments=[];
 const clamp=t=>Math.max(0,Math.min(1,t));
 const interpolate=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

 const pushQuad=(out,a,b,c,d)=>out.push(...a,...b,...c,...a,...c,...d);
 // Passage contours are negative space, never rendered strokes. They can
 // intersect unverified traces as well as confirmed walls, so both use this.
 const passageEdges=source.confirmed_features.filter(f=>f.type==='passage'&&Array.isArray(f.points))
  .flatMap(f=>{const pts=f.points.map(toWorld);return pts.slice(1).map((b,i)=>[pts[i],b]);});
 const cross=(u,v)=>u[0]*v[1]-u[1]*v[0];
 function outsidePassages(a,b){
  const ab=[b[0]-a[0],b[1]-a[1]],length=dist(a,b);
  if(length<.01)return [];
  const cuts=[];
  for(const [c,d] of passageEdges){
   const cd=[d[0]-c[0],d[1]-c[1]],den=cross(ab,cd);
   if(Math.abs(den)<.25*length*dist(c,d))continue; // parallel path, not a doorway
   const ca=[c[0]-a[0],c[1]-a[1]];
   const at=cross(ca,cd)/den,along=cross(ca,ab)/den;
   if(at<0||at>1||along<0||along>1)continue;
   const half=.60/length; // 1.2 m walk-through, not a drawn overlay
   cuts.push([Math.max(0,at-half),Math.min(1,at+half)]);
  }
  let intervals=[[0,1]];
  for(const [from,to] of cuts)intervals=intervals.flatMap(([x,y])=>
   to<=x||from>=y?[[x,y]]:
    [...(from>x?[[x,Math.min(from,y)]]:[]),...(to<y?[[Math.max(to,x),y]]:[])]);
  return intervals.filter(([x,y])=>(y-x)*length>.08)
   .map(([x,y])=>[interpolate(a,b,x),interpolate(a,b,y)]);
 }
 function wallPiece(out,a,b,height,width){
  for(const [start,end] of outsidePassages(a,b))wallBody(out,start,end,height,width);
 }
 function wallBody(out,a,b,height,width){
  const len=dist(a,b);if(len<.01)return;
  const stoneSegments=out===auto?candidateSegments:confirmedSegments;
  stoneSegments.push({a,b,height,width,heightAt});
  const n=Math.max(1,Math.ceil(len/.75)),nx=-(b[1]-a[1])/len*width/2,nz=(b[0]-a[0])/len*width/2;
  for(let i=0;i<n;i++){
   const p=interpolate(a,b,i/n),q=interpolate(a,b,(i+1)/n);
   const y=heightAt(...p)+.035,z=heightAt(...q)+.035;
   const crown=q=>.86+.12*Math.abs(Math.sin(q[0]*1.97+q[1]*3.37));
   const aTop=height*crown(p),bTop=height*crown(q);
   const f=[p[0]+nx,y,p[1]+nz],g=[q[0]+nx,z,q[1]+nz],h=[q[0]+nx,z+bTop,q[1]+nz],j=[p[0]+nx,y+aTop,p[1]+nz];
   const k=[p[0]-nx,y,p[1]-nz],l=[q[0]-nx,z,q[1]-nz],m=[q[0]-nx,z+bTop,q[1]-nz],o=[p[0]-nx,y+aTop,p[1]-nz];
   // Enclosed irregular core prevents any light leaking through the stone joints.
   pushQuad(out,f,g,h,j);pushQuad(out,l,k,o,m);pushQuad(out,j,h,m,o);
   pushQuad(out,k,l,g,f);pushQuad(out,f,j,o,k);pushQuad(out,g,l,m,h);
  }
 }
 const map=new Map(source.confirmed_features.map(f=>[f.id,f]));
 function segments(f){
  const pts=f.points.map(toWorld);
  if(f.type==='house'&&pts.length>2&&dist(pts[0],pts.at(-1))>.001)pts.push([...pts[0]]);
  const lengths=pts.slice(1).map((p,i)=>dist(p,pts[i])),prefix=[0];
  lengths.forEach(x=>prefix.push(prefix.at(-1)+x));
  const pos=at=>at&&Number.isInteger(at.segment)&&at.segment>=0&&at.segment<lengths.length&&Number.isFinite(at.t)?
    prefix[at.segment]+lengths[at.segment]*clamp(at.t):null;
  const cut=(source.openings||[]).filter(o=>o.wallId===f.id).flatMap(o=>{
   const a=pos(o.start),b=pos(o.end);return a===null||b===null?[]:[[Math.min(a,b),Math.max(a,b)]];
  });
  const out=[];
  for(let i=0;i<lengths.length;i++){
   const len=lengths[i];if(len<.01)continue;
   let keep=[[0,1]];
   for(const [a,b] of cut){
    const from=clamp((a-prefix[i])/len),to=clamp((b-prefix[i])/len);
    if(to<=from)continue;
    keep=keep.flatMap(([x,y])=>to<=x||from>=y?[[x,y]]:
     [...(from>x?[[x,Math.min(from,y)]]:[]),...(to<y?[[Math.max(to,x),y]]:[])]);
   }
   for(const [a,b] of keep)if(b-a>.00001)out.push([interpolate(pts[i],pts[i+1],a),interpolate(pts[i],pts[i+1],b)]);
  }
  return out;
 }
 const counters={confirmed:0,walls:0,houses:0,retaining:0,passages:0,linkedOpenings:0,remainingCandidates:0};
 const centers=[];
 for(const f of source.confirmed_features){
  if(!Array.isArray(f.points)||f.points.length<2||f.type==='terrace')continue;
  counters.confirmed++;
  if(f.type==='passage'){
   counters.passages++;
   // This feature describes open ground, not a wall or a visible line.
  }else if(Object.hasOwn(buffers,f.type)){
   counters[f.type==='wall'?'walls':f.type==='house'?'houses':'retaining']++;
   if(f.type==='house')for(const p of f.points)centers.push(toWorld(p));
   for(const [p,q] of segments(f))wallPiece(buffers[f.type],p,q,
    f.type==='retaining'?1.8:f.type==='house'?1.6:1.4,
    f.type==='retaining'?.65:.5);
  }
 }
 for(const o of source.openings||[]){
  const f=map.get(o.wallId);if(!f)continue;
  const pts=f.points.map(toWorld);
  if(f.type==='house'&&pts.length>2&&dist(pts[0],pts.at(-1))>.001)pts.push([...pts[0]]);
  const at=p=>p&&pts[p.segment]&&pts[p.segment+1]&&Number.isFinite(p.t)?
   interpolate(pts[p.segment],pts[p.segment+1],clamp(p.t)):null;
  const a=at(o.start),b=at(o.end);if(!a||!b)continue;
  // Explicit openings were already removed from segments(f).
  counters.linkedOpenings++;
 }
 const confirmedOrigins=new Set(source.confirmed_features.map(x=>x.origin));
 const seenAutoSegments=new Set();
 for(const f of source.auto_candidates){
  if(f.promoted||confirmedOrigins.has(f.id)||!Array.isArray(f.points)||f.points.length<2)continue;
  counters.remainingCandidates++;
  const p=f.points.map(toWorld);
  for(let i=1;i<p.length;i++){
   const a=p[i-1],b=p[i],pkey=q=>q.map(v=>v.toFixed(3)).join(',');
   const key=[pkey(a),pkey(b)].sort().join('|');
   if(seenAutoSegments.has(key))continue;
   seenAutoSegments.add(key);wallPiece(auto,a,b,1.45,.42);
  }
 }
 const owned=[];
 function addMesh(target,vertices,color,name){
  if(!vertices.length)return;
  const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));raw.computeVertexNormals();
  // Every sealed wall body uses the very same metric stone UV projection as
  // authentic Common100 geometry, including walls beyond the mobile mesh LOD.
  const g=getApprovedStoneSurfaceGeometry(raw);raw.dispose();
  const m=new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(g,m);mesh.name=name;target.add(mesh);owned.push([g,m]);
 }
 addMesh(confirmed,buffers.wall,'#b9b5a5','74 confirmed walls');
 addMesh(confirmed,buffers.house,'#b9b5a5','19 house boundaries');
 addMesh(confirmed,buffers.retaining,'#b9b5a5','16 retaining walls');
 addMesh(candidates,auto,'#b9b5a5','Unverified automatic 3D walls');
 // No passage line meshes: only physical gaps in the wall geometry.
 const enhance=({renderer,materialPromise}={})=>enhanceKunlumStoneWalls(THREE,root,[
  {group:confirmed,segments:confirmedSegments},{group:candidates,segments:candidateSegments}
 ],{renderer,materialPromise,mobile,monument});
 const center=centers.length?
  [centers.reduce((s,p)=>s+p[0],0)/centers.length,centers.reduce((s,p)=>s+p[1],0)/centers.length]:[0,0];
 return {root,confirmed,candidates,passages,counters,center,enhance,
  setVisibility({confirmedVisible=true,candidatesVisible=true,passagesVisible=true}={}){
   confirmed.visible=confirmedVisible;candidates.visible=candidatesVisible;passages.visible=passagesVisible;
  },
  setVerticalScale(scale){root.scale.y=scale},
  dispose(){root.userData.disposed=true;
   root.traverse(node=>{if(node.isInstancedMesh)node.dispose();});
   for(const geometry of root.userData.wallFacadeGeometries||[])geometry.dispose();
   for(const [g,m] of owned){g.dispose();m.dispose();}
  }
 };
}
