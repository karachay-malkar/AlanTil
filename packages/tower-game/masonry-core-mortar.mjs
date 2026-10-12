/** Closed volumetric MORTAR ONLY, confined to the inner 60% of each seam.
 * External rubble consists exclusively of placed authored source stone meshes.
 * No voxel-generated stone, synthetic rock caps, or decorative rock facades.
 */
export function buildCoreMortar(g,stoneSamples,{isSolidAt=null,maxTriangles=30000,subdivisions=3}={}){
 const dims=[g.nx,g.ny,g.nz],n=dims.map(v=>v*subdivisions),stride=n[0]*n[1];
 const min=g.min,delta=g.dimension.map(d=>d/subdivisions),unitVolume=delta[0]*delta[1]*delta[2];
 const empty={positions:[],colors:[],volume:0,wedgePositions:[],wedgeColors:[],
   wedgeVolume:0,forbiddenVolume:0,penetrationVolume:0,faces:0,truncated:false};
 if(!Number.isInteger(g.seamAxis)||g.seamAxis<0||g.seamAxis>2)return empty;
 const exterior=g.exteriorFaces||[0,1,2].filter(a=>a!==g.seamAxis).flatMap(a=>[[a,0],[a,1]]);
 const material=new Uint8Array(n[0]*n[1]*n[2]);let rockCells=0,mortarCells=0,freeCount=0,authoredCount=0;
 const mortarCandidates=[];
 const interior=p=>{
  for(const [axis,side]of exterior){
   const size=dims[axis]*g.dimension[axis],bound=min[axis]+(side?size:0);
   const inward=side?bound-p[axis]:p[axis]-bound;
   if(inward-delta[axis]/2<size*.20-1e-8)return false;
  }
  return true;
 };
 for(let z=0;z<n[2];z++)for(let y=0;y<n[1];y++)for(let x=0;x<n[0];x++){
  const xx=Math.floor(x/subdivisions),yy=Math.floor(y/subdivisions),zz=Math.floor(z/subdivisions);
  const coarse=xx+g.nx*yy+g.stride*zz;
  if(!g.mask[coarse])continue;
  const sub=coarse*subdivisions**3+x%subdivisions+subdivisions*(y%subdivisions)+subdivisions*subdivisions*(z%subdivisions);
  if(stoneSamples[sub]){authoredCount++;continue;}
  const p=[x,y,z].map((v,k)=>min[k]+(v+.5)*delta[k]);
  if(isSolidAt?.(p))continue;
  freeCount++;
  if(!interior(p))continue; // exterior 20% stays empty until real pebbles fit
  material[x+n[0]*y+stride*z]=2;
  mortarCells++;mortarCandidates.push(x+n[0]*y+stride*z);
 }
 if(!rockCells&&!mortarCells)return empty;
 // Retain real 5–10% microcavities inside the central core, never in the
 // exterior stone-only guards. No face is generated for an empty microcell.
 const total=authoredCount+freeCount,desiredOccupied=Math.round(total*.935);
 const deleteCount=Math.min(mortarCandidates.length,Math.max(0,authoredCount+rockCells+mortarCells-desiredOccupied));
 const hash=id=>{
  let h=Math.imul(id+0x9e3779b9,0x85ebca6b);
  h=Math.imul(h^(h>>>13),0xc2b2ae35);return (h^(h>>>16))>>>0;
 };
 const cluster=id=>{
  const z=Math.floor(id/stride),y=Math.floor((id-z*stride)/n[0]),x=id%n[0];
  const cx=Math.floor(x/4),cy=Math.floor(y/4),cz=Math.floor(z/4);
  return hash(cx+503*cy+65537*cz);
 };
 mortarCandidates.sort((a,b)=>cluster(a)-cluster(b)||a-b);
 for(let j=0;j<deleteCount;j++)material[mortarCandidates[j]]=0;
 mortarCells-=deleteCount;
 const orientations=[[1,2],[0,2],[0,1]];
 function meshMaterial(type,triangleBudget){
  const positions=[],colors=[];let faces=0;
  const index=p=>p[0]+n[0]*p[1]+stride*p[2];
  const value=p=>p.every((a,k)=>a>=0&&a<n[k])?material[index(p)]:0;
  for(let axis=0;axis<3;axis++)for(const side of [-1,1]){
   const [u,v]=orientations[axis],w=n[u],h=n[v];
   for(let slice=0;slice<n[axis];slice++){
    const visible=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
     const p=[0,0,0];p[axis]=slice;p[u]=x;p[v]=y;
     if(value(p)!==type)continue;
     p[axis]+=side;
     if(value(p)!==type)visible[y*w+x]=1;
    }
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(visible[y*w+x]){
     const maxSpan=triangleBudget<8000?256:6;
     let run=1;while(run<maxSpan&&x+run<w&&visible[y*w+x+run])run++;
     let ht=1,ok=true;
     while(ok&&ht<maxSpan&&y+ht<h){
      for(let j=0;j<run;j++)if(!visible[(y+ht)*w+x+j]){ok=false;break;}
      if(ok)ht++;
     }
     for(let yy=y;yy<y+ht;yy++)for(let xx=x;xx<x+run;xx++)visible[yy*w+xx]=0;
     if((faces+1)*2>triangleBudget)return {positions:[],colors:[],faces:0,truncated:true};
     const base=[0,0,0];base[axis]=slice+(side>0?1:0);base[u]=x;base[v]=y;
     const point=(a,b)=>base.map((c,i)=>min[i]+(c+(i===u?a:i===v?b:0))*delta[i]);
     const corners=[point(0,0),point(run,0),point(run,ht),point(0,ht)];
     const facing=(axis===1?-1:1)===side;
     const order=facing?[0,1,2,0,2,3]:[0,2,1,0,3,2];
     const color=[.095,.091,.082];
     for(const i of order){positions.push(...corners[i]);colors.push(...color);}
     faces++;
    }
   }
  }
  return {positions,colors,faces,truncated:false};
 }
 // No outer rock mesh is ever generated here. Only the original seven
 // pebbles, placed by fillAuthoredCavity, can be displayed as rubble.
 const mortar=meshMaterial(2,maxTriangles);
 if(mortar.truncated)return {...empty,truncated:true};
 return {
  positions:mortar.positions,colors:mortar.colors,volume:mortarCells*unitVolume,
  wedgePositions:[],wedgeColors:[],wedgeVolume:0,
  forbiddenVolume:0,penetrationVolume:0,faces:mortar.faces,authoredFaces:0,truncated:false,
 };
}
