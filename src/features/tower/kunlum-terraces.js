/**
 * Kunlum terrace planning. Plan geometry is historical-map pixel XY converted to local metres.
 * Terrain is Copernicus GLO-30; grouping and heights are provisional, not surveyed.
 * No destructive changes to house outlines. The two-stroke historic "houses" are skipped.
 */
export function makeKunlumTerracePlan(features, toWorld, heightAt, options={}){
 const maxGap=Math.max(.1,Number(options.maxGapM) || 7);
 const maxRise=Math.max(.1,Number(options.maxRiseM) || 3);
 const wallFeatures=features.filter(f=>f.type==='retaining' && f.points?.length>=2);
 const barriers=wallFeatures.map(f=>f.points.map(toWorld));
 const houses=features.filter(f=>f.type==='house').map(f=>{
  const raw=f.points||[], poly=raw.map(toWorld);
  if(poly.length>1 && distance(poly[0],poly[poly.length-1])<.01)poly.pop();
  const area=polyArea(poly);
  if(poly.length<3||area<.5)return null;
  const center=centroid(poly);
  return {id:f.id,poly,center,estimatedHeight:heightAt(center[0],center[1]),level:f.level??null};
 }).filter(Boolean);
 const skipped=features.filter(f=>f.type==='house'&&!houses.some(h=>h.id===f.id)).map(f=>f.id);
 const parent=houses.map((_,i)=>i);
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i};
 const union=(i,j)=>{i=root(i);j=root(j);if(i!==j)parent[j]=i};
 for(let i=0;i<houses.length;i++)for(let j=i+1;j<houses.length;j++){
  const a=houses[i],b=houses[j];
  if(a.level!=null&&b.level!=null&&a.level!==b.level)continue;
  const nearest=nearestBetweenPolys(a.poly,b.poly);
  if(nearest.dist>maxGap||Math.abs(a.estimatedHeight-b.estimatedHeight)>maxRise)continue;
  if(barriers.some(wall=>polylineCrosses(wall,nearest.a,nearest.b)))continue;
  union(i,j);
 }
 const containers=new Map();
 for(let i=0;i<houses.length;i++){const k=root(i);if(!containers.has(k))containers.set(k,[]);containers.get(k).push(houses[i]);}
 const groups=[...containers.values()].map((arr,i)=>{
  const poly=arr.length===1?arr[0].poly:convexHull(arr.flatMap(h=>h.poly));
  const y=median(arr.map(h=>h.estimatedHeight));
  return {id:'T'+String(i+1).padStart(2,'0'),houseIds:arr.map(h=>h.id),polygon:poly,height:y,
    estimated:true,centroid:centroid(poly),individualHeights:arr.map(h=>({id:h.id,height:h.estimatedHeight}))};
 });
 return {groups,houses,skipped,parameters:{maxGapM:maxGap,maxRiseM:maxRise},status:'DRAFT_DEM_30M_ONE_POINT_ALIGNMENT'};
}
function distance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function polyArea(poly){let a=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];a+=p[0]*q[1]-q[0]*p[1]}return Math.abs(a)*.5}
function centroid(poly){if(!poly.length)return [0,0];return [poly.reduce((s,p)=>s+p[0],0)/poly.length,poly.reduce((s,p)=>s+p[1],0)/poly.length];}
function median(xs){const s=[...xs].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]}
function project(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz;const t=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/len)):0;return [a[0]+dx*t,a[1]+dz*t]}
function segCross(a,b,c,d){
 const dx=b[0]-a[0],dy=b[1]-a[1],ex=d[0]-c[0],ey=d[1]-c[1],det=dx*ey-dy*ex;
 if(Math.abs(det)<1e-9)return null;
 const qx=c[0]-a[0],qy=c[1]-a[1],t=(qx*ey-qy*ex)/det,u=(qx*dy-qy*dx)/det;
 return t>=0&&t<=1&&u>=0&&u<=1?[a[0]+t*dx,a[1]+t*dy,t,u]:null;
}
function nearestBetweenPolys(a,b){
 let result={dist:Infinity,a:null,b:null};
 for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
  const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length];
  const cross=segCross(p,q,r,s);if(cross)return {dist:0,a:[cross[0],cross[1]],b:[cross[0],cross[1]]};
  for(const [x,y] of [[p,project(p,r,s)],[q,project(q,r,s)],[project(r,p,q),r],[project(s,p,q),s]]){
   const d=distance(x,y);if(d<result.dist)result={dist:d,a:x,b:y};
  }
 }
 return result;
}
function polylineCrosses(line,a,b){
 if(distance(a,b)<.2)return false;
 for(let i=1;i<line.length;i++){const hit=segCross(a,b,line[i-1],line[i]);if(hit&&hit[2]>.02&&hit[2]<.98&&hit[3]>.02&&hit[3]<.98)return true}
 return false;
}
function convexHull(points){
 const sorted=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const lo=[],hi=[];for(const p of sorted){while(lo.length>=2&&turn(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}
 for(let i=sorted.length-1;i>=0;i--){const p=sorted[i];while(hi.length>=2&&turn(hi[hi.length-2],hi[hi.length-1],p)<=0)hi.pop();hi.push(p)}
 lo.pop();hi.pop();return lo.concat(hi);
}
export function insidePolygon(poly,x,y){
 let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))inside=!inside;
 }return inside;
}
export function edgeDistance(poly,p){
 let distanceMin=Infinity;for(let i=0;i<poly.length;i++){const q=project(p,poly[i],poly[(i+1)%poly.length]);distanceMin=Math.min(distanceMin,distance(q,p))}
 return distanceMin;
}

/** Convex outer platform when nearby houses share one draft level; never alters their outlines. */
export function terraceFootprint(polygons){return polygons.length===1?polygons[0].map(p=>[...p]):convexHull(polygons.flatMap(p=>p));}
