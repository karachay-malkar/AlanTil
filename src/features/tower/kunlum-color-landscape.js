/**
 * Kunlum landscape colouring (view-only). Terrain elevations and wall coordinates never change.
 * The optional EOX 2016 mosaic is CC BY 4.0 with displayed attribution.
 * Source: https://cloudless.eox.at and Sentinel-2 cloudless 2016 (EOX).
 * Modern EOX mosaics have different/noncommercial licence terms and are not used.
 */
export const KUNLUM_SATELLITE_CREDIT =
 'Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)';
const EARTH_A=6378137, E2=0.0066943799901413165, UTM_K0=.9996;
export function utm38ToWgs84(easting,northing){
 const x=easting-500000,M=northing/UTM_K0,e1=(1-Math.sqrt(1-E2))/(1+Math.sqrt(1-E2));
 const mu=M/(EARTH_A*(1-E2/4-3*E2*E2/64-5*E2*E2*E2/256));
 const phi=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)
  +(21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)
  +(151*e1**3/96)*Math.sin(6*mu)+(1097*e1**4/512)*Math.sin(8*mu);
 const ep2=E2/(1-E2),sin=Math.sin(phi),cos=Math.cos(phi),tan=Math.tan(phi);
 const N=EARTH_A/Math.sqrt(1-E2*sin*sin),R=EARTH_A*(1-E2)/(1-E2*sin*sin)**1.5;
 const T=tan*tan,C=ep2*cos*cos,D=x/(N*UTM_K0);
 const lat=phi-(N*tan/R)*(D*D/2-(5+3*T+10*C-4*C*C-9*ep2)*D**4/24
  +(61+90*T+298*C+45*T*T-252*ep2-3*C*C)*D**6/720);
 const lon=(45*Math.PI/180)+(D-(1+2*T+C)*D**3/6
  +(5-2*C+28*T-3*C*C+8*ep2+24*T*T)*D**5/120)/cos;
 return [lon*180/Math.PI,lat*180/Math.PI];
}
export function webMercatorTile(lon,lat,z){
 const n=2**z,rad=Math.max(-85,Math.min(85,lat))*Math.PI/180;
 return [(lon+180)/360*n,(1-Math.log(Math.tan(Math.PI/4+rad/2))/Math.PI)/2*n];
}
export function buildKunlumSatelliteTilePlan(centerEasting,centerNorthing,{zoom=13,halfSizeM=1800,bounds=null,maxTiles=16}={}){
 if(!Number.isFinite(centerEasting)||!Number.isFinite(centerNorthing)||halfSizeM<=0||!Number.isInteger(zoom)||zoom<0||zoom>14)
  throw new Error('Invalid Sentinel mosaic extent');
 const coords=[];
 const xs=bounds?[bounds.minX,bounds.maxX]:[-halfSizeM,halfSizeM];
 const zs=bounds?[bounds.minZ,bounds.maxZ]:[-halfSizeM,halfSizeM];
 if(xs.some(x=>!Number.isFinite(x))||zs.some(z=>!Number.isFinite(z)))throw Error('Invalid satellite bounds');
 for(const dx of xs)for(const dz of zs){
  coords.push(webMercatorTile(...utm38ToWgs84(centerEasting+dx,centerNorthing+dz),zoom));
 }
 const x0=Math.floor(Math.min(...coords.map(p=>p[0]))),x1=Math.floor(Math.max(...coords.map(p=>p[0])));
 const y0=Math.floor(Math.min(...coords.map(p=>p[1]))),y1=Math.floor(Math.max(...coords.map(p=>p[1])));
 const count=(x1-x0+1)*(y1-y0+1);
 if(count>maxTiles)throw new Error('Sentinel tile count exceeds budget ('+count+' > '+maxTiles+')');
 return {zoom,x0,y0,x1,y1,width:(x1-x0+1)*256,height:(y1-y0+1)*256,count};
}
export function landscapeColor(heightASL,slope,x,z){
 const nx=Math.sin(x*.087+z*.034)*Math.cos(x*.029-z*.071);
 const grain=Math.sin(x*.37+z*.21)*Math.cos(z*.31-x*.13);
 const rough=Math.max(-1,Math.min(1,.63*nx+.37*grain));
 const s=Math.max(0,slope);
 let rgb;
 if(heightASL>2000||s>1.15)rgb=[151,145,130];  // exposed stone
 else if(s>.68||heightASL>1780)rgb=[164,150,121]; // scree / bare slopes
 else if(heightASL>1560)rgb=[133,140,108];          // thin alpine cover
 else if(heightASL>1320)rgb=[114,143,94];          // grass + sparse scrub
 else rgb=[122,154,99];                            // lower green slopes
 const d=rough*12+Math.min(1,s)*-8;
 return rgb.map(v=>Math.max(0,Math.min(1,(v+d)/255)));
}
export function createKunlumSatelliteTexture(THREE,{
 centerEasting=372151.107,centerNorthing=4773796.751,zoom=13,
 maxTiles=16,bounds=null,timeoutMs=10000,onStatus=()=>{}
}={}){
 const plan=buildKunlumSatelliteTilePlan(centerEasting,centerNorthing,{zoom,maxTiles,bounds});
 let texture=null,stopped=false;
 const uvForWorld=(x,z)=>{
  const [lon,lat]=utm38ToWgs84(centerEasting+x,centerNorthing+z);
  const [tx,ty]=webMercatorTile(lon,lat,zoom);
  return [(tx-plan.x0)*256/plan.width,1-(ty-plan.y0)*256/plan.height];
 };
 function imageFor(url){
  return new Promise((resolve,reject)=>{
   const image=new Image();
   image.crossOrigin='anonymous';
   let done=false;const timer=setTimeout(()=>{
    if(!done){done=true;image.onload=image.onerror=null;reject(new Error('Sentinel tile timeout'))}
   },timeoutMs);
   image.onload=()=>{if(!done){done=true;clearTimeout(timer);resolve(image)}};
   image.onerror=()=>{if(!done){done=true;clearTimeout(timer);reject(new Error('Sentinel tile failed (network/CORS)'))}};
   image.src=url;
  });
 }
 async function load(){
  onStatus('Загрузка Sentinel-2 cloudless 2016: '+plan.count+' плиток...');
  const items=[];
  for(let y=plan.y0;y<=plan.y1;y++)for(let x=plan.x0;x<=plan.x1;x++){
   items.push({x,y,url:'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/'+
    zoom+'/'+y+'/'+x+'.jpg'});
  }
  const images=await Promise.all(items.map(item=>imageFor(item.url)));
  if(stopped)return null;
  const canvas=document.createElement('canvas');canvas.width=plan.width;canvas.height=plan.height;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('Canvas 2D unavailable');
  images.forEach((img,i)=>ctx.drawImage(img,(items[i].x-plan.x0)*256,(items[i].y-plan.y0)*256,256,256));
  const next=new THREE.CanvasTexture(canvas);
  next.colorSpace=THREE.SRGBColorSpace;
  next.anisotropy=2;next.generateMipmaps=true;
  texture?.dispose();texture=next;
  onStatus('Sentinel-2 cloudless 2016 загружен ('+plan.count+' плиток).');
  return next;
 }
 return {plan,uvForWorld,load,dispose(){stopped=true;texture?.dispose();texture=null},get texture(){return texture}};
}
