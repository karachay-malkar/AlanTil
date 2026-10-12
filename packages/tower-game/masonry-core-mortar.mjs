/** Geometry shared by surface-fitted rock offcuts and hidden 3D mortar.
 * At the 3x3x3 physical sample scale, disjoint stone/mortar microcells have
 * explicit solid volumes; no full-cell occupancy or 2D mortar receives credit.
 * Authored small stones remain the primary visible rubble. Their cut-to-fit
 * stone offcuts occupy remaining tiny fissures in the exterior 20% guards.
 */
export function buildCoreMortar(g,stoneSamples,{isSolidAt=null,maxTriangles=30000,subdivisions=3,rockPalette=null}={}){
 const dims=[g.nx,g.ny,g.nz],n=dims.map(v=>v*subdivisions),stride=n[0]*n[1];
 const min=g.min,delta=g.dimension.map(d=>d/subdivisions),unitVolume=delta[0]*delta[1]*delta[2];
 const empty={positions:[],colors:[],volume:0,wedgePositions:[],wedgeColors:[],
   wedgeVolume:0,forbiddenVolume:0,penetrationVolume:0,faces:0,truncated:false};
 if(!Number.isInteger(g.seamAxis)||g.seamAxis<0||g.seamAxis>2)return empty;
 const exterior=g.exteriorFaces||[0,1,2].filter(a=>a!==g.seamAxis).flatMap(a=>[[a,0],[a,1]]);
 const material=new Uint8Array(n[0]*n[1]*n[2]);let rockCells=0,mortarCells=0;
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
  if(stoneSamples[sub])continue;
  const p=[x,y,z].map((v,k)=>min[k]+(v+.5)*delta[k]);
  if(isSolidAt?.(p))continue;
  const type=interior(p)?2:1;
  material[x+n[0]*y+stride*z]=type;
  if(type===1)rockCells++;else mortarCells++;
 }
 if(!rockCells&&!mortarCells)return empty;
 const orientations=[[1,2],[0,2],[0,1]];
 const palette=rockPalette?.length?rockPalette:[[.29,.27,.23],[.34,.31,.27],[.37,.34,.29]];
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
     const color=type===2?[.095,.091,.082]:palette[(Math.abs((x+1)*17+(y+1)*31+(slice+1)*47+axis*7))%palette.length];
     for(const i of order){positions.push(...corners[i]);colors.push(...color);}
     faces++;
    }
   }
  }
  return {positions,colors,faces,truncated:false};
 }
 // Prioritise the visible stone offcuts over hidden mortar in a tight budget.
 const rock=meshMaterial(1,maxTriangles);
 if(rock.truncated)return {...empty,truncated:true};
 const mortar=meshMaterial(2,Math.max(0,maxTriangles-rock.faces*2));
 if(mortar.truncated)return {...empty,wedgePositions:rock.positions,wedgeColors:rock.colors,
  wedgeVolume:rockCells*unitVolume,faces:rock.faces,truncated:true};
 return {
  positions:mortar.positions,colors:mortar.colors,volume:mortarCells*unitVolume,
  wedgePositions:rock.positions,wedgeColors:rock.colors,wedgeVolume:rockCells*unitVolume,
  forbiddenVolume:0,penetrationVolume:0,faces:rock.faces+mortar.faces,truncated:false,
 };
}
