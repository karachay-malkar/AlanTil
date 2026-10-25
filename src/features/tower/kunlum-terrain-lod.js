/**
 * Real Copernicus GLO-30 Kunlum terrain with two geometry resolutions.
 * EPSG:32638 east/north. The user-calibrated map is provisional (one control point).
 * The far panorama beyond the DEM is a procedural visualization, not Google imagery
 * nor a measured distant skyline. All distances in world coordinates are metres.
 */
import {KUNLUM_DEM} from './kunlum-dem-data.js';
import {pixelToLocalWorld,sampleDemLocal} from './kunlum-georeference.js';
import {carveKunlumRiverHeight} from './kunlum-river-layer.js';
import {KUNLUM_BUILD_PARCEL as SITE,isWithinKunlumParcel,kunlumTerraceBlend} from '../../../packages/tower-game/kunlum-parcel.mjs';

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
export function makeKunlumTerrain(THREE,group,{mobile=false,plot,calibration,register=()=>{},mirrorDemX=false,pbr=null,alignment=null}={}){
 const heights=getKunlumHeights();
 // Terrain height baseline follows the current construction plot centre.
 const centrePixel=[plot.x+plot.widthM*plot.ppm/2,plot.y+plot.heightM*plot.ppm/2];
 const [legacyEast,legacyNorth]=pixelToLocalWorld(centrePixel,calibration);
 const centerEast=alignment?.origin[0]??legacyEast;
 const centerNorth=alignment?.origin[1]??legacyNorth;
 const demToScene=alignment?.demToScene||
  ((east,north)=>[(mirrorDemX?centerEast-east:east-centerEast)+10,north-centerNorth+10]);
 const sceneToDem=alignment?.sceneToDem||
  ((x,z)=>[centerEast+(mirrorDemX?10-x:x-10),z-10+centerNorth]);
 const [anchorE,anchorN]=sceneToDem(SITE.centerX,SITE.centerZ);
 const baseHeight=sampleDemLocal(heights,anchorE,anchorN);
 const sample=(east,north)=>sampleDemLocal(heights,east,north);
 const clamped=(x,a,b)=>Math.max(a,Math.min(b,x));
 const smooth=t=>{t=clamped(t,0,1);return t*t*(3-2*t)};
 // Flatten only the construction parcel, blending naturally within 12m.
 function surfaceAt(x,z){
  const [e,n]=sceneToDem(x,z);
  return (sample(e,n)-baseHeight)*kunlumTerraceBlend(x,z);
 }
 let riverLine=[];
 function heightAt(x,z){
  if(isWithinKunlumParcel(x,z))return 0;
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
 const centreX=SITE.centerX,centreZ=SITE.centerZ,near=mobile?450:600,step=mobile?12:8;
 const [leftA]=demToScene(-1800,0),[leftB]=demToScene(1800,0);
 const west=Math.min(leftA,leftB),east=Math.max(leftA,leftB);
 const south=demToScene(0,-1800)[1],north=demToScene(0,1800)[1];
 // Rectangular tiles share the same bilinear sampler, so LOD edges are watertight.
 // Fine local detail, economical normal LOD outside; adjacent tiles do not overlap.
 const focus={minX:SITE.minX-15,maxX:SITE.maxX+15,minZ:SITE.minZ-15,maxZ:SITE.maxZ+15};
 const nearTiles=[
  [centreX-near,focus.minX,centreZ-near,centreZ+near,step,'Near west'],
  [focus.maxX,centreX+near,centreZ-near,centreZ+near,step,'Near east'],
  [focus.minX,focus.maxX,centreZ-near,focus.minZ,step,'Near south'],
  [focus.minX,focus.maxX,focus.maxZ,centreZ+near,step,'Near north'],
  [focus.minX,focus.maxX,focus.minZ,focus.maxZ,mobile?2:1.25,'Level parcel detail']
 ];
 let triangles=0;
 for(const [x0,x1,z0,z1,res,name] of nearTiles)
  triangles+=addTerrainTile(x0,x1,z0,z1,res,name);
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
 let wideMesh=null;
 // The central Copernicus geometry is never removed or resampled.
 // The real Mapzen DEM is rendered ONLY outside its authoritative 3.6km core.
 function installWideDem(wide){
  if(!wide?.loaded||wideMesh)throw Error('Expanded terrain must be loaded once');
  const bounds=wide.bounds;
  const [xA]=demToScene(bounds.minX,0),[xB]=demToScene(bounds.maxX,0);
  const minX=Math.min(xA,xB),maxX=Math.max(xA,xB);
  const minZ=demToScene(0,bounds.minZ)[1],maxZ=demToScene(0,bounds.maxZ)[1];
  const root=new THREE.Group();root.name='Mapzen real expanded DEM outside Copernicus 3.6km';
  const step=mobile?90:70,idxStep=30;
  let wideTriangles=0;
  function band(x0,x1,z0,z1,stepX,stepZ,label){
   if(x1<=x0||z1<=z0)return;
   const nx=Math.max(1,Math.ceil((x1-x0)/stepX));
   const nz=Math.max(1,Math.ceil((z1-z0)/stepZ));
   const count=(nx+1)*(nz+1),positions=new Float32Array(count*3);
   const colors=new Float32Array(count*3),uvs=new Float32Array(count*2),indices=[];
   for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=x0+(x1-x0)*i/nx,z=z0+(z1-z0)*j/nz;
    const [e,n]=sceneToDem(x,z),y=wide.sample(e,n)-baseHeight;
    const off=(j*(nx+1)+i)*3;
    positions[off]=x;positions[off+1]=y;positions[off+2]=z;
    if(pbr){
     const sampleHeight=(tx,tz)=>{
      const [u,v]=sceneToDem(tx,tz);
      return wide.sample(u,v)-baseHeight;
     };
     const slope=Math.hypot(
      (sampleHeight(Math.max(minX,x-12),z)-sampleHeight(Math.min(maxX,x+12),z))/24,
      (sampleHeight(x,Math.max(minZ,z-12))-sampleHeight(x,Math.min(maxZ,z+12)))/24
     );
     const rgb=pbr.terrainColor(y+baseHeight+1251.24,slope,x,z);
     colors.set(rgb,off);
    }else{colors[off]=colors[off+1]=colors[off+2]=.8;}
    const ui=(j*(nx+1)+i)*2;uvs[ui]=x*(pbr?.texScale||.1);uvs[ui+1]=z*(pbr?.texScale||.1);
   }
   for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;
    indices.push(a,c,b,b,c,d);
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
   geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
   geo.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
   geo.setIndex(indices);geo.computeVertexNormals();
   const mat=pbr?.material||new THREE.MeshLambertMaterial({vertexColors:true});
   const mesh=new THREE.Mesh(geo,mat);mesh.name=label;
   root.add(mesh);register(geo,pbr?null:mat);
   wideTriangles+=indices.length/3;
  }
  // Core-edge bands retain 30m spacing along the seam (no unfilled T-junctions).
  band(minX,west,minZ,maxZ,step,idxStep,'Mapzen western rim');
  band(east,maxX,minZ,maxZ,step,idxStep,'Mapzen eastern rim');
  band(west,east,minZ,south,idxStep,step,'Mapzen southern rim');
  band(west,east,north,maxZ,idxStep,step,'Mapzen northern rim');
  group.add(root);wideMesh=root;
  return {triangles:wideTriangles,extent:[maxX-minX,maxZ-minZ]};
 }
 return {heights,baseHeight,centerEast,centerNorth,demToScene,sceneToDem,heightAt,surfaceAt,setRiverLine,
  installWideDem,
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
