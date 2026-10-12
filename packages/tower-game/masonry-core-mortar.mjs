/** Closed, volumetric inner-joint mortar, discretized consistently with the
 * 3x3x3 physical stone occupancy samples. There is NO surface-only volume.
 * Exterior guard bands are a hard geometrical exclusion, not a color trick.
 */
export function buildCoreMortar(grid, stoneSamples, {isSolidAt=null, maxTriangles=30000, subdivisions=3}={}) {
 const g=grid, nx=g.nx,ny=g.ny,nz=g.nz, extent=[nx,ny,nz],n=extent.map(v=>v*subdivisions);
 const stride=n[0]*n[1],size=stride*n[2],voxels=new Uint8Array(size);
 const zero={positions:[],colors:[],volume:0,forbiddenVolume:0,penetrationVolume:0,faces:0,truncated:false};
 if(!Number.isInteger(g.seamAxis)||g.seamAxis<0||g.seamAxis>2)return zero;
 const exterior=g.exteriorFaces||[0,1,2].filter(a=>a!==g.seamAxis).flatMap(a=>[[a,0],[a,1]]);
 const dimensions=g.dimension.map(d=>d/subdivisions), min=g.min,volume=dimensions[0]*dimensions[1]*dimensions[2];
 const guard=(p,half=false)=>{
  for(const [axis,side] of exterior){
   const length=extent[axis]*g.dimension[axis],start=min[axis];
   const nearest=side===0?p[axis]-start:start+length-p[axis];
   // Check entire physical subvoxel, not only its center. The outermost
   // boundary must remain a genuine stone-only 20% by depth.
   if(nearest-(half?dimensions[axis]/2:0)<length*.20-1e-8)return false;
  }
  return true;
 };
 let count=0;
 for(let z=0;z<n[2];z++)for(let y=0;y<n[1];y++)for(let x=0;x<n[0];x++){
  const coarseX=Math.floor(x/subdivisions),coarseY=Math.floor(y/subdivisions),coarseZ=Math.floor(z/subdivisions);
  const coarse=coarseX+nx*coarseY+nx*ny*coarseZ;
  if(!g.mask[coarse])continue;
  const sample=coarse*subdivisions**3+(x%subdivisions)+subdivisions*(y%subdivisions)+subdivisions**2*(z%subdivisions);
  if(stoneSamples[sample])continue;
  const p=[x,y,z].map((c,a)=>min[a]+(c+.5)*dimensions[a]);
  if(!guard(p,true)||isSolidAt?.(p))continue;
  voxels[x+n[0]*y+stride*z]=1;count++;
 }
 if(!count)return zero;
 // Greedy surface meshing: each exterior face of the union appears exactly
 // once; adjacent solid subvoxels have NO internal triangles. Axis winding
 // yields outward normals on all six faces.
 const pos=[],cols=[],uv=[ [1,2],[0,2],[0,1] ];
 let faces=0;
 const solid=(p)=>p.every((v,i)=>v>=0&&v<n[i])&&Boolean(voxels[p[0]+n[0]*p[1]+stride*p[2]]);
 function quad(axis,side,slice,a0,b0,aLen,bLen) {
  const [u,v]=uv[axis],base=[0,0,0];
  base[axis]=slice+(side===1?1:0);base[u]=a0;base[v]=b0;
  const vertex=(a,b)=>base.map((value,i)=>min[i]+(value+(i===u?a:i===v?b:0))*dimensions[i]);
  const q=[vertex(0,0),vertex(aLen,0),vertex(aLen,bLen),vertex(0,bLen)];
  const forward=(axis===1?-1:1)===(side===1?1:-1);
  const order=forward?[0,1,2,0,2,3]:[0,2,1,0,3,2];
  for(const i of order){pos.push(...q[i]);cols.push(.095,.091,.082);}
  faces++;
 }
 for(let axis=0;axis<3;axis++)for(const side of [-1,1]){
  const [u,v]=uv[axis],w=n[u],h=n[v];
  for(let slice=0;slice<n[axis];slice++){
   const mask=new Uint8Array(w*h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=[0,0,0];p[axis]=slice;p[u]=x;p[v]=y;
    if(!solid(p))continue;
    p[axis]+=side;
    if(!solid(p))mask[y*w+x]=1;
   }
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){
    let run=1;while(x+run<w&&mask[y*w+x+run])run++;
    let height=1,ok=true;
    while(ok&&y+height<h){
     for(let j=0;j<run;j++)if(!mask[(y+height)*w+x+j]){ok=false;break;}
     if(ok)height++;
    }
    for(let yy=y;yy<y+height;yy++)for(let xx=x;xx<x+run;xx++)mask[yy*w+xx]=0;
    if(faces*2+2>maxTriangles)return {...zero,truncated:true};
    quad(axis,side,slice,x,y,run,height);
   }
  }
 }
 return {positions:pos,colors:cols,volume:count*volume,forbiddenVolume:0,penetrationVolume:0,faces,truncated:false};
}
