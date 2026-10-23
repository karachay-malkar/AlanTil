/**
 * Run-time geometry for densely terraced Kunlum quarters, 17.2.11.
 * Every lower flat roof belongs to a downhill house and forms the
 * front courtyard/terrace of its uphill neighbour where both survive.
 * All stone polygons go to ONE caller-owned BufferGeometry batch.
 *
 * Historical accuracy: illustrative outlines traced by eye from supplied plan.
 */
import {getKunlumSiteLayout} from './kunlum-site-plan.js?v=17.2.11';

export function createKunlumSettlement({quad,tri,groundY,rnd,stone,mobile=false,layout=getKunlumSiteLayout()}){
 const {parcels,paths,pairs,plan}=layout;
 const stats={houseContours:parcels.length,roofCourtyards:0,sharedEdges:0,
  walls:0,stones:0,terracedPlatforms:0,lanes:paths.length,roofToUpperLinks:0};
 const byId=new Map(parcels.map(p=>[p.id,p]));
 const pairMap=new Map(pairs.map(q=>[q.lower,q]));
 const nextFromLower=new Map();
 for(const p of pairs){const list=nextFromLower.get(p.upper)||[];list.push(p.lower);nextFromLower.set(p.upper,list);}
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const pick=(a,b)=>a+(b-a)*rnd();
 const terrainBase=p=>groundY(p.centerX,p.z0+.2);
 const floorLevel=new Map(parcels.map(p=>[p.id,terrainBase(p)]));
 const reserve=plan.reserve;
 const isReserved=(x,z)=>x>=reserve.x[0]&&x<=reserve.x[1]&&
   z>=reserve.z[0]&&z<=reserve.z[1];
 const zRows=new Map();
 for(const p of parcels){const row=zRows.get(p.row)||[];row.push(p);zRows.set(p.row,row);}
 // Ground sampler flattens actual house footprints, leaving the entire future
 // building reserve untouched. Stone courtyard platform polygons add precision
 // between vertices of the coarse landscape mesh.
 function heightAt(x,z){
  if(isReserved(x,z))return groundY(x,z);
  const natural=groundY(x,z);
  for(const ps of zRows.values()){
   if(!ps.length||z<ps[0].z0||z>=ps[0].z1)continue;
   for(const p of ps){
    if(x<p.x0||x>=p.x1)continue;
    const f=Math.min(x-p.x0,p.x1-x,z-p.z0,p.z1-z);
    const weight=clamp(f/.8,0,1);
    const fade=weight*weight*(3-2*weight);
    return natural*(1-fade)+floorLevel.get(p.id)*fade;
   }
  }
  return natural;
 }
 const tint=['#9e9a85','#b1a590','#a39783','#beb39c','#958c7d'];
 function wall(ax,az,bx,bz,baseY,height,{door=false,damage=.25,retain=false}={}){
  const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);if(len<.12||height<.1)return;
  const nx=-dz/len,nz=dx/len,thick=retain?.52:.48;
  const near=Math.hypot((ax+bx)*.5-10,(az+bz)*.5-10)<(mobile?42:74);
  const rowH=near?(mobile?.39:.32):(mobile?.63:.52);
  const rows=Math.max(1,Math.ceil(height/rowH));
  const blockLength=near?(mobile?.90:.73):(mobile?1.95:1.35);
  const at=(u,y,depth)=>[ax+dx*u+nx*depth,y,az+dz*u+nz*depth];
  const gapLo=.43,gapHi=.57;
  for(let row=0;row<rows;row++){
   const lower=baseY+row*rowH,upper=Math.min(baseY+height,lower+rowH);
   let u=row%2?-.15*blockLength/len:0;
   while(u<1){
    const wide=pick(blockLength*.84,blockLength*1.29);
    const lo=Math.max(0,u),hi=Math.min(1,u+wide/len);
    u+=wide/len;
    if(hi-lo<.007)continue;
    const mid=(lo+hi)*.5;
    if(door&&mid>gapLo&&mid<gapHi&&row*rowH<1.68)continue;
    if(row>rows-3&&rnd()<(retain?.07:damage)*(row===rows-1?1.8:.55))continue;
    const h=(row===rows-1&&rnd()<damage*.6)?pick(.12,.85)*(upper-lower):upper-lower;
    const a=at(lo,lower,thick),b=at(hi,lower,thick),
      c=at(hi,lower+h,thick),d=at(lo,lower+h,thick);
    const e=at(lo,lower,-thick),f=at(hi,lower,-thick),
      g=at(hi,lower+h,-thick),j=at(lo,lower+h,-thick);
    const tone=stone();
    if(near&&!mobile){
     const shift=pick(.008,.045);
     const m=at((lo+hi)*.5,lower+h*.48,thick+shift);
     tri('stone',a,b,m,tone);tri('stone',b,c,m,stone());
     tri('stone',c,d,m,tone);tri('stone',d,a,m,stone());
    }else{quad('stone',a,b,c,d,tone);}
    quad('stone',f,e,j,g,stone());
    quad('stone',d,c,g,j,tone);
    if(row===0||retain)quad('stone',a,e,f,b,stone());
    // End faces remain closed even when a wall has a broken top.
    quad('stone',e,a,d,j,tone);
    quad('stone',b,f,g,c,tone);
    stats.stones++;
   }
  }
  stats.walls++;
 }
 function flatTop(p,y,kind='earth'){
  const eps=.027;
  const hue=kind==='earth'?'#89916c':'#a8a18a';
  quad(kind,[p.x0,y+eps,p.z0],[p.x1,y+eps,p.z0],
    [p.x1,y+eps,p.z1],[p.x0,y+eps,p.z1],hue);
 }
 for(const p of parcels){
  const floor=floorLevel.get(p.id);
  const link=pairMap.get(p.id);
  const upper=link?byId.get(link.upper):null;
  // Slope determines storey height; the roof coincides with upper floor.
  const future=upper?groundY(p.centerX,p.z1+.2):null;
  const difference=future===null?0:future-floor;
  const canSupport=difference>1.85&&difference<5.25;
  const roofed=p.hasRoof&&canSupport;
  const wallH=roofed?difference:
    (canSupport?clamp(difference*.48,1.05,2.35):1.02+(p.ruinType%5)*.24);
  flatTop(p,floor);
  const door=(p.ruinType%4===0);
  wall(p.x0,p.z0,p.x1,p.z0,floor,wallH,{door,damage:roofed?.03:.23});
  // Common partition wall between adjacent houses, never two overlapping ones.
  wall(p.x0,p.z0,p.x0,p.z1,floor,wallH*.92,{damage:roofed?.03:.3});
  const other=parcels.some(q=>q.row===p.row&&Math.abs(q.x0-p.x1)<.12&&
    Math.abs(q.z0-p.z0)<.01);
  if(other)stats.sharedEdges++;
  else wall(p.x1,p.z0,p.x1,p.z1,floor,wallH*.87,{damage:.24});
  // The downhill roof is a true level courtyard slab, level with the next
  // household's access, not an isolated roof floating above the village.
  if(roofed){
   flatTop(p,future,'path');
   stats.roofCourtyards++;
   stats.roofToUpperLinks++;
   // Low parapet on the downhill edge, as seen in VT captures.
   wall(p.x0,p.z0,p.x1,p.z0,future,.48,{damage:.14,retain:true});
  }else if(p.ruinType%3===1){
   // Partial surviving uphill house rear wall.
   wall(p.x0,p.z1,p.x1,p.z1,floor,.70,{damage:.35});
  }
  stats.terracedPlatforms++;
 }
 // Stone retaining walls follow each entire contour strip rather than every
 // discrete house wall; a roof remains embedded into the terrace behind it.
 for(const tier of layout.terraces){
  const z=tier.z1,mid=(tier.x0+tier.x1)*.5;
  if(isReserved(mid,z))continue;
  const top=groundY(mid,z+.20),low=groundY(mid,tier.z0+.2);
  const diff=Math.max(.42,Math.min(2.35,(top-low)*.6));
  // Subdivide around narrow alleys and the reserved plot.
  for(let x=tier.x0;x<tier.x1;x+=11){
   const end=Math.min(tier.x1,x+10.3);
   const cx=(x+end)*.5;
   if(isReserved(cx,z)||Math.abs(end-x)<3)continue;
   wall(x,z,end,z,top-diff,diff,{retain:true,damage:.22});
  }
 }
 // Narrow stone-lined paths running uphill between house groups.
 for(const path of paths){
  for(let i=1;i<path.points.length;i++){
   const [x0,z0]=path.points[i-1],[x1,z1]=path.points[i];
   const dx=x1-x0,dz=z1-z0,len=Math.hypot(dx,dz);
   if(!len)continue;
   const nx=-dz/len*path.width*.5,nz=dx/len*path.width*.5;
   const a=[x0-nx,groundY(x0-nx,z0-nz)+.095,z0-nz],
    b=[x1-nx,groundY(x1-nx,z1-nz)+.095,z1-nz],
    c=[x1+nx,groundY(x1+nx,z1+nz)+.095,z1+nz],
    d=[x0+nx,groundY(x0+nx,z0+nz)+.095,z0+nz];
   quad('path',a,b,c,d,'#aa9b7b');
  }
 }
 return {stats,heightAt,layout};
}
