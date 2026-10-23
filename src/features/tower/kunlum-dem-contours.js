/**
 * Isolines from Copernicus 30m DEM (no invented terrain detail).
 * Input elevations are metres relative to DEM.centerHeightASL.
 * Local ENU x/z points are converted to the source map's pixel coordinates
 * only with the existing, explicitly unverified one-point georegistration.
 */
export function demContourLines(heights,{stepM=30,size=121,centerHeightASL=0,intervalM=5,worldToPixel,bounds=[0,0,1843,1252],roiWorld=null}={}){
 if(![3,5].includes(intervalM))throw new Error('Contour interval must be 3 or 5 metres');
 if(!heights||heights.length!==size*size||typeof worldToPixel!=='function')throw new Error('Invalid DEM raster or transform');
 const [minX,minY,maxX,maxY]=bounds;

 // Full-grid marching squares then discard off-image edges. This preserves
 // contour connectivity and avoids accidental invented edge connections.
 const half=(size-1)/2,clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
 const minI=roiWorld?clamp(Math.floor(roiWorld.minX/stepM+half)-1,0,size-2):0;
 const maxI=roiWorld?clamp(Math.ceil(roiWorld.maxX/stepM+half)+1,0,size-2):size-2;
 const minJ=roiWorld?clamp(Math.floor(half-roiWorld.maxZ/stepM)-1,0,size-2):0;
 const maxJ=roiWorld?clamp(Math.ceil(half-roiWorld.minZ/stepM)+1,0,size-2):size-2;
 if(minI>maxI||minJ>maxJ)return [];
 let min=Infinity,max=-Infinity;
 for(let j=minJ;j<=maxJ+1;j++)for(let i=minI;i<=maxI+1;i++){
  const v=heights[j*size+i];if(Number.isFinite(v)){min=Math.min(min,v);max=Math.max(max,v)}
 }
 const lines=[],edges=[[0,1],[1,2],[2,3],[3,0]];
 const interpolate=(a,b,la,lb,lev)=>{
  const t=Math.max(0,Math.min(1,(lev-la)/(lb-la)));
  return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 };
 // Index labels clockwise: TL TR BR BL; world +z points north.
 const world=i=>[(i%size-(size-1)/2)*stepM,((size-1)/2-Math.floor(i/size))*stepM];
 const ixWorld=Array.from({length:size*size},(_,i)=>world(i));
 for(let lev=Math.ceil((min+centerHeightASL)/intervalM)*intervalM;lev<max+centerHeightASL;lev+=intervalM){
  const target=lev-centerHeightASL,segments=[];
  for(let j=minJ;j<=maxJ;j++)for(let i=minI;i<=maxI;i++){
   const index=j*size+i;
   const idx=[index,index+1,index+size+1,index+size];
   const ys=idx.map(k=>heights[k]);
   if(ys.some(y=>!Number.isFinite(y)))continue;
   const hits=[];
   for(let e=0;e<4;e++){
    const [a,b]=edges[e],ha=ys[a]>=target,hb=ys[b]>=target;
    if(ha!==hb)hits.push({edge:e,coord:interpolate(ixWorld[idx[a]],ixWorld[idx[b]],ys[a],ys[b],target)});
   }
   if(hits.length===2)segments.push([hits[0].coord,hits[1].coord]);
   if(hits.length===4){
    // Asymptotic-centre decision keeps saddle junctions disconnected.
    const cx=(ys[0]+ys[1]+ys[2]+ys[3])/4>=target;
    const pair=cx=== (ys[0]>=target)?[[0,1],[2,3]]:[[0,3],[1,2]];
    for(const [u,v] of pair)segments.push([hits[u].coord,hits[v].coord]);
   }
  }
  // Stitch segments by world-coordinate endpoints (precisely shared along grid edges).
  const adj=new Map(),key=p=>p.map(v=>Math.round(v*1e5)).join(',');
  for(let i=0;i<segments.length;i++)for(const end of segments[i]){
   const k=key(end);if(!adj.has(k))adj.set(k,[]);adj.get(k).push(i);
  }
  const used=new Set();
  for(let start=0;start<segments.length;start++){
   if(used.has(start))continue;
   const poly=[segments[start][0],segments[start][1]];used.add(start);
   for(const direction of [1,0]){
    let curr=direction===1?poly.at(-1):poly[0];
    while(true){
     const found=(adj.get(key(curr))||[]).find(id=>!used.has(id));
     if(found===undefined)break;
     used.add(found);const [a,b]=segments[found],next=key(a)===key(curr)?b:a;
     if(direction===1)poly.push(next);else poly.unshift(next);
     curr=next;
    }
   }
   const pixels=poly.map(worldToPixel);
   // Bounding rejection only: SVG viewBox clips paths exactly at source boundaries.
   const loX=Math.min(...pixels.map(p=>p[0])),hiX=Math.max(...pixels.map(p=>p[0]));
   const loY=Math.min(...pixels.map(p=>p[1])),hiY=Math.max(...pixels.map(p=>p[1]));
   if(hiX<minX||loX>maxX||hiY<minY||loY>maxY||pixels.length<2)continue;
   lines.push({elevationASL:lev,points:pixels});
  }
 }
 return lines;
}
export function terrainColor(elevationASL){
 // Deterministic: separate terraces at an equal absolute elevation have equal colour.
 const n=Math.round(elevationASL*10);
 const hue=((n*137.508/10)%360+360)%360;
 return 'hsl('+hue.toFixed(2)+', 62%, 46%)';
}
export function validTerraceFeature(feature){
 if(!feature||feature.type!=='terrace'||!Array.isArray(feature.points)||feature.points.length<3)return false;
 if(!Number.isFinite(feature.elevationASL))return false;
 const pts=feature.points;
 const area=Math.abs(pts.reduce((s,p,i)=>s+p[0]*pts[(i+1)%pts.length][1]-p[1]*pts[(i+1)%pts.length][0],0)/2);
 return area>1;
}
