/**
 * OpenStreetMap Cherek Balkarsky centreline, NOT a DEM trough guess.
 * Overpass data © OpenStreetMap contributors (ODbL); precision is map-grade,
 * not surveyed hydrology. Only use named Cherek/Balkar river ways.
 */
import {utm38ToWgs84} from './kunlum-color-landscape.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const R=Math.PI/180;
const isMainCherek=tags=>{
 const values=[tags?.name,tags?.['name:ru'],tags?.['name:en'],tags?.['name:local']].filter(Boolean).join(' ').toLowerCase();
 return /черек|чирик|cherek|čerek|cher[eé]k|малкъар черек/.test(values) &&
  !/безенг|безинг|bezeng/.test(values);
};
/** Project WGS84 geographic coordinates back to source UTM38 (local metres).
 * Analytic Jacobian around the DEM's recorded control point avoids a large
 * external projection library; near the tower, linearization error is small.
 */
export function createKunlumRiverProjection({easting=372151.107,northing=4773796.751}={}){
 const origin=utm38ToWgs84(easting,northing),e=utm38ToWgs84(easting+100,northing),
 n=utm38ToWgs84(easting,northing+100);
 const a=(e[0]-origin[0])/100,b=(n[0]-origin[0])/100,
  c=(e[1]-origin[1])/100,d=(n[1]-origin[1])/100,det=a*d-b*c;
 if(!Number.isFinite(det)||Math.abs(det)<1e-16)throw Error('Invalid UTM38 projection');
 return ([lon,lat])=>{
  const dx=lon-origin[0],dy=lat-origin[1];
  return {x:(d*dx-b*dy)/det,z:(-c*dx+a*dy)/det};
 };
}
export function extractKunlumCherekPolyline(osm,{
 project,sourceBounds={minX:-2300,maxX:3800,minZ:-3800,maxZ:3800}
}={}){
 if(typeof project!=='function')throw Error('River projection is required');
 const ways=(osm?.elements||[]).filter(w=>
  w.type==='way'&&w.tags?.waterway==='river'&&isMainCherek(w.tags)&&
  Array.isArray(w.geometry)&&w.geometry.length>1);
 if(!ways.length)throw Error('В OSM не найдена подписанная линия Черека Балкарского');
 let segments=ways.map(w=>(w.geometry||[]).map(p=>project([p.lon,p.lat]))).filter(x=>x.length>1);
 // Join touching OSM way segments, but do not invent missing river reaches.
 const sq=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;
 segments.sort((a,b)=>b.length-a.length);
 const stitched=[];
 while(segments.length){
  let chain=segments.shift(),changed=true;
  while(changed){
   changed=false;
   for(let j=0;j<segments.length;j++){
    const other=segments[j],a=chain[0],b=chain.at(-1),c=other[0],d=other.at(-1);
    const variants=[[sq(b,c),'end-front'],[sq(b,d),'end-back'],
     [sq(a,d),'front-back'],[sq(a,c),'front-front']];
    variants.sort((x,y)=>x[0]-y[0]);
    if(variants[0][0]>45**2)continue;
    const mode=variants[0][1];
    if(mode==='end-front')chain=chain.concat(other.slice(1));
    else if(mode==='end-back')chain=chain.concat([...other].reverse().slice(1));
    else if(mode==='front-back')chain=other.slice(0,-1).concat(chain);
    else chain=[...other].reverse().slice(0,-1).concat(chain);
    segments.splice(j,1);changed=true;break;
   }
  }
  stitched.push(chain);
 }
 // OSM ways may be clipped to the bbox; select the longest plausible Cherek
 // path nearest to the DEM control point, not a tributary in another valley.
 const length=line=>line.slice(1).reduce((sum,v,i)=>sum+Math.hypot(v.x-line[i].x,v.z-line[i].z),0);
 stitched.sort((a,b)=>length(b)-length(a));
 const line=stitched.find(line=>length(line)>250)||stitched[0];
 const inside=line.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&
  p.x>=sourceBounds.minX&&p.x<=sourceBounds.maxX&&
  p.z>=sourceBounds.minZ&&p.z<=sourceBounds.maxZ);
 if(inside.length<2||length(inside)<200)throw Error('Линия OSM не покрывает область Кюнлюма');
 // Retain the true polyline vertices; never replace them with a synthetic
 // minimum-altitude path. Mesh interpolation only densifies actual segments.
 if(inside[0].z>inside.at(-1).z)inside.reverse();
 const out=[];
 for(let i=0;i<inside.length;i++){
  if(i&&Math.hypot(inside[i].x-inside[i-1].x,inside[i].z-inside[i-1].z)>600)
   break; // disconnected clipping, do not bridge hundreds of metres
  out.push({x:inside[i].x,z:inside[i].z});
 }
 if(out.length<2||length(out)<200)throw Error('Русло OSM разорвано, нет непрерывного участка');
 return out;
}
export async function loadKunlumCherekOSM({
 timeoutMs=12500,fetchImpl=fetch,easting=372151.107,northing=4773796.751,
 sourceBounds={minX:-2300,maxX:3800,minZ:-3800,maxZ:3800}
}={}){
 const project=createKunlumRiverProjection({easting,northing});
 const corners=[];
 for(const x of [sourceBounds.minX,sourceBounds.maxX])
  for(const z of [sourceBounds.minZ,sourceBounds.maxZ])
   corners.push(utm38ToWgs84(easting+x,northing+z));
 const south=Math.min(...corners.map(p=>p[1]))-.002,
  north=Math.max(...corners.map(p=>p[1]))+.002,
  west=Math.min(...corners.map(p=>p[0]))-.002,
  east=Math.max(...corners.map(p=>p[0]))+.002;
 const q='[out:json][timeout:20];way["waterway"="river"]('+
  [south,west,north,east].map(x=>x.toFixed(6)).join(',')+');out geom;';
 const hosts=['https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'];
 const errors=[];
 for(const host of hosts){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const res=await fetchImpl(host+'?data='+encodeURIComponent(q),{signal:controller.signal});
   if(!res.ok)throw Error('HTTP '+res.status);
   const data=await res.json();
   const line=extractKunlumCherekPolyline(data,{project,sourceBounds});
   return {line,source:'OpenStreetMap / '+host,licence:'ODbL'};
  }catch(e){errors.push(e.message)}
  finally{clearTimeout(timeout)}
 }
 throw Error('OSM недоступна или не содержит непрерывного русла ('+errors.join('; ')+')');
}
