/**
 * Reference-led interpretation of stone ruins in Kyunlyum (Upper Balkaria).
 * Geometry, not screenshots: dense groups of ruined house walls and slope terraces.
 * Historic source: https://kunlum.ru/gallery and https://kunlum.ru/images/kunlum-map.jpg
 * The map image is not georeferenced; coordinates below are artistic, not cadastral.
 * Every face is combined into the caller's single THREE.BufferGeometry batch.
 */
export function createKunlumRuins({quad,tri,groundY,rnd,stone,mobile=false}) {
 const stats={courtyards:0,terraces:0,wallSegments:0,stoneBlocks:0,paths:0};
 const spread=(a,b)=>a+(b-a)*rnd();
 const wallLine=(ax,az,bx,bz,{height=1.5,thickness=.57,gaps=[],course,damage=.18}={})=>{
  const dx=bx-ax,dz=bz-az,dist=Math.hypot(dx,dz);
  if(dist<.3)return;
  const nx=-dz/dist,nz=dx/dist;
  const midpoint=[(ax+bx)*.5,(az+bz)*.5];
  const viewDist=Math.hypot(midpoint[0]-10,midpoint[1]-10);
  const near=viewDist<75;
  const rowH=course??(mobile?(near?.36:.45):(near?.29:.38));
  const rows=Math.ceil(height/rowH);
  const half=thickness*.5;
  const cube=(u,y,n)=>[ax+dx*u+nx*n,y,az+dz*u+nz*n];
  const foot=(u)=>groundY(ax+dx*u,az+dz*u)-.21;
  function surface(u0,u1,c,h,tone) {
   // Connected rectangular support volumes: visible façade facets can vary,
   // but stones remain contiguous and the wall never becomes transparent.
   const start=foot(u0)+c*rowH,end=foot(u1)+c*rowH;
   const h0=Math.max(.13,Math.min(rowH,h)),h1=h0;
   const a=cube(u0,start,half),b=cube(u1,end,half),
     cc=cube(u1,end+h1,half),d=cube(u0,start+h0,half);
   const e=cube(u0,start,-half),f=cube(u1,end,-half),
     g=cube(u1,end+h1,-half),hh=cube(u0,start+h0,-half);
   const tint=stone();
   // Near desktop stones keep 3D faceting; distant/mobile stones use only
   // two shaded front triangles, reducing GPU upload and startup blocking.
   if(mobile||!near){
    tri('stone',a,b,cc,tone);
    tri('stone',a,cc,d,tint);
   }else{
    const bump=spread(.015,.060);
    const m=cube((u0+u1)*.5,(start+end+h0)*.5,half+bump);
    tri('stone',a,b,m,tone);
    tri('stone',b,cc,m,tint);
    tri('stone',cc,d,m,tone);
    tri('stone',d,a,m,tone);
   }
   // Back, top, ends: real closed masonry. Bottom is hidden except nearby desktop.
   quad('stone',f,e,hh,g,tone);
   if(!mobile&&near)quad('stone',a,e,f,b,tint);
   quad('stone',d,cc,g,hh,tone);
   quad('stone',e,a,d,hh,tone);
   quad('stone',b,f,g,cc,tint);
  }
  const slots=[];
  const gapAt=u=>gaps.some(([a,b])=>u>=a&&u<=b);
  for(let c=0;c<rows;c++){
   let u=0;
   const approximateBlock=mobile?(near?.92:1.4):(near?.68:1.15);
   if(c%2)u=-spread(.1,.43)*approximateBlock/dist;
   while(u<1){
    const width=spread(approximateBlock*.63,approximateBlock*1.43)/dist;
    const u0=Math.max(0,u),u1=Math.min(1,u+width),mid=(u0+u1)*.5;
    u+=width;
    if(u1-u0<.012||gapAt(mid))continue;
    const last=(c>=rows-2);
    const fell=last&&rnd()<damage*(c===rows-1?1.5:.45);
    if(fell)continue;
    // Narrower edge stones: lower courses continuous, top edge fractured.
    const trimmed=last&&rnd()<.32?spread(.14,.73)*rowH:rowH;
    surface(u0,u1,c,trimmed,stone());stats.stoneBlocks++;
   }
  }
  stats.wallSegments++;
 };
 const siteClear=(cx,cz,w,d,rot=0)=>{
  // Conservative circular envelope: no ruin/wall intrudes into the 40x50m reserve.
  const rad=Math.hypot(w,d)*.5+.8;
  return cx-rad>-10&&cx-rad<30&&cz-rad>-15&&cz-rad<35 ||
    cx+rad>-10&&cx+rad<30&&cz+rad>-15&&cz+rad<35 ||
    cx>-10-rad&&cx<30+rad&&cz>-15-rad&&cz<35+rad;
 };
 // Rows of contiguous ruined courtyards, linked by alleys and retaining walls.
 // Axes: Z rises toward Abaev Kala; the Cherek flows lower at approximately Z=-91.
 const parcels=[
  // Upper-quarter and towerside house foundations, staggered on terraces.
  [-60,41,8.5,6.2,1.6,-.11],[-48,42,8,6.8,1.3,.10],[-36,43,7.3,5.9,2.1,-.08],
  [-22,45,7.4,6.2,1.5,.08],[42,43,8.7,6.5,1.6,-.12],[54,44,8.2,7.3,1.9,.09],
  [68,44,8.0,6.4,1.15,-.06],[82,43,6.7,6.3,1.7,.15],
  [-59,57,7.4,6.1,1.1,.08],[-47,59,7.1,6.5,1.75,-.05],[-34,59,8.2,6.0,2.35,.07],
  [-19,60,6.8,7.2,1.55,-.14],[8,55,6.8,6.1,1.3,.03],[22,56,7.0,6.5,1.55,-.09],
  [37,57,8.0,6.8,1.9,.05],[52,57,7.6,6.1,1.4,-.07],[70,58,7.8,6.8,2.0,.12],
  // The highest quarter: a labyrinth of foundations below the tower.
  [-61,74,7.7,6.4,2.35,-.06],[-48,74,6.4,6.7,1.35,.11],
  [-35,78,7.6,7.2,1.4,.08],[-23,81,7.2,6.2,1.75,-.12],
  [16,76,6.7,5.8,1.85,.07],[30,78,7.8,6.4,2.3,-.13],
  [46,76,8.6,6.7,1.5,.11],[62,77,7.2,6.2,1.3,-.04],
  // Side quarters immediately left/right of today's reserved building plateau.
  [-29,19,7.5,6.5,1.55,-.12],[-29,3,7.3,6.9,1.65,.10],
  [-28,-13,7.7,7.1,1.2,-.05],[40,19,8.1,7.2,1.8,.08],
  [49,5,7.1,6.6,1.4,-.12],[48,-12,7.5,7.0,1.5,.04],
  // Downhill households overlooking the Cherek.
  [-47,-31,7.1,6.5,1.15,-.13],[-34,-33,7.2,5.7,1.5,.06],
  [-20,-40,6.5,5.6,1.4,-.10],[40,-34,6.8,5.9,1.4,.14],
  [55,-38,8.3,6.0,1.3,-.07],[68,-40,6.8,5.4,1.1,.13],
  [-56,-54,7.0,6.3,1.3,-.06],[-43,-55,6.7,5.7,1.5,.11],
  [-29,-59,7.3,6.4,1.6,-.08],[41,-56,7.5,6.2,1.4,.10],
  [55,-58,6.8,5.6,1.2,-.09],[72,-61,7.2,6.2,1.3,.07]
 ];
 function courtyard(cx,cz,w,d,h,angle){
  if(siteClear(cx,cz,w,d))return;
  const c=Math.cos(angle),s=Math.sin(angle);
  const local=(x,z)=>[cx+x*c-z*s,cz+x*s+z*c];
  const pts=[local(-w/2,-d/2),local(w/2,-d/2),local(w/2,d/2),local(-w/2,d/2)];
  const mainDoor=1+Math.floor(rnd()*2);
  const outline=Math.floor(rnd()*4);
  for(let k=0;k<4;k++){
   // Larger broken-up gaps and a door-sized passage, plus irregular parapet.
   const gaps=k===mainDoor?[[.38,.63]]:k===outline?[[.17,.28],[.75,.82]]:rnd()<.35?[[.48,.61]]:[];
   const wallH=h*(k===outline?spread(.50,.90):spread(.74,1.34));
   wallLine(...pts[k],...pts[(k+1)%4],{height:wallH,gaps,damage:spread(.13,.35)});
  }
  // Historic quarters are not pristine rectangles: interior room partitions and steps.
  if(rnd()<.85){
   const a=local(-w*.43,(rnd()-.5)*d*.55),b=local(w*.18,(rnd()-.5)*d*.55);
   wallLine(...a,...b,{height:h*spread(.5,.87),damage:.36,gaps:[]});
  }
  if(rnd()<.52){
   const a=local((rnd()-.5)*w*.4,-d*.42),b=local((rnd()-.5)*w*.4,d*.15);
   wallLine(...a,...b,{height:h*.65,damage:.45});
  }
  // Tumbled stones scattered beside the walls without floating or deep gaps.
  const n=mobile?4:9;
  for(let j=0;j<n;j++){
   const x=cx+spread(-w*.65,w*.65),z=cz+spread(-d*.65,d*.65);
   const foot=groundY(x,z)-.1;
   const half=spread(.11,.35),tint=stone();
   const a=[x-half,foot,z-half],b=[x+half,foot,z-half],
    c1=[x+half,foot,z+half],d1=[x-half,foot,z+half],
    top=[x+spread(-.1,.1),foot+spread(.12,.4),z+spread(-.1,.1)];
   tri('stone',a,b,top,tint);tri('stone',b,c1,top,tint);
   tri('stone',c1,d1,top,tint);tri('stone',d1,a,top,tint);
  }
  stats.courtyards++;
 }
 for(const item of parcels)courtyard(...item);
 // Continuously stepped retaining walls; many long multi-tier runs like the actual ruins.
 const bands=[
  [-74,35,-14,37,1.05], [31,35,100,35,1.10],
  [-78,51,-16,52,1.7], [31,50,104,50,1.45],
  [-83,69,-18,71,1.85], [17,68,107,69,1.4],
  [-81,89,-22,90,1.35], [3,90,89,91,1.6],
  [-66,21,-17,22,.95],[33,23,83,24,1.0],
  [-66,4,-17,5,.95],[34,3,87,4,1.2],
  [-62,-24,-16,-25,1.05],[32,-25,87,-27,1.0],
  [-70,-46,-15,-48,1.0],[32,-46,91,-48,.95],
  [-71,-68,-16,-68,.9],[34,-66,97,-69,.86]
 ];
 for(const [x,z,xx,zz,h] of bands){
  const central=Math.hypot((x+xx)*.5-10,(z+zz)*.5-10);
  if(central<24)continue;
  wallLine(x,z,xx,zz,{height:h,damage:.24,gaps:[[.28,.31],[.73,.77]]});
  stats.terraces++;
 }
 // Pieces of enclosed narrow stone-lined alleys; no straight rectangular grid.
 const lanes=[
  [[-67,27],[-62,40],[-62,54],[-65,70]],
  [[-14,37],[-12,47],[-8,53],[-4,61]],
  [[29,36],[32,46],[29,59],[26,67]],
  [[92,33],[91,49],[88,66],[83,83]],
  [[-17,-67],[-12,-57],[-7,-47],[-4,-33]],
  [[31,-69],[29,-57],[29,-43],[30,-28]]
 ];
 for(const lane of lanes){
  for(let j=0;j<lane.length-1;j++){
   const a=lane[j],b=lane[j+1];
   if(Math.hypot((a[0]+b[0])*.5-10,(a[1]+b[1])*.5-10)<23)continue;
   const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),
    nx=-dz/l*.95,nz=dx/l*.95;
   wallLine(a[0]-nx,a[1]-nz,b[0]-nx,b[1]-nz,{height:spread(.42,.95),damage:.32});
   wallLine(a[0]+nx,a[1]+nz,b[0]+nx,b[1]+nz,{height:spread(.42,1.05),damage:.35});
  }
  stats.paths++;
 }
 return {wallLine,stats};
}
