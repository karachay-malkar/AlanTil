/**
 * Read-only outer DEM for Kunlum (not Copernicus): Mapzen / AWS Terrain Tiles.
 * Original 121x121 Copernicus DEM remains authoritative for the whole
 * [-1800,+1800] m square. Outside heights are from Terrarium pixel data.
 * A decaying edge offset aligns two datasets without editing inner heights.
 * Sources and attribution: https://registry.opendata.aws/terrain-tiles/
 */
import {utm38ToWgs84,webMercatorTile} from './kunlum-color-landscape.js';
export const KUNLUM_WIDE_BOUNDS=Object.freeze({
 minX:-2300,maxX:3800,minZ:-3800,maxZ:3800
});
export const KUNLUM_WIDE_CREDIT='Outer DEM: Mapzen / AWS Terrain Tiles (Terrarium; mixed DEM sources). Central DEM: Copernicus GLO-30.';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function wideDemTilePlan({
 bounds=KUNLUM_WIDE_BOUNDS,zoom=13,
 easting=372151.107,northing=4773796.751,maxTiles=18
}={}){
 if(!bounds||bounds.minX>=bounds.maxX||bounds.minZ>=bounds.maxZ||zoom<0||zoom>14||!Number.isInteger(zoom))
  throw Error('Invalid expanded DEM bounds');
 const corners=[];
 for(const x of [bounds.minX,bounds.maxX])for(const z of [bounds.minZ,bounds.maxZ])
  corners.push(webMercatorTile(...utm38ToWgs84(easting+x,northing+z),zoom));
 const x0=Math.floor(Math.min(...corners.map(p=>p[0]))),x1=Math.floor(Math.max(...corners.map(p=>p[0])));
 const y0=Math.floor(Math.min(...corners.map(p=>p[1]))),y1=Math.floor(Math.max(...corners.map(p=>p[1])));
 const tiles=(x1-x0+1)*(y1-y0+1);
 if(tiles>maxTiles)throw Error('Expanded DEM exceeds tile budget: '+tiles);
 return {bounds,zoom,x0,x1,y0,y1,width:(x1-x0+1)*256,height:(y1-y0+1)*256,tiles,easting,northing};
}
export function decodeTerrariumPixel(r,g,b){
 return r*256+g+b/256-32768;
}
export function buildWideAxis(a,b,{innerA=-1800,innerB=1800,innerStep=30,outerStep=60}={}){
 if(!(a<innerA&&b>innerB&&innerStep>0&&outerStep>0))
  throw Error('Wide axis must enclose original DEM');
 const axis=[a];
 function append(start,end,step){
  let x=start;
  while(x+step<end-1e-6){x+=step;axis.push(x)}
  axis.push(end);
 }
 append(a,innerA,outerStep);
 append(innerA,innerB,innerStep);
 append(innerB,b,outerStep);
 return axis;
}
export function createKunlumWideDem(originalSample,{
 bounds=KUNLUM_WIDE_BOUNDS,zoom=13,
 easting=372151.107,northing=4773796.751,centerHeightASL=1251.24,
 timeoutMs=15000,onStatus=()=>{}
}={}){
 if(typeof originalSample!=='function')throw Error('Original DEM sampler required');
 const plan=wideDemTilePlan({bounds,zoom,easting,northing});
 let pixels=null,disposed=false;
 function imageFor(x,y){
  return new Promise((resolve,reject)=>{
   const image=new Image();image.crossOrigin='anonymous';
   let finished=false;
   const finish=(err)=>{
    if(finished)return;
    finished=true;clearTimeout(timer);
    image.onload=image.onerror=null;
    if(err)reject(err);else resolve(image);
   };
   const timer=setTimeout(()=>finish(new Error('Тайм-аут карты высот')),timeoutMs);
   image.onload=()=>finish(null);
   image.onerror=()=>finish(new Error('Не загружены внешние высоты (сеть/CORS)'));
   image.src='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+zoom+'/'+x+'/'+y+'.png';
  });
 }
 async function load(){
  if(disposed)throw Error('Expanded DEM disposed');
  onStatus('Дополнительные высоты: загружаются '+plan.tiles+' плиток Mapzen…');
  const tiles=[];
  for(let y=plan.y0;y<=plan.y1;y++)for(let x=plan.x0;x<=plan.x1;x++)tiles.push({x,y});
  const images=await Promise.all(tiles.map(t=>imageFor(t.x,t.y)));
  if(disposed)return null;
  const c=document.createElement('canvas');c.width=plan.width;c.height=plan.height;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Canvas unavailable');
  images.forEach((image,i)=>ctx.drawImage(image,(tiles[i].x-plan.x0)*256,(tiles[i].y-plan.y0)*256,256,256));
  const rgba=ctx.getImageData(0,0,plan.width,plan.height).data;
  const next=new Float32Array(plan.width*plan.height);
  for(let i=0;i<next.length;i++){
   next[i]=decodeTerrariumPixel(rgba[i*4],rgba[i*4+1],rgba[i*4+2]);
  }
  const [clon,clat]=utm38ToWgs84(easting,northing);
  const [cx,cy]=webMercatorTile(clon,clat,zoom);
  const px=(cx-plan.x0)*256,py=(cy-plan.y0)*256;
  if(!Number.isFinite(sampleBilinear(next,plan.width,plan.height,px,py))||
     sampleBilinear(next,plan.width,plan.height,px,py)<-1000)
   throw Error('Invalid external DEM pixels');
  pixels=next;
  onStatus('Внешние высоты Mapzen загружены. Центр остался исходным Copernicus DEM.');
  return {plan,bounds};
 }
 function rawAt(x,z){
  if(!pixels)throw Error('Expanded DEM is not ready');
  const [lon,lat]=utm38ToWgs84(easting+x,northing+z);
  const [tx,ty]=webMercatorTile(lon,lat,zoom);
  return sampleBilinear(pixels,plan.width,plan.height,(tx-plan.x0)*256-.5,(ty-plan.y0)*256-.5);
 }
 function sample(x,z){
  const ix=clamp(x,-1800,1800),iz=clamp(z,-1800,1800);
  if(x===ix&&z===iz)return originalSample(x,z);
  if(x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ)
   throw Error('Height requested outside expanded DEM');
  const outer=rawAt(x,z)-centerHeightASL;
  // Snap exactly at original boundary; decay vertical alignment into the outer region.
  const seam=originalSample(ix,iz)-(rawAt(ix,iz)-centerHeightASL);
  const distance=Math.hypot(x-ix,z-iz);
  return outer+seam*Math.exp(-distance/680);
 }
 return {plan,bounds,load,sample,get loaded(){return !!pixels},dispose(){disposed=true;pixels=null}};
}
export function sampleBilinear(pixels,width,height,x,y){
 x=clamp(x,0,width-1);y=clamp(y,0,height-1);
 const ix=Math.floor(x),iy=Math.floor(y),nx=Math.min(ix+1,width-1),ny=Math.min(iy+1,height-1);
 const fx=x-ix,fy=y-iy;
 const a=pixels[iy*width+ix],b=pixels[iy*width+nx],c=pixels[ny*width+ix],d=pixels[ny*width+nx];
 return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
}
