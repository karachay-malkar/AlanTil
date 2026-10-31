/** Roof mask in 25-cm CELL-CENTRE coordinates. Mirrors private.tower_roof_cells. */
export const ROOF_CELL=0.25;
export const ROOF_PRICE_PER_CELL=4;
export const ROOF_MODEL_VERSION='17.2-roof-cover.1';
export const ROOF_GRID_X=60,ROOF_GRID_Z=120;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const between=(n,a,b)=>n>=Math.min(a,b)&&n<=Math.max(a,b);
const onSegment=(p,a,b)=>cross(a,b,p)===0&&between(p[0],a[0],b[0])&&between(p[1],a[1],b[1]);
const intersects=(a,b,c,d)=>{
 const u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),q=cross(c,d,b);
 return (u*v<0&&w*q<0)||(u===0&&onSegment(c,a,b))||(v===0&&onSegment(d,a,b))||
 (w===0&&onSegment(a,c,d))||(q===0&&onSegment(b,c,d));
};
export function validRoofPoints(points){
 if(!Array.isArray(points)||points.length<1||points.length>64)return false;
 if(points.some(p=>!Array.isArray(p)||p.length!==2||!Number.isInteger(p[0])||!Number.isInteger(p[1])||
 p[0]<0||p[0]>=ROOF_GRID_X||p[1]<0||p[1]>=ROOF_GRID_Z))return false;
 if(points.length>1&&points.some((p,i)=>p[0]===points[(i+1)%points.length][0]&&p[1]===points[(i+1)%points.length][1]))return false;
 for(let i=0;i<points.length;i++)for(let j=i+2;j<points.length;j++){
  if(i===0&&j===points.length-1)continue;
  if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return false;
 }
 return true;
}
export function roofCoverCells(points){
 if(!validRoofPoints(points))return [];
 const n=points.length,xx=points.map(p=>p[0]),zz=points.map(p=>p[1]);
 const cells=[];
 for(let x=Math.min(...xx);x<=Math.max(...xx);x++)for(let z=Math.min(...zz);z<=Math.max(...zz);z++){
  let inside=false,border=n===1&&x===points[0][0]&&z===points[0][1];
  for(let i=0;i<n;i++){
   const [ax,az]=points[i],[bx,bz]=points[(i+1)%n],dx=bx-ax,dz=bz-az;
   const denom=dx*dx+dz*dz;
   if(!denom)continue;
   const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/denom));
   if((x-ax-t*dx)**2+(z-az-t*dz)**2<=0.25000001)border=true;
   if(n>=3&&(az>z)!==(bz>z)&&x<ax+dx*(z-az)/dz)inside=!inside;
  }
  if(inside||border)cells.push([x,z]);
 }
 return cells;
}
export const roofPrice=points=>roofCoverCells(points).length*ROOF_PRICE_PER_CELL;
export function checkRoofPlacement(points,level,sections,roofs=[]){
 if(!Number.isInteger(level)||level<0||level>=80||!validRoofPoints(points))return {ok:false,reason:'INVALID_ROOF_POINTS',cells:[]};
 const cells=roofCoverCells(points);
 if(!cells.length)return {ok:false,reason:'INVALID_ROOF_AREA',cells};
 for(const [x,z] of cells){
  const collides=sections.some(b=>{
   if(b.type!=='masonry_section')return false;
   const t=b._roofBounds;if(!t)return false;
   return t.min[1]<=level&&t.max[1]>level&&x>=t.min[0]&&x<t.max[0]&&z>=t.min[2]&&z<t.max[2];
  });
  if(collides)return {ok:false,reason:'ROOF_COLLISION',cells};
  const supported=sections.some(b=>{
   const t=b._roofBounds;if(!t)return false;
   return t.max[1]===level&&x>=t.min[0]-2&&x<=t.max[0]+1&&z>=t.min[2]-2&&z<=t.max[2]+1;
  });
  if(!supported)return {ok:false,reason:'ROOF_SUPPORT_REQUIRED',cells};
 }
 for(const roof of roofs)if(roof.level===level){
  const existing=new Set((roof.cells||[]).map(p=>p.join(':')));
  if(cells.some(p=>existing.has(p.join(':'))))return {ok:false,reason:'ROOF_OVERLAP',cells};
 }
 return {ok:true,reason:'',cells};
}
