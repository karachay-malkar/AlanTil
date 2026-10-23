/**
 * Convert only explicitly supplied Kunlum map polylines into masonry geometry.
 * 69 user-curated features + 665 unpromoted automatic traces (low fragments).
 * Auto-traced fragments remain unverified and must not be named as known houses.
 * Continuous opaque stone cores avoid cracks; faceted uneven outer stones
 * produce the angular dry-stone character of Balkarian ruins.
 */
import {pixelToLocalWorld,plotCorners} from './kunlum-georeference.js';
export async function populateKunlumVectorSettlement(THREE,group,{
 calibration,plot,terrain,register=()=>{},mobile=false,isDisposed=()=>false
}={}){
 const links=[
  '/assets/tower/environment/kunlum-vector-confirmed.json',
  '/assets/tower/environment/kunlum-vector-candidates.json'
 ];
 const responses=await Promise.all(links.map(u=>fetch(u)));
 for(const r of responses)if(!r.ok)throw Error('Kunlum plan HTTP '+r.status);
 const [source,extras]=await Promise.all(responses.map(r=>r.json()));
 if(source.confirmed_features?.length!==69||extras.auto_candidates?.length!==702)
  throw Error('Unexpected Kunlum vector dataset');
 if(isDisposed())return null;
 const toScene=p=>{
  const [e,n]=pixelToLocalWorld(p,calibration);
  return terrain.demToScene(e,n);
 };
 const r=calibration.pixelsPerMetre;
 const confirmed={positions:[],colors:[]},candidate={positions:[],colors:[]},earth={positions:[],colors:[]},paths={positions:[],colors:[]};
 const colors=new Map();
 const color=c=>{if(!colors.has(c))colors.set(c,new THREE.Color(c));return colors.get(c)};
 const quad=(dst,a,b,c,d,tint)=>{
  tri(dst,a,b,c,tint);tri(dst,a,c,d,tint);
 };
 function tri(dst,a,b,c,tint){
  const t=color(tint);
  for(const p of [a,b,c]){dst.positions.push(...p);dst.colors.push(t.r,t.g,t.b)}
 }
 const tint=['#9e9989','#b4ac98','#8d897d','#c1b4a2','#a9a08d','#8c847a','#c2b39a'];
 const pick=(n)=>tint[Math.abs((n*37+Math.floor(n*n*.7))%tint.length)];
 const exclusion=[-10.75,30.75,-15.75,35.75];
 const inside=p=>p[0]>exclusion[0]&&p[0]<exclusion[1]&&p[1]>exclusion[2]&&p[1]<exclusion[3];
 function outsideParts(A,B){
  const dx=B[0]-A[0],dz=B[1]-A[1];
  const P=[-dx,dx,-dz,dz],Q=[A[0]-exclusion[0],exclusion[1]-A[0],A[1]-exclusion[2],exclusion[3]-A[1]];
  let low=0,high=1;
  for(let i=0;i<4;i++){
   const p=P[i],q=Q[i];
   if(Math.abs(p)<1e-10){if(q<0)return [[A,B]];continue;}
   const t=q/p;
   if(p<0)low=Math.max(low,t);else high=Math.min(high,t);
   if(low>high)return [[A,B]];
  }
  if(high<0||low>1)return [[A,B]];
  const at=t=>[A[0]+dx*t,A[1]+dz*t],result=[];
  if(low>0.0001)result.push([A,at(low)]);
  if(high<.9999)result.push([at(high),B]);
  return result;
 }
 let faces=0,confirmedSegments=0,candidateSegments=0,excised=0,terraceStrips=0;
 function wallSegment(A,B,kind,seed){
  if(!A||!B)return;
  const dx=B[0]-A[0],dz=B[1]-A[1],length=Math.hypot(dx,dz);
  if(length<.16)return;
  const isGuess=kind==='candidate';
  const thick=isGuess?.28:kind==='retaining'?.62:.53;
  const H=isGuess?.72:kind==='retaining'?2.1:kind==='house'?1.65:1.36;
  const stride=isGuess?(mobile?3.1:2.2):(mobile?1.4:.87);
  const n=Math.max(1,Math.ceil(length/stride));
  const nx=-dz/length*thick*.5,nz=dx/length*thick*.5;
  const data=isGuess?candidate:confirmed;
  for(let j=0;j<n;j++){
   const t0=j/n,t1=(j+1)/n;
   const x0=A[0]+dx*t0,z0=A[1]+dz*t0,x1=A[0]+dx*t1,z1=A[1]+dz*t1;
   const y0=terrain.heightAt(x0,z0)-.09,y1=terrain.heightAt(x1,z1)-.09;
   const s0=[x0+nx,y0,z0+nz],s1=[x1+nx,y1,z1+nz],
    e0=[x0-nx,y0,z0-nz],e1=[x1-nx,y1,z1-nz];
   // Support core, closed on all faces and running continuously through each
   // section. No visible large holes between individual faceted stones.
   quad(data,e1,e0,[e0[0],e0[1]+H,e0[2]],[e1[0],e1[1]+H,e1[2]],pick(seed+j+3));
   quad(data,e0,s0,[s0[0],s0[1]+H,s0[2]],[e0[0],e0[1]+H,e0[2]],pick(seed+j+5));
   quad(data,s1,e1,[e1[0],e1[1]+H,e1[2]],[s1[0],s1[1]+H,s1[2]],pick(seed+j+6));
   quad(data,[s0[0],s0[1]+H,s0[2]],[s1[0],s1[1]+H,s1[2]],
    [e1[0],e1[1]+H,e1[2]],[e0[0],e0[1]+H,e0[2]],pick(seed+j+7));
   // Where a surveyed-looking retaining trace exists, make a narrow
   // interpretative flat strip on the uphill side of it. Never fabricate a
   // complete building footprint from an open or unverified polyline.
   if(kind==='retaining'){
    const c0=[(x0+x1)*.5,(z0+z1)*.5],d=2.1;
    const ha=terrain.heightAt(c0[0]+nx/thick*d,c0[1]+nz/thick*d);
    const hb=terrain.heightAt(c0[0]-nx/thick*d,c0[1]-nz/thick*d);
    const direction=ha>=hb?1:-1;
    const sx=nx/thick*d*direction,sz=nz/thick*d*direction;
    const y=Math.max(
     terrain.heightAt(x0+sx,z0+sz),
     terrain.heightAt(x1+sx,z1+sz),y0,y1)+.035;
    quad(earth,[x0,y,z0],[x1,y,z1],
      [x1+sx,y,z1+sz],[x0+sx,y,z0+sz],'#9c937e');
    quad(earth,[x0,y0-.08,z0],[x1,y1-.08,z1],
      [x1,y,z1],[x0,y,z0],'#827b68');
    terraceStrips++;
   }
   // One or several tightly joined wild-stone courses on the visible face.
   const rows=isGuess?1:mobile?2:4;
   for(let row=0;row<rows;row++){
    const bot=row*H/rows,top=(row+1)*H/rows;
    const a=[s0[0],s0[1]+bot,s0[2]],b=[s1[0],s1[1]+bot,s1[2]],
     c=[s1[0],s1[1]+top,s1[2]],d=[s0[0],s0[1]+top,s0[2]];
    if(!isGuess&&!mobile){
     const f=.14+.1*Math.abs(Math.sin(seed*2.11+j*3.07+row)),
      mid=[(s0[0]+s1[0])*.5+nx*f,(s0[1]+s1[1])*.5+(bot+top)*.5,
       (s0[2]+s1[2])*.5+nz*f];
     tri(data,a,b,mid,pick(seed+j+row));
     tri(data,b,c,mid,pick(seed+j+row+2));
     tri(data,c,d,mid,pick(seed+j+row+5));
     tri(data,d,a,mid,pick(seed+j+row+1));
    }else quad(data,a,b,c,d,pick(seed+j+row));
    faces++;
   }
  }
 }
 function drawLines(feat,kind,seed){
  const pts=feat.points;
  if(!Array.isArray(pts)||pts.length<2)return 0;
  let count=0;
  for(let i=1;i<pts.length;i++){
   const a=toScene(pts[i-1]),b=toScene(pts[i]);
   if(kind==='passage'){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.12)continue;
    const k=.25;const nx=-dz/len*k,nz=dx/len*k;
    const h0=terrain.heightAt(...a)+.05,h1=terrain.heightAt(...b)+.05;
    quad(paths,[a[0]-nx,h0,a[1]-nz],[b[0]-nx,h1,b[1]-nz],
     [b[0]+nx,h1,b[1]+nz],[a[0]+nx,h0,a[1]+nz],'#b8ab8f');count++;
   }else for(const [p,q] of outsideParts(a,b)){
    if(Math.hypot(q[0]-p[0],q[1]-p[1])<.17){excised++;continue;}
    wallSegment(p,q,kind,seed+i*11);count++;
   }
  }
  return count;
 }
 source.confirmed_features.forEach((f,i)=>{confirmedSegments+=drawLines(f,f.type,9+i*97)});
 const origins=new Set(source.confirmed_features.map(f=>f.origin).filter(Boolean));
 let autoCount=0;
 for(const [i,f] of extras.auto_candidates.entries()){
  if(f.promoted||origins.has(f.id))continue;
  autoCount++;candidateSegments+=drawLines(f,'candidate',i*47+901);
 }
 // Only clearly closed house contours form level interpretation floors.
 let courtyards=0;
 for(const f of source.confirmed_features){
  if(f.type!=='house'||f.points.length<4)continue;
  const first=f.points[0],last=f.points[f.points.length-1];
  if(Math.hypot(first[0]-last[0],first[1]-last[1])>7)continue;
  const verts=f.points.slice(0,-1).map(toScene),centre=verts.reduce((a,p)=>[a[0]+p[0],a[1]+p[1]],[0,0]).map(x=>x/verts.length);
  if(inside(centre))continue;
  const ys=verts.map(p=>terrain.heightAt(...p)).sort((a,b)=>a-b),y=ys[Math.floor(ys.length/2)]+.035;
  const outline=verts.map(p=>new THREE.Vector2(p[0],p[1]));
  const shapes=THREE.ShapeUtils.triangulateShape(outline,[]);
  for(const [a,b,c] of shapes)tri(earth,[verts[a][0],y,verts[a][1]],
   [verts[b][0],y,verts[b][1]],[verts[c][0],y,verts[c][1]],'#9d9379');
  courtyards++;
 }
 if(isDisposed())return null;
 function emit(source,name,colorHex,transparent=false){
  if(!source.positions.length)return;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(source.positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(source.colors,3));
  geo.computeVertexNormals();
  const mat=new THREE.MeshLambertMaterial({color:colorHex,vertexColors:true,
    side:THREE.DoubleSide,transparent,opacity:transparent?.63:1,depthWrite:!transparent});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.name=name;group.add(mesh);register(geo,mat);
 }
 emit(confirmed,'Kunlum hand-digitised wild-stone walls and retainers','#ffffff');
 emit(candidate,'Kunlum unverified low auto-traced ruin fragments','#ffffff',true);
 emit(earth,'Kunlum levelled interpretative house courtyards','#ffffff');
 emit(paths,'Kunlum recorded passages','#ffffff');
 return {confirmedFeatures:source.confirmed_features.length,
  confirmedSegments,candidateFeatures:autoCount,candidateSegments,
  roughStoneFacets:faces,roofCourtyards:courtyards,terraceStrips,
  houseContours:source.confirmed_features.filter(f=>f.type==='house').length,
  sourceAccuracy:'69 user digitized features; 665 automatic suggestions are unverified; 1-point map registration'};
}
