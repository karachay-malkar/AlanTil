/**
 * Read-only overlay for the ORIGINAL, undeformed 30 m Copernicus DEM preview.
 * Historic vector-plan alignment remains explicitly one-point/unverified.
 * All elevations use the same terrain sampler as the terrain mesh beneath.
 */
export function createKunlumMapOverlay(THREE,source,{toWorld,heightAt}){
 if(!source||!Array.isArray(source.confirmed_features)||!Array.isArray(source.auto_candidates))
  throw new Error('Invalid Kunlum vector plan');
 const root=new THREE.Group();root.name='Latest Kunlum mapped walls (read-only, no terraces)';
 const confirmed=new THREE.Group(),candidates=new THREE.Group(),passages=new THREE.Group();
 confirmed.name='Confirmed stone wall paths';candidates.name='Unverified automatic traces';
 passages.name='Confirmed and linked passages';
 root.add(confirmed,candidates,passages);
 const buffers={wall:[],house:[],retaining:[]},auto=[],gap=[];
 const clamp=t=>Math.max(0,Math.min(1,t));
 const interpolate=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const pushQuad=(out,a,b,c,d)=>out.push(...a,...b,...c,...a,...c,...d);
 function wallPiece(out,a,b,height,width){
  const len=dist(a,b);if(len<.01)return;
  const n=Math.max(1,Math.ceil(len/2.5)),nx=-(b[1]-a[1])/len*width/2,nz=(b[0]-a[0])/len*width/2;
  for(let i=0;i<n;i++){
   const p=interpolate(a,b,i/n),q=interpolate(a,b,(i+1)/n);
   const y=heightAt(...p)+.08,z=heightAt(...q)+.08;
   const f=[p[0]+nx,y,p[1]+nz],g=[q[0]+nx,z,q[1]+nz],h=[q[0]+nx,z+height,q[1]+nz],j=[p[0]+nx,y+height,p[1]+nz];
   const k=[p[0]-nx,y,p[1]-nz],l=[q[0]-nx,z,q[1]-nz],m=[q[0]-nx,z+height,q[1]-nz],o=[p[0]-nx,y+height,p[1]-nz];
   pushQuad(out,f,g,h,j);pushQuad(out,l,k,o,m);pushQuad(out,j,h,m,o);
  }
 }
 function line(out,a,b,raise=.7){
  const len=dist(a,b);if(len<.01)return;
  const n=Math.max(1,Math.ceil(len/4));
  for(let i=0;i<n;i++){
   const p=interpolate(a,b,i/n),q=interpolate(a,b,(i+1)/n);
   out.push(p[0],heightAt(...p)+raise,p[1],q[0],heightAt(...q)+raise,q[1]);
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
   const p=f.points.map(toWorld);
   for(let i=1;i<p.length;i++)line(gap,p[i-1],p[i],1.05);
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
  line(gap,a,b,1.3);
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
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
  const m=new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(g,m);mesh.name=name;target.add(mesh);owned.push([g,m]);
 }
 function addLines(target,vertices,color,name,opacity=1){
  if(!vertices.length)return;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  const m=new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity,depthTest:false});
  const lines=new THREE.LineSegments(g,m);lines.name=name;target.add(lines);owned.push([g,m]);
 }
 addMesh(confirmed,buffers.wall,'#b9b5a5','74 confirmed walls');
 addMesh(confirmed,buffers.house,'#dfb88b','19 house boundaries');
 addMesh(confirmed,buffers.retaining,'#ab8e77','16 retaining walls');
 addMesh(candidates,auto,'#72aab6','Unverified automatic 3D walls');
 addLines(passages,gap,'#2ae9a7','11 confirmed passages plus linked openings');
 const center=centers.length?
  [centers.reduce((s,p)=>s+p[0],0)/centers.length,centers.reduce((s,p)=>s+p[1],0)/centers.length]:[0,0];
 return {root,confirmed,candidates,passages,counters,center,
  setVisibility({confirmedVisible=true,candidatesVisible=true,passagesVisible=true}={}){
   confirmed.visible=confirmedVisible;candidates.visible=candidatesVisible;passages.visible=passagesVisible;
  },
  setVerticalScale(scale){root.scale.y=scale},
  dispose(){for(const [g,m] of owned){g.dispose();m.dispose()} }
 };
}
