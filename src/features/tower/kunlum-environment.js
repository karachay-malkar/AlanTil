/**
 * Kunlum hillside environment for AlanTil tower editor.
 * Historical landmark arrangement is illustrative until a surveyed site-plan is available.
 * Local +Z is uphill toward Abaev Kala; -Z descends to Cherek and the opposite bank.
 * Decorative meshes are deliberately not registered in the tower's placement raycaster.
 */
import {createKunlumSettlement} from './kunlum-settlement.js?v=17.2.11';

export function createKunlumEnvironment(THREE, scene, {mobile=false}={}) {
 const group=new THREE.Group();group.name='Кюнлюм · склон, руины и Черек';
 scene.add(group);
 const ownedMaterials=[], ownedGeometries=[];
 let disposed=false,backdropTexture=null;
 const rnd=(()=>{let n=0x4b1a27;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);})();
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
 // Reuse RGB objects for the many triangular facets of the wild-stone walls.
 const colorCache=new Map();
 const rgba=c=>{let value=colorCache.get(c);if(!value){value=new THREE.Color(c);colorCache.set(c,value);}return value;};
 const colors={wall:['#a89f8a','#b9ad96','#928b7c','#c0b39c','#9c9486','#aba18d'],
   grass:['#758961','#84916a','#8d9a70','#a1a277','#788766','#b2ac78'],soil:'#968872'};
 function mat(color,vertexColors=false,other={}) {
  const m=new THREE.MeshLambertMaterial({color,vertexColors,side:THREE.DoubleSide,...other});
  ownedMaterials.push(m);return m;
 }
 const batch={stone:{v:[],c:[]},earth:{v:[],c:[]},water:{v:[],c:[]},path:{v:[],c:[]}};
 function tri(kind,a,b,c,color){
  const dst=batch[kind],col=rgba(color);
  for(const p of [a,b,c]){dst.v.push(...p);dst.c.push(col.r,col.g,col.b);}
 }
 function quad(kind,a,b,c,d,color){tri(kind,a,b,c,color);tri(kind,a,c,d,color);}
 function prism(kind,x0,y0,z0,x1,y1,z1,color){
  const a=[x0,y0,z0],b=[x1,y0,z0],c=[x1,y1,z0],d=[x0,y1,z0],
   e=[x0,y0,z1],f=[x1,y0,z1],g=[x1,y1,z1],h=[x0,y1,z1];
  for(const q of [[a,b,c,d],[f,e,h,g],[e,a,d,h],[b,f,g,c],[d,c,g,h],[e,f,b,a]])quad(kind,...q,color);
 }
 function emit(kind,name){
  const data=batch[kind];if(!data.v.length)return;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(data.v,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(data.c,3));geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mat('#ffffff',true));mesh.name=name;
  // Batches cover distant separate objects; a coarse merged bounding sphere is adequate.
  group.add(mesh);ownedGeometries.push(geo);
 }
 // Playable terrace and its full reserve remain level. Cherek lies gently downhill.
 // The 1 km plain opposite is visual: nearby 3D land to ~350 m, then a panoramic image.
 const riverCenter=x=>-91+4.7*Math.sin((x+16)*.028);
 function groundY(x,z) {
  // Preserve the flat 40x50m reserve and the 20x20m build area.
  // Beyond the reserve, restore 17.2.8's pronounced upper village hillside.
  const uphill=Math.max(0,z-35);
  const downhill=Math.max(0,-15-z);
  const side=Math.max(0,Math.abs(x-10)-20);
  // Rises gently out of the construction terrace then returns to the older
  // hillside gradient and original-scale rocky relief under Abaev Kala.
  const villageRise=.47*(uphill-3*(1-Math.exp(-uphill/3)));
  const amplitude=smooth(Math.max(uphill,downhill,side)/13);
  const originalRelief=amplitude*(1.45*Math.sin(x*.105+z*.037)
    +.9*Math.sin(z*.14-x*.048));
  // First downhill portion remains a clear village slope. Only the last
  // ~25 metres by Cherek lose their steep gradient.
  const firstLeg=Math.min(downhill,50);
  const firstDrop=-.29*(firstLeg-4*(1-Math.exp(-firstLeg/4)));
  const tail=Math.max(0,downhill-50);
  // Soft cap: continuous height/derivative, level when the river is reached.
  const softenedTail=tail<=11?tail:tail>=26?18.5:
    11+(tail-11)-(tail-11)*(tail-11)/(2*15);
  const bankDrop=-.06*softenedTail-.23*20*(1-Math.exp(-softenedTail/20));
  // A shallow riverbed; the old deep channel must not return.
  const riverBend=-.55*Math.exp(-Math.pow((z-riverCenter(x))/7,2));
  const oppositePlain=2.2*smooth((-109-z)/27);
  // Keep the original bumpy hill and irregular ruin terraces above Cherek.
  // Near water the rock noise fades to avoid implausible bank cliffs.
  const profile=uphill>0?smooth(uphill/8):
    downhill>0?.55+.45*Math.min(downhill,35)/35:smooth(side/13)*.7;
  const riverFade=1-smooth((downhill-53)/34);
  return -.085+villageRise+firstDrop+bankDrop+riverBend+oppositePlain
    +originalRelief*profile*riverFade;
 }
 // The site-plan, not a seeded scatter, owns the dense historic quarters.
 // The construction reserve is deliberately never overwritten by terraces.
 const stone=()=>colors.wall[Math.floor(rnd()*colors.wall.length)];
 const {wallLine,stats:settlementStats,heightAt:terracedY,layout:siteLayout}=
   createKunlumSettlement({quad,tri,groundY,rnd,stone,mobile});
 const groundGeo=new THREE.PlaneGeometry(470,630,mobile?90:160,mobile?144:216);
 groundGeo.rotateX(-Math.PI/2);groundGeo.translate(10,0,-30);
 const p=groundGeo.getAttribute('position'),groundColors=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i);p.setY(i,terracedY(x,z));
  const across=z<-116?['#909b69','#a9a679','#8c976d','#a4a37a','#b0a77d']:Math.abs(z-riverCenter(x))<17?['#9b9c83','#b0ae93','#908e78','#8f9e82']:colors.grass;
  const grass=rgba(across[Math.floor(rnd()*across.length)]);
  groundColors.push(grass.r,grass.g,grass.b);
 }
 groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(groundColors,3));groundGeo.computeVertexNormals();
 ownedGeometries.push(groundGeo);
 const land=new THREE.Mesh(groundGeo,mat('#ffffff',true));land.name='Terraformed natural hillside';group.add(land);

 // One *image*, not hundreds of high-poly distant mountains. A 21KB original SVG.
 const backdropGeo=new THREE.CylinderGeometry(440,440,360,48,1,true);
 ownedGeometries.push(backdropGeo);
 const backdropMat=new THREE.MeshBasicMaterial({color:'#adc4ca',side:THREE.BackSide,depthWrite:false,fog:false});
 ownedMaterials.push(backdropMat);
 const backdrop=new THREE.Mesh(backdropGeo,backdropMat);
 backdrop.position.set(10,30,10);backdrop.name='Distant landscape · 360° panoramic image';
 backdrop.renderOrder=-100;group.add(backdrop);
 try {
  new THREE.TextureLoader().load('/assets/tower/environment/kunlum-distant-panorama.svg?v=17.2.11',
   texture=>{if(disposed){texture.dispose();return;}
    texture.colorSpace=THREE.SRGBColorSpace;backdropTexture=texture;
    backdropMat.map=texture;backdropMat.color.set('#ffffff');backdropMat.needsUpdate=true;},
   undefined,()=>{/* Outdoor building must work offline without background image. */});
 }catch{/* Leave neutral fallback on restricted/offline browsers. */}

 // A shallow Cherek ribbon flows along gently sloping banks.
 for(let i=0;i<84;i++){
  const x0=-155+i*3.8,x1=x0+3.8;
  const z0=riverCenter(x0),z1=riverCenter(x1);
  const y0=groundY(x0,z0)+.12,y1=groundY(x1,z1)+.12;
  const bank=mobile?4.9:5.3;
  quad('water',[x0,y0,z0-bank],[x1,y1,z1-bank],[x1,y1,z1+bank],[x0,y0,z0+bank],
   i%4===0?'#749c99':i%3===0?'#87b2af':'#67918f');
  // Small pale gravel lines at either bank; no reflections or animated shaders.
  for(const side of [-1,1]){
   const b0=z0+side*(bank+1.3),b1=z1+side*(bank+1.3);
   quad('path',[x0,groundY(x0,b0)+.09,b0],[x1,groundY(x1,b1)+.09,b1],
    [x1,groundY(x1,b1+side*.5)+.09,b1+side*.5],
    [x0,groundY(x0,b0+side*.5)+.09,b0+side*.5],'#b8af95');
  }
 }

 // Future expandable plot perimeter [-10,30] x [-15,35]. Active [0,20] x [0,20].
 const reserve=[[-10,-15],[30,-15],[30,35],[-10,35]];
 for(let i=0;i<4;i++){
  const [a,b]=reserve[i],[c,d]=reserve[(i+1)%4],steps=20;
  for(let j=0;j<steps;j++){
   const u=j/steps,v=(j+1)/steps;
   const x=a+(c-a)*u,z=b+(d-b)*u,xx=a+(c-a)*v,zz=b+(d-b)*v;
   const y=groundY(x,z)+.052,yy=groundY(xx,zz)+.052;
   const horiz=Math.abs(a-c)>Math.abs(b-d),n=horiz?[0,.1]:[.1,0];
   quad('path',[x-n[0],y,z-n[1]],[xx-n[0],yy,zz-n[1]],
    [xx+n[0],yy,zz+n[1]],[x+n[0],y,z+n[1]],'#c3b697');
  }
 }

 // Dense contiguous house quarters and shared roofs were generated above.
 // The same free wall function is retained for the surviving second tower.
 // Abaev Kala above the building terrace, with taper and authentic narrow openings.
 // A model approximation, pending access to measured drawings and exact plan coordinates.
 function tower(cx,cz,rotation=-.15){
  const H=15.8,b=6.0,top=4.65,c=Math.cos(rotation),s=Math.sin(rotation),baseY=groundY(cx,cz);
  function world(x,y,z){return [cx+x*c-z*s,baseY+y,cz+x*s+z*c];}
  function surface(side,u,y) {
   const width=b+(top-b)*y/H,q=(u-.5)*width,depth=width*.5;
   return side===0?world(q,y,depth):side===1?world(-q,y,-depth):
          side===2?world(depth,y,-q):world(-depth,y,q);
  }
  const opening=(side,u,y)=>{
   if(side===0){
    if(y<2.5&&Math.abs(u-.5)<.10)return true;
    if(y>5.3&&y<6.9&&Math.abs(u-.5)<.035)return true;
    if(y>9.6&&y<11&&Math.abs(u-.5)<.036)return true;
    if(y>13.1&&y<14.6&&Math.abs(u-.5)<.045)return true;
   }
   // Small upper cross-shaped through openings are documented for Abaev Kala.
   // Their placement is approximate until a surveyed facade plan is available.
   if((side===0||side===2)&&y>14.25&&y<15.5){
    if(Math.abs(u-.5)<.037)return true;
    if(y>14.70&&y<15.08&&Math.abs(u-.5)<.115)return true;
   }
   return side===1&&y>10.3&&y<11.6&&Math.abs(u-.49)<.035;
  };
  const lime=['#cfc9b9','#d8ceba','#b8b4a5','#ded5c5','#a6a59b','#c4bcae','#bbb4a3','#d5ccbb'];
  const towerStone=()=>lime[Math.floor(rnd()*lime.length)];
  const rows=mobile?25:37,columns=mobile?11:16;
  for(let side=0;side<4;side++)for(let row=0;row<rows;row++){
   const y0=row*H/rows,y1=(row+1)*H/rows;
   for(let k=0;k<columns;k++){
    const offset=row%2?.33:0;
    const u0=clamp((k-offset)/columns,0,1),u1=clamp((k+1-offset)/columns,0,1);
    if(u1-u0<.012||opening(side,(u0+u1)/2,(y0+y1)/2))continue;
    const a=surface(side,u0,y0),b=surface(side,u1,y0),
      cc=surface(side,u1,y1),d=surface(side,u0,y1);
    const stoneColor=towerStone();
    const another=towerStone();
    if(!mobile){
     // Raised chalky limestone facets: a dense, solid limewashed wall rather
     // than large coloured rectangular tiles.
     const cent=[(a[0]+b[0]+cc[0]+d[0])*.25,
       (y0+y1)*.5+baseY,(a[2]+b[2]+cc[2]+d[2])*.25];
     const vx=cent[0]-cx,vz=cent[2]-cz,len=Math.hypot(vx,vz)||1;
     const bulge=.012+rnd()*.074;cent[0]+=vx/len*bulge;cent[2]+=vz/len*bulge;
     tri('stone',a,b,cent,stoneColor);
     tri('stone',b,cc,cent,another);
     tri('stone',cc,d,cent,stoneColor);
     tri('stone',d,a,cent,rnd()>.82?'#a9a493':stoneColor);
    }else{
     tri('stone',a,b,cc,stoneColor);
     tri('stone',a,cc,d,another);
    }
   }
  }
  // Dark interiors of apertures, below the front plane.
  for(const [y0,y1,u0,u1] of [[.06,2.5,.41,.59],[5.3,6.9,.47,.53],[9.6,11,.47,.53],[13.1,14.6,.46,.54]]){
   const a=surface(0,u0,y0),b1=surface(0,u1,y0),cc=surface(0,u1,y1),d=surface(0,u0,y1);
   for(const p of [a,b1,cc,d]){p[0]+=(cx-p[0])*.046;p[2]+=(cz-p[2])*.046;}
   quad('stone',a,b1,cc,d,'#343732');
  }
  // Damaged low-slope lime-and-stone coping (no fantasy conical roof).
  const cap=top*.5+.17;
  quad('stone',world(-cap,H,-cap),world(cap,H,-cap),
    world(cap,H+.18,0),world(-cap,H+.18,0),'#51534c');
  quad('stone',world(-cap,H+.18,0),world(cap,H+.18,0),
    world(cap,H,cap),world(-cap,H,cap),'#55554b');
  // Irregular foundation fragments around the tower.
  for(let i=0;i<25;i++){
   const angle=rnd()*Math.PI*2,d=3.4+rnd()*3.6,
     x=cx+Math.cos(angle)*d,z=cz+Math.sin(angle)*d,y=groundY(x,z);
   prism('stone',x-.23,y-.2,z-.26,x+.37,y+.1+rnd()*.32,z+.28,stone());
  }
 }
 const abayKala=[-12,68];tower(...abayKala);
 // Second Abaev tower has surviving fragments only, ~100m away in concept scene.
 wallLine(-109,85,-103,84,{height:4,gaps:[[.5,.65]],course:.45});
 wallLine(-109,85,-110,91,{height:2.7,course:.45});

 // A winding footpath rising past ruined courtyards to the Abaev tower.
 function trail(points,width=1.45){
  for(let i=0;i<points.length-1;i++){
   const [x,z]=points[i],[xx,zz]=points[i+1],dx=xx-x,dz=zz-z,l=Math.hypot(dx,dz);
   const nx=dz/l*width*.5,nz=-dx/l*width*.5;
   const A=[x+nx,groundY(x+nx,z+nz)+.10,z+nz],B=[xx+nx,groundY(xx+nx,zz+nz)+.10,zz+nz];
   const C=[xx-nx,groundY(xx-nx,zz-nz)+.10,zz-nz],D=[x-nx,groundY(x-nx,z-nz)+.10,z-nz];
   quad('path',A,B,C,D,colors.soil);
  }
 }
 trail([[30,-12],[38,-23],[41,-41],[33,-63],[18,-79]],1.8);
 trail([[29,34],[35,42],[25,48],[11,54],[-4,60],[-12,68]],1.25);
 trail([[-12,34],[-22,42],[-38,54],[-47,69]],1.1);

 // Scattered ground stones and grass, all using the same GPU instance batches.
 const rockGeo=new THREE.DodecahedronGeometry(.43,0),rockMat=mat('#9a9387');
 ownedGeometries.push(rockGeo);
 const rocks=new THREE.InstancedMesh(rockGeo,rockMat,mobile?65:175);
 const proxy=new THREE.Object3D();
 for(let i=0;i<rocks.count;i++){
  let x,z,n=0;do{x=-70+rnd()*165;z=-84+rnd()*200;n++;}while(n<30&&x>-11&&x<31&&z>-16&&z<36);
  const y=terracedY(x,z),scale=.38+rnd()*.95;
  proxy.position.set(x,y+.12*scale,z);proxy.rotation.set(rnd(),rnd()*6.28,rnd());
  proxy.scale.set(scale,.6*scale,1.25*scale);proxy.updateMatrix();rocks.setMatrixAt(i,proxy.matrix);
 }
 rocks.instanceMatrix.needsUpdate=true;rocks.computeBoundingSphere();rocks.name='Scattered stones';group.add(rocks);
 const grassGeo=new THREE.ConeGeometry(.085,.34,3),grassMat=mat('#78915b');
 ownedGeometries.push(grassGeo);
 const grass=new THREE.InstancedMesh(grassGeo,grassMat,mobile?120:320);
 for(let i=0;i<grass.count;i++){
  let x,z,n=0;do{x=-70+rnd()*170;z=-80+rnd()*190;n++;}while(n<25&&x>0&&x<20&&z>0&&z<20);
  proxy.position.set(x,terracedY(x,z)+.08,z);proxy.rotation.set(0,rnd()*6.28,0);
  const k=.58+rnd()*.88;proxy.scale.set(k,k,k);proxy.updateMatrix();grass.setMatrixAt(i,proxy.matrix);
 }
 grass.instanceMatrix.needsUpdate=true;grass.computeBoundingSphere();grass.name='Sparse hillside grass';group.add(grass);
 emit('stone','Stone-walled Kunlum stepped houses, courtyards and Abaev Kala');
 emit('earth','Level house-floor terraces');
 emit('water','Cherек · Cherek river');
 emit('path','Paths, gravel banks and reserved plot marker');
 group.userData.kunlum={
  plot:[40,50],buildable:[20,20],reserveX:[-10,30],reserveZ:[-15,35],
  gridStep:.25,ruins:{courtyards:settlementStats.houseContours,...settlementStats},sitePlan:siteLayout.plan.source,monument:'Абай-къала',abaevModelPosition:abayKala,riverAxisZ:-91,
  orientation:'positive z is uphill, negative z is downstream toward Cherek',
  accuracy:'interpretative; pending site map georeferencing'
 };
 return {group,heightAt:terracedY,dispose(){
  if(disposed)return;disposed=true;
  for(const geo of ownedGeometries)geo.dispose();
  for(const material of ownedMaterials)material.dispose();
  if(backdropTexture)backdropTexture.dispose();
  // InstancedMesh owns a small per-instance GPU attribute, too.
  rocks.dispose();grass.dispose();
  scene.remove(group);
 }};
}
