/** Geometry shared by surface-fitted rock offcuts and hidden 3D mortar.
 * At the 3x3x3 physical sample scale, disjoint stone/mortar microcells have
 * explicit solid volumes; no full-cell occupancy or 2D mortar receives credit.
 * Authored small stones remain the primary visible rubble. Their cut-to-fit
 * stone offcuts occupy remaining tiny fissures in the exterior 20% guards.
 */
export function buildCoreMortar(g,stoneSamples,{isSolidAt=null,maxTriangles=30000,subdivisions=3,rockPalette=null,rockContours=null,rockMeshes=null}={}){
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
  const type=interior(p)?2:1;
  material[x+n[0]*y+stride*z]=type;
  if(type===1)rockCells++;else {mortarCells++;mortarCandidates.push(x+n[0]*y+stride*z);}
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
 const palette=rockPalette?.length?rockPalette:[[.29,.27,.23],[.34,.31,.27],[.37,.34,.29]];
 // Reuse vertices from the seven original irregular stones to break up the
 // artificial right-angled silhouette of cut-to-fit outer micro-stones.
 // Adjacent faces receive identical displaced world-space junctions.
 const rockVertex=(p)=>{
  if(!rockContours?.length)return p;
  const q=p.map((v,i)=>Math.round((v-min[i])/delta[i]));
  for(const da of [-1,0])for(const db of [-1,0])for(const dc of [-1,0]){
   const at=[q[0]+da,q[1]+db,q[2]+dc];
   if(at.some((v,i)=>v<0||v>=n[i]))continue;
   if(material[at[0]+n[0]*at[1]+stride*at[2]]===2)return p;
  }
  const h=hash(q[0]*71+q[1]*211+q[2]*509);
  const shape=rockContours[h%rockContours.length],count=Math.floor(shape.length/3);
  if(!count)return p;
  const vid=((h>>>7)%count)*3;
  const movement=.31*Math.min(...delta);
  return p.map((v,i)=>Math.min(min[i]+dims[i]*g.dimension[i],Math.max(min[i],v+shape[vid+i]*movement)));
 };
 function meshMaterial(type,triangleBudget){
  const positions=[],colors=[],quads=[];let faces=0;
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
     const corners=[point(0,0),point(run,0),point(run,ht),point(0,ht)]
      .map(p=>type===1?rockVertex(p):p);
     const facing=(axis===1?-1:1)===side;
     const order=facing?[0,1,2,0,2,3]:[0,2,1,0,3,2];
     const color=type===2?[.095,.091,.082]:palette[(Math.abs((x+1)*17+(y+1)*31+(slice+1)*47+axis*7))%palette.length];
     for(const i of order){positions.push(...corners[i]);colors.push(...color);}
     if(type===1&&((slice===0&&side===-1)||(slice===n[axis]-1&&side===1)))quads.push({axis,side,slice,u,v,x,y,run,ht});
     faces++;
    }
   }
  }
  return {positions,colors,faces,quads,truncated:false};
 }
 // Prioritise the visible stone offcuts over hidden mortar in a tight budget.
 const rock=meshMaterial(1,maxTriangles);
 if(rock.truncated)return {...empty,truncated:true};
 const mortar=meshMaterial(2,Math.max(0,maxTriangles-rock.faces*2));
 if(mortar.truncated)return {...empty,wedgePositions:rock.positions,wedgeColors:rock.colors,
  wedgeVolume:rockCells*unitVolume,faces:rock.faces,truncated:true};
 // A bounded number of actual small-source meshes forms the outer skin of
 // cut-to-fit stone cores. This replaces exposed flat patches without adding
 // fake occupancy credit; their solid cores are already counted in the union.
 const available=Math.max(0,Math.min(210,Math.floor((maxTriangles-(rock.faces+mortar.faces)*2)*.23)));
 let addedTriangles=0,authoredFaces=0;
 if(rockMeshes?.length&&available>30){
  const sides=rock.quads.sort((a,b)=>b.run*b.ht-a.run*a.ht||a.axis-b.axis);
  for(const q of sides){
   const source=rockMeshes[hash(q.x*19+q.y*47+q.slice*101+q.axis*307+q.side*43)%rockMeshes.length];
   if(!source?.indices?.length||!source.positions?.length)continue;
   const count=source.indices.length/3;
   if(addedTriangles+count>available)continue;
   const width=Math.min(.6,q.run*delta[q.u]),height=Math.min(.6,q.ht*delta[q.v]);
   if(Math.min(width,height)<.035)continue;
   const thick=Math.min(.13,Math.min(width,height)*.55);
   const patch=[0,0,0];
   patch[q.axis]=min[q.axis]+(q.slice+(q.side>0?1:0))*delta[q.axis]-q.side*thick*.11;
   patch[q.u]=min[q.u]+(q.x+q.run/2)*delta[q.u];
   patch[q.v]=min[q.v]+(q.y+q.ht/2)*delta[q.v];
   const orientation=(q.axis===1?-1:1)*q.side;
   const toPoint=vertex=>{
    const src=vertex*3,world=patch.slice();
    world[q.u]+=source.positions[src]*width*1.06;
    world[q.v]+=source.positions[src+1]*height*1.06;
    world[q.axis]+=source.positions[src+2]*thick*q.side;
    return world;
   };
   const linearColor=i=>{
    const c=source.colors[i]??.5;
    return Math.max(.02,Math.min(.9,c<=.04045?c/12.92:((c+.055)/1.055)**2.4));
   };
   for(let k=0;k<source.indices.length;k+=3){
    const ids=[source.indices[k],source.indices[k+1],source.indices[k+2]];
    if(orientation<0)[ids[1],ids[2]]=[ids[2],ids[1]];
    for(const id of ids){
     rock.positions.push(...toPoint(id));
     for(let c=0;c<3;c++)rock.colors.push(linearColor(id*3+c));
    }
   }
   addedTriangles+=count;authoredFaces++;
  }
 }
 return {
  positions:mortar.positions,colors:mortar.colors,volume:mortarCells*unitVolume,
  wedgePositions:rock.positions,wedgeColors:rock.colors,wedgeVolume:rockCells*unitVolume,
  forbiddenVolume:0,penetrationVolume:0,faces:rock.faces+mortar.faces+Math.ceil(addedTriangles/2),authoredFaces,truncated:false,
 };
}
