/**
 * Real Copernicus GLO-30 Kunlum terrain with two geometry resolutions.
 * EPSG:32638 east/north. The user-calibrated map is provisional (one control point).
 * The far panorama beyond the DEM is a procedural visualization, not Google imagery
 * nor a measured distant skyline. All distances in world coordinates are metres.
 */
import {KUNLUM_DEM} from './kunlum-dem-data.js';
import {pixelToLocalWorld,sampleDemLocal} from './kunlum-georeference.js';
import {carveKunlumRiverHeight} from './kunlum-river-layer.js';

let decoded=null;
export function getKunlumHeights(){
 if(decoded)return decoded;
 const raw=atob(KUNLUM_DEM.heightsBase64),size=KUNLUM_DEM.width*KUNLUM_DEM.height;
 if(raw.length!==size*2)throw Error('Invalid Kunlum DEM grid');
 const out=new Float32Array(size);
 for(let i=0;i<size;i++){
  let d=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);
  if(d>32767)d-=65536;
  out[i]=d/10;
 }
 decoded=out;return out;
}
export function makeKunlumTerrain(THREE,group,{mobile=false,plot,calibration,register=()=>{},mirrorDemX=false,pbr=null}={}){
 const heights=getKunlumHeights();
 // The plot centre stays at the existing gameplay (10,0,10).
 const centrePixel=[plot.x+plot.widthM*plot.ppm/2,plot.y+plot.heightM*plot.ppm/2];
 const [centerEast,centerNorth]=pixelToLocalWorld(centrePixel,calibration);
 const baseHeight=sampleDemLocal(heights,centerEast,centerNorth);
 const demToScene=(east,north)=>[(mirrorDemX?centerEast-east:east-centerEast)+10,north-centerNorth+10];
 const sceneToDem=(x,z)=>[centerEast+(mirrorDemX?10-x:x-10),z-10+centerNorth];
 const sample=(east,north)=>sampleDemLocal(heights,east,north);
 const clamped=(x,a,b)=>Math.max(a,Math.min(b,x));
 const smooth=t=>{t=clamped(t,0,1);return t*t*(3-2*t)};
 const reserve=[-10,30,-15,35]; // Retain current interactive 40×50 m clear zone
 function surfaceAt(x,z){
  const [e,n]=sceneToDem(x,z);
  const rel=sample(e,n)-baseHeight;
  const outX=Math.max(reserve[0]-x,0,x-reserve[1]);
  const outZ=Math.max(reserve[2]-z,0,z-reserve[3]);
  return rel*smooth(Math.hypot(outX,outZ)/32);
 }
 let riverLine=[];
 function heightAt(x,z){
  const natural=surfaceAt(x,z);
  return riverLine.length>1?carveKunlumRiverHeight(x,z,surfaceAt,riverLine):natural;
 }
 const terrainMeshes=[];
 function setRiverLine(line){
  riverLine=Array.isArray(line)?line:[];
  for(const mesh of terrainMeshes){
   const attr=mesh.geometry.getAttribute('position');
   for(let i=0;i<attr.count;i++)attr.setY(i,heightAt(attr.getX(i),attr.getZ(i)));
   attr.needsUpdate=true;mesh.geometry.computeVertexNormals();
   mesh.geometry.computeBoundingSphere();
  }
 }
 function addTerrainTile(x0,x1,z0,z1,step,label){
  const nx=Math.max(2,Math.ceil((x1-x0)/step)),nz=Math.max(2,Math.ceil((z1-z0)/step));
  const pos=new Float32Array((nx+1)*(nz+1)*3),col=new Float32Array(pos.length),uv=new Float32Array((nx+1)*(nz+1)*2);
  const color=new THREE.Color(),low=new THREE.Color(),high=new THREE.Color();
  const elevations=[[-200,'#637e5d'],[-75,'#7d9166'],[75,'#a39e75'],[250,'#b8a690'],[525,'#b6a995'],[900,'#bfc3be'],[1250,'#e0e1db']];
  function shade(h,x,z){
   const a=h+baseHeight;let i=1;
   while(i<elevations.length-1&&a>elevations[i][0])i++;
   const A=elevations[i-1],B=elevations[i];
   const f=clamped((a-A[0])/(B[0]-A[0]),0,1);
   low.set(A[1]);high.set(B[1]);color.copy(low).lerp(high,f);
   const variegation=.94+.065*Math.sin(x*.085+Math.cos(z*.07)*2.7)+.035*Math.sin(z*.31+x*.28);
   return color.multiplyScalar(variegation);
  }
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
   const x=x0+(x1-x0)*i/nx,z=z0+(z1-z0)*j/nz,y=heightAt(x,z);
   const idx=(j*(nx+1)+i)*3;pos[idx]=x;pos[idx+1]=y;pos[idx+2]=z;
   if(pbr){
    const [e,n]=sceneToDem(x,z);
    const slope=Math.hypot((surfaceAt(x+5,z)-surfaceAt(x-5,z))/10,
      (surfaceAt(x,z+5)-surfaceAt(x,z-5))/10);
    const rgb=pbr.terrainColor(sample(e,n)+1251.24,slope,x,z);
    col[idx]=rgb[0];col[idx+1]=rgb[1];col[idx+2]=rgb[2];
   }else{
    const c=shade(y,x,z);col[idx]=c.r;col[idx+1]=c.g;col[idx+2]=c.b;
   }
   const ti=(j*(nx+1)+i)*2;uv[ti]=x*(pbr?.texScale||.1);uv[ti+1]=z*(pbr?.texScale||.1);
  }
  const index=[];
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
   const a=j*(nx+1)+i,b=a+1,d=a+nx+1,c=d+1;
   index.push(a,d,b,b,d,c);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(col,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geometry.setIndex(index);geometry.computeVertexNormals();
  const material=pbr?.material||new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.FrontSide});
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=label;mesh.frustumCulled=true;mesh.receiveShadow=false;
  group.add(mesh);terrainMeshes.push(mesh);register(geometry,pbr?null:material);return index.length/3;
 }
 const centreX=10,centreZ=10,near=mobile?450:600,step=mobile?12:8;
 const west=(mirrorDemX?centerEast-1800:-1800-centerEast)+10,
  east=(mirrorDemX?centerEast+1800:1800-centerEast)+10;
 const south=-1800-centerNorth+10,north=1800-centerNorth+10;
 // Rectangular tiles share the same bilinear sampler, so LOD edges are watertight.
 let triangles=addTerrainTile(centreX-near,centreX+near,centreZ-near,centreZ+near,step,'Copernicus · near 3D terrain');
 const tiles=[
  [west,centreX-near,south,north,'West outer terrain'],
  [centreX+near,east,south,north,'East outer terrain'],
  [centreX-near,centreX+near,south,centreZ-near,'South outer terrain'],
  [centreX-near,centreX+near,centreZ+near,north,'North outer terrain']
 ];
 for(const [x0,x1,z0,z1,name] of tiles){
  if(x1-x0<2||z1-z0<2)continue;
  triangles+=addTerrainTile(x0,x1,z0,z1,30,name);
 }
 return {heights,baseHeight,centerEast,centerNorth,demToScene,sceneToDem,heightAt,surfaceAt,setRiverLine,
  triangles,nearRadius:near,extentM:3600,plotMetres:[plot.widthM,plot.heightM]};
}
/**
 * Non-photographic panorama: outline extrapolated from the DEM boundary.
 * Its purpose is to close the sky beyond the 3.6 km surveyed tile.
 * Explicitly not an accurate representation of peaks outside the input DEM.
 */
export function makeKunlumPanorama(THREE,group,terrain,{mobile=false,register=()=>{}}={}){
 const canvas=document.createElement('canvas');
 canvas.width=mobile?1024:2048;canvas.height=512;
 const ctx=canvas.getContext('2d');
 if(!ctx)return {dispose(){}};
 const W=canvas.width,H=canvas.height;
 const grad=ctx.createLinearGradient(0,0,0,H);
 grad.addColorStop(0,'#aec6d8');grad.addColorStop(.46,'#c7d4d9');
 grad.addColorStop(.72,'#b7c9cb');grad.addColorStop(1,'#b4bbb1');
 ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
 const lines=[];
 for(let i=0;i<=W;i++){
  const theta=2*Math.PI*i/W;
  // Match the actual finite DEM boundary, without reading from other providers.
  const dx=Math.sin(theta),dz=Math.cos(theta);
  const r=1720/Math.max(Math.abs(dx),Math.abs(dz),.001);
  const [east,north]=terrain.sceneToDem(10+dx*r,10+dz*r);
  const h=terrain.heights&&sampleDemLocal(terrain.heights,east,north)-terrain.baseHeight||0;
  // Pixel height is approximate angular skyline; beyond the boundary this is art.
  const horizon=(h/r)*210;
  const waves=12*Math.sin(theta*5.3)+7*Math.sin(theta*13.4+.6);
  lines.push(Math.max(62,Math.min(405,335-horizon-waves)));
 }
 // Several translucent atmospheric layers, all made in-browser from contours.
 for(let layer=2;layer>=0;layer--){
  ctx.beginPath();ctx.moveTo(0,H);
  for(let i=0;i<=W;i++){
   const y=lines[i]+layer*39+12*Math.sin(i/W*Math.PI*2*(5+layer)+layer*1.2);
   ctx.lineTo(i,y);
  }
  ctx.lineTo(W,H);ctx.closePath();
  ctx.fillStyle=['#7f9a91','#94aca4','#a8bcb2'][layer];
  ctx.globalAlpha=[.76,.60,.36][layer];ctx.fill();
 }
 ctx.globalAlpha=1;
 // Soft grain to keep repeated sections non-flat without a photographic texture.
 for(let i=0;i<900;i++){
  const x=(i*131.37)%W,y=220+((i*71.19)%290);
  ctx.fillStyle=i%4?'#ffffff0a':'#4a625b0b';
  ctx.fillRect(x,y,i%3+1,1);
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.RepeatWrapping;
 texture.anisotropy=1;
 const geometry=new THREE.CylinderGeometry(3150,3150,3100,mobile?64:128,1,true);
 const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide,depthWrite:false,fog:false});
 const mesh=new THREE.Mesh(geometry,material);
 mesh.position.set(10,380,10);mesh.name='Procedural distant skyline · beyond DEM, not surveyed';
 mesh.renderOrder=-10;group.add(mesh);
 register(geometry,material,texture);
 return {mesh};
}
