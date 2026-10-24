/**
 * Visual, NON-SURVEYED river reconstruction from the Copernicus DEM trough.
 * The historic inventory confirms the Cherek Balkarsky river EAST of Abay-Kala,
 * but does not define its surveyed centreline. This mesh is an approximate view.
 * Never use these river coordinates for navigation, hydrology, or historical claims.
 */
const limit=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const lerp=(a,b,t)=>a+(b-a)*t;
export function traceKunlumRiver(heightAt,{minZ=-1350,maxZ=1350,step=30,minX=45,maxX=990}={}){
 if(typeof heightAt!=='function'||step<=0||minZ>=maxZ)throw Error('Invalid DEM river trace');
 const rows=[],xs=[];
 for(let x=minX;x<=maxX;x+=30)xs.push(x);
 for(let z=minZ;z<=maxZ+1e-6;z+=step){
  const hs=xs.map(x=>heightAt(x,z)),low=Math.min(...hs);
  rows.push({z,hs,low});
 }
 // Trace valley bottom, with smoothness cost. Does not invent/alter elevations.
 const path=new Array(rows.length);
 let scores=xs.map((x,i)=>{
  const r=rows[0];return (r.hs[i]-r.low)*.46+Math.abs(x-210)*.013;
 }),links=[];
 for(let j=1;j<rows.length;j++){
  const r=rows[j],next=new Array(xs.length).fill(Infinity),back=new Array(xs.length).fill(-1);
  for(let i=0;i<xs.length;i++){
   const valleyPenalty=(r.hs[i]-r.low)*.46;
   for(let k=Math.max(0,i-3);k<=Math.min(xs.length-1,i+3);k++){
    const dx=Math.abs(xs[i]-xs[k]),cost=scores[k]+valleyPenalty+dx*.026+Math.pow(dx/60,2)*.7;
    if(cost<next[i]){next[i]=cost;back[i]=k}
   }
  }
  links.push(back);scores=next;
 }
 let k=scores.indexOf(Math.min(...scores));
 for(let j=rows.length-1;j>=0;j--){path[j]=xs[k];if(j)k=links[j-1][k]}
 // Three-point smoothing; stay near DEM trough while avoiding visual zigzags.
 const points=rows.map((r,i)=>{
  const x=limit((path[Math.max(0,i-1)]+2*path[i]+path[Math.min(path.length-1,i+1)])/4,minX,maxX);
  const z=r.z;
  return {x,z,y:heightAt(x,z),width:9.5+1.6*Math.sin(i*.47)+1.1*Math.cos(i*.23)};
 });
 return points;
}
export function riverXAt(points,z){
 if(!points.length)return Infinity;
 if(z<points[0].z||z>points.at(-1).z)return Infinity;
 const i=limit(Math.floor((z-points[0].z)/(points[1]?.z-points[0].z||1)),0,points.length-2);
 const a=points[i],b=points[i+1],t=limit((z-a.z)/(b.z-a.z||1),0,1);
 return lerp(a.x,b.x,t);
}
export function createKunlumRiverLayer(THREE,heightAt,{quality='interactive',mobile=false}={}){
 const root=new THREE.Group();root.name='Approximate Cherek Balkarsky DEM-trough river (NOT SURVEYED)';
 const points=traceKunlumRiver(heightAt);
 const main=[],uv=[],indices=[],bank=[],bankIndices=[],foam=[];
 const samplesPerSpan=quality==='beautiful'?(mobile?3:5):2;
 for(let s=0;s<=(points.length-1)*samplesPerSpan;s++){
  const i=Math.min(points.length-2,Math.floor(s/samplesPerSpan)),t=limit(s/samplesPerSpan-i,0,1);
  const a=points[i],b=points[i+1],x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t);
  const tangentX=(b.x-a.x)/Math.max(1,b.z-a.z),norm=Math.sqrt(1+tangentX*tangentX);
  const nx=1/norm,nz=-tangentX/norm,width=lerp(a.width,b.width,t);
  const levels=[],edges=[];
  for(const scale of [-1,-.56,0,.56,1]){
   const px=x+nx*width*.5*scale,pz=z+nz*width*.5*scale;
   levels.push(heightAt(px,pz));
  }
  const level=Math.max(...levels)+.62;
  for(let lane=0;lane<5;lane++){
   const side=(lane-2)/2;
   main.push(x+nx*width*.5*side,level+.035*Math.cos(s*.8+lane*.75),z+nz*width*.5*side);
   uv.push(s*.17,lane*.25);
  }
  if(s>0)for(let lane=0;lane<4;lane++){
   const base=s*5,p=(s-1)*5;
   indices.push(p+lane,base+lane,p+lane+1,base+lane,base+lane+1,p+lane+1);
  }
  for(const side of [-1,1]){
   const ed=side*width*.85,px=x+nx*ed,pz=z+nz*ed;
   const py=heightAt(px,pz)+.18;
   bank.push(px,py,pz);
  }
  if(s>0){const t0=(s-1)*2,t1=s*2;bankIndices.push(t0,t1,t0+1,t1,t1+1,t0+1)}
  if(s>0&&s%3===0){
   const p=(s*.6180339887%1)*1.3-.65;
   const xx=x+nx*width*.5*p,zz=z+nz*width*.5*p;
   foam.push(xx-.6,level+.13,zz,xx+.8,level+.13,zz+.4);
  }
 }
 const owned=[];
 function geometry(vertices,inds,uvs){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  if(uvs)g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  if(inds)g.setIndex(inds);
  g.computeVertexNormals();owned.push(g);return g;
 }
 const riverMat=new THREE.MeshPhysicalMaterial({
  color:0x6bafb2,metalness:.18,roughness:quality==='beautiful'?.19:.33,
  clearcoat:quality==='beautiful'?.75:.25,clearcoatRoughness:.12,transparent:true,opacity:.91,
  side:THREE.DoubleSide,depthWrite:true
 });
 const bedMat=new THREE.MeshStandardMaterial({color:0x8b8371,roughness:.92,side:THREE.DoubleSide});
 const shimmerMat=new THREE.LineBasicMaterial({color:0xccece7,transparent:true,opacity:.68,depthWrite:false});
 owned.push(riverMat,bedMat,shimmerMat);
 // Gravel shoulder is a separate layer; never deletes DEM faces.
 const bed=new THREE.Mesh(geometry(bank,bankIndices),bedMat);bed.name='Approximate gravel banks';root.add(bed);
 const water=new THREE.Mesh(geometry(main,indices,uv),riverMat);
 water.name='Cherek Balkarsky approximate flowing surface';
 water.renderOrder=1;root.add(water);
 const lineGeometry=new THREE.BufferGeometry();
 lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(foam,3));owned.push(lineGeometry);
 const highlights=new THREE.LineSegments(lineGeometry,shimmerMat);
 highlights.name='Water glints';highlights.renderOrder=2;root.add(highlights);
 const dispose=()=>{for(const o of owned)o.dispose()};
 return {root,points,dispose,stats:{points:points.length,waterTriangles:indices.length/3,bankTriangles:bankIndices.length/3}};
}
