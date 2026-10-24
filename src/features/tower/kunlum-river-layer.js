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
 if(points.length<2||!Number.isFinite(z))return Infinity;
 let best=Infinity,x=Infinity;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dz=b.z-a.z;
  const t=limit(Math.abs(dz)<1e-8?.5:(z-a.z)/dz,0,1);
  const distance=Math.abs(lerp(a.z,b.z,t)-z);
  if(distance<best){best=distance;x=lerp(a.x,b.x,t)}
 }
 // Do not continue a river hundreds of metres outside the actual mapped reach.
 return best<45?x:Infinity;
}
export function densifyKunlumRiverPolyline(line,heightAt,{step=24}={}){
 if(!Array.isArray(line)||line.length<2)throw Error('Verified river requires 2 or more OSM nodes');
 const out=[];
 for(let i=1;i<line.length;i++){
  const a=line[i-1],b=line[i];
  if(![a.x,a.z,b.x,b.z].every(Number.isFinite))throw Error('Non-finite OSM river node');
  const length=Math.hypot(b.x-a.x,b.z-a.z),count=Math.max(1,Math.ceil(length/step));
  if(i===1)out.push({x:a.x,z:a.z,y:heightAt(a.x,a.z),width:11});
  for(let k=1;k<=count;k++){
   const t=k/count,x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t);
   out.push({x,z,y:heightAt(x,z),width:11});
  }
 }
 return out;
}

/** Immutable OSM snapshot, with strict source, coordinate and continuity checks. */
export async function loadKunlumCherekLocal({
 fetchImpl=fetch,url='./assets/tower/environment/kunlum-cherek-balkarsky-osm.json'
}={}){
 const response=await fetchImpl(url);
 if(!response.ok)throw Error('Локальная линия реки недоступна (HTTP '+response.status+')');
 const data=await response.json();
 if(data?.schema!==1||data.license!=='ODbL'||
   data.projection!=='UTM38 local metres relative to tower control'||
   Math.abs(data.origin?.easting-372151.107)>.001||
   Math.abs(data.origin?.northing-4773796.751)>.001||
   !Array.isArray(data.points)||data.points.length<12)
  throw Error('Некорректная лицензия или формат локальной линии русла');
 const line=data.points.map(p=>{
  if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))
   throw Error('Некорректные координаты русла');
  return {x:p[0],z:p[1]};
 });
 let length=0;
 for(let i=1;i<line.length;i++){
  const gap=Math.hypot(line[i].x-line[i-1].x,line[i].z-line[i-1].z);
  if(gap>200||gap<.00001)throw Error('Недопустимый разрыв локального русла');
  length+=gap;
 }
 if(length<800)throw Error('Неполная линия русла');
 return {line,source:'local OpenStreetMap ODbL snapshot',acquiredAt:data.acquiredAt};
}
function nearestKunlumSegment(points,x,z,margin=Infinity){
 if(!Array.isArray(points)||points.length<2)return null;
 let best=null,dist2=Infinity;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(x<Math.min(a.x,b.x)-margin||x>Math.max(a.x,b.x)+margin||
     z<Math.min(a.z,b.z)-margin||z>Math.max(a.z,b.z)+margin)continue;
  const dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;
  if(len2<1e-8)continue;
  const t=limit(((x-a.x)*dx+(z-a.z)*dz)/len2,0,1);
  const px=a.x+t*dx,pz=a.z+t*dz,d2=(x-px)**2+(z-pz)**2;
  if(d2<dist2){dist2=d2;best={x:px,z:pz,d:Math.sqrt(d2)}}
 }
 return best;
}
export function riverDistanceAt(points,x,z){
 return nearestKunlumSegment(points,x,z,140)?.d??Infinity;
}
/** Render-only incision. Does not write into Copernicus/Mapzen DEM heights. */
export function carveKunlumRiverHeight(x,z,heightAt,points){
 const base=heightAt(x,z);
 if(!Number.isFinite(base)||!points?.length)return base;
 const near=nearestKunlumSegment(points,x,z,32);
 if(!near||near.d>=15)return base;
 const center=heightAt(near.x,near.z);
 if(!Number.isFinite(center))return base;
 const d=near.d,inner=6.5;
 if(d<=inner)return center-2.8+1.08*(d/inner)**2;
 const t=(d-inner)/(15-inner),smooth=t*t*(3-2*t);
 return lerp(center-1.72,base,smooth);
}

export function createKunlumRiverLayer(THREE,heightAt,{
 quality='interactive',mobile=false,centerline=null
}={}){
 const root=new THREE.Group();
 root.name='Cherek Balkarsky river — mapped OSM centreline, reconstructed banks';
 const empty={points:0,waterTriangles:0,bedTriangles:0,slopeTriangles:0,shoreTriangles:0,foamTriangles:0};
 if(!centerline||centerline.length<2)
  return {root,points:[],stats:empty,update(){},dispose(){}};
 const points=densifyKunlumRiverPolyline(centerline,heightAt,{
  step:mobile?18:quality==='beautiful'?7:13
 });
 const owned=[],own=o=>(owned.push(o),o);
 const geo=(v,idx,uv=null,rgb=null)=>{
  const g=own(new THREE.BufferGeometry());
  g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  if(rgb)g.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
  g.setIndex(idx);g.computeVertexNormals();return g;
 };
 const bed=[],bi=[],slope=[],si=[],shore=[],shi=[],water=[],wi=[],uv=[],rgb=[],foam=[],fi=[];
 let along=0;const centers=[];
 const quads=(indices,s,cols)=>{
  const p=(s-1)*cols,b=s*cols;
  for(let i=0;i<cols-1;i++)indices.push(p+i,b+i,p+i+1,b+i,b+i+1,p+i+1);
 };
 for(let s=0;s<points.length;s++){
  const p=points[s],a=points[Math.max(0,s-1)],b=points[Math.min(points.length-1,s+1)];
  const distance=Math.hypot(b.x-a.x,b.z-a.z)||1;
  const nx=-(b.z-a.z)/distance,nz=(b.x-a.x)/distance;
  const half=(11.9+2.1*Math.sin(s*.105)+1.3*Math.sin(s*.037)+.45*Math.sin(s*.9))*.5;
  const bankScale=side=>1+.095*Math.sin(s*.39+side*1.1);
  const y=heightAt(p.x,p.z)-1.22;
  if(s)along+=Math.hypot(p.x-points[s-1].x,p.z-points[s-1].z);
  centers.push({x:p.x,z:p.z,y,nx,nz,half});
  // Bed reaches undisturbed terrain beyond the incised banks.
  for(let j=0;j<9;j++){
   const f=(j-4)/4,edge=half*f*1.8*bankScale(Math.sign(f)),dx=nx*edge,dz=nz*edge;
   bed.push(p.x+dx,carveKunlumRiverHeight(p.x+dx,p.z+dz,heightAt,centerline)-.07,p.z+dz);
  }
  for(let j=0;j<7;j++){
   const f=(j-3)/3,edge=half*f*bankScale(Math.sign(f)),dx=nx*edge,dz=nz*edge;
   water.push(p.x+dx,y+.035*Math.sin(s*.71+j),p.z+dz);
   uv.push(along*.085,f);
   const variation=.5+.5*Math.sin(s*.23+j*1.73),edge=Math.abs(f);
   rgb.push(.24+variation*.065,.41+variation*.082-edge*.045,.46+variation*.075-edge*.057);
  }
  for(const side of [-1,1]){
   for(const f of [1,1.3,1.65]){
    const x=p.x+nx*half*f*side*bankScale(side),z=p.z+nz*half*f*side*bankScale(side);
    slope.push(x,carveKunlumRiverHeight(x,z,heightAt,centerline)+.04,z);
   }
   for(const f of [1.25,1.82]){
    const x=p.x+nx*half*f*side*bankScale(side),z=p.z+nz*half*f*side*bankScale(side);
    shore.push(x,carveKunlumRiverHeight(x,z,heightAt,centerline)+.11,z);
   }
  }
  if(s){
   quads(bi,s,9);quads(wi,s,7);
   for(let side=0;side<2;side++){
    for(let j=0;j<2;j++){
     const p=(s-1)*6+side*3+j,n=s*6+side*3+j;
     si.push(p,n,p+1,n,n+1,p+1);
    }
    const p=(s-1)*4+side*2,n=s*4+side*2;
    shi.push(p,n,p+1,n,n+1,p+1);
   }
  }
 }
 for(let s=2;s<points.length-1;s+=(mobile?6:3)){
  const p=centers[s],prev=centers[s-1],next=centers[s+1];
  const gradient=Math.abs(next.y-prev.y)/(Math.hypot(next.x-prev.x,next.z-prev.z)||1);
  const turbulence=.5+.5*Math.sin(s*1.921);
  if(gradient<.05&&turbulence<.7)continue;
  const shift=Math.sin(s*3.13)*p.half*.52,span=p.half*(mobile?.26:.4);
  const x=p.x+p.nx*shift,z=p.z+p.nz*shift,y=p.y+.12,k=foam.length/3;
  foam.push(x-p.nx*span,y,z-p.nz*span,x+p.nx*span,y,z+p.nz*span,
    x-p.nz*(mobile?1.8:3.2),y+.04,z+p.nx*(mobile?1.8:3.2));
  fi.push(k,k+1,k+2);
 }
 const standard=(color,roughness)=>own(new THREE.MeshStandardMaterial({
  color,roughness,side:THREE.DoubleSide
 }));
 const waterMat=own(new THREE.MeshPhysicalMaterial({
  color:0xe5f1ed,vertexColors:true,metalness:.04,roughness:mobile?.42:quality==='beautiful'?.28:.36,
  clearcoat:mobile?.24:.72,clearcoatRoughness:.19,
  transparent:true,opacity:mobile?.97:.95,depthWrite:true,side:THREE.DoubleSide
 }));
 const flowTime={value:0};
 waterMat.onBeforeCompile=shader=>{
  shader.uniforms.uCherekFlowTime=flowTime;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\nvarying vec2 vCherekFlowUV;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nvCherekFlowUV=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
   '#include <common>\nvarying vec2 vCherekFlowUV;\nuniform float uCherekFlowTime;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
   [
    '#include <color_fragment>',
    'float c1=sin(vCherekFlowUV.x*17.-uCherekFlowTime*5.1+vCherekFlowUV.y*8.);',
    'float c2=sin(vCherekFlowUV.x*41.-uCherekFlowTime*8.3-vCherekFlowUV.y*13.);',
    'float wake=sin(vCherekFlowUV.x*6.1-uCherekFlowTime*1.8+sin(vCherekFlowUV.y*7.0)*2.2);\x27,\n     \x27float wave=.5+.5*(.51*c1+.29*c2+.20*wake);',
    'float flash=pow(max(0.,sin(vCherekFlowUV.x*27.-uCherekFlowTime*6.+vCherekFlowUV.y*19.)),12.);',
    'float uneven=.08*sin(vCherekFlowUV.x*2.3+vCherekFlowUV.y*8.1)*sin(vCherekFlowUV.x*3.4-uCherekFlowTime);\x27,\n     \x27diffuseColor.rgb*=.76+.34*wave+uneven;',
    'diffuseColor.rgb+=vec3(.16,.22,.21)*flash*.33;'
   ].join('\n'));
 };
 waterMat.customProgramCacheKey=()=> 'kunlum-cherek-flow-v2';
 const foamMat=own(new THREE.MeshBasicMaterial({
  color:0xe4f6ec,transparent:true,opacity:mobile?.46:.59,depthWrite:false,side:THREE.DoubleSide
 }));
 const mesh=(name,v,index,mat,tex=null,color=null,order=0)=>{
  const m=new THREE.Mesh(geo(v,index,tex,color),mat);
  m.name=name;m.renderOrder=order;root.add(m);return m;
 };
 mesh('Cherek channel gravel bed',bed,bi,standard(0x5c5a52,.99));
 mesh('Cherek eroded bank slopes',slope,si,standard(0x59594e,.95));
 mesh('Cherek rocky shore strips',shore,shi,standard(0x8f8975,1),null,null,1);
 mesh('Cherek flowing water',water,wi,waterMat,uv,rgb,2);
 mesh('Cherek rapids foam',foam,fi,foamMat,null,null,3);
 return {root,points,stats:{points:points.length,waterTriangles:wi.length/3,
  bedTriangles:bi.length/3,slopeTriangles:si.length/3,
  shoreTriangles:shi.length/3,foamTriangles:fi.length/3},
  update(timeSeconds){flowTime.value=timeSeconds},
  dispose(){for(const o of owned)o.dispose?.()}
 };
}
