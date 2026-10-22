/**
 * Kunlum hillside environment for AlanTil tower editor.
 * Historical landmark arrangement is illustrative until a surveyed site-plan is available.
 * Local +Z is uphill toward Abaev Kala; -Z descends to Cherek and the opposite bank.
 * Decorative meshes are deliberately not registered in the tower's placement raycaster.
 */
export function createKunlumEnvironment(THREE, scene, {mobile=false}={}) {
 const group=new THREE.Group();group.name='Кюнлюм · склон, руины и Черек';
 scene.add(group);
 const ownedMaterials=[], ownedGeometries=[];
 let disposed=false,backdropTexture=null;
 const rnd=(()=>{let n=0x4b1a27;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);})();
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
 const rgba=c=>new THREE.Color(c);
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
 function groundY(x,z) {
  // Central 20 x 20 m playable plot remains flat and aligned with the invisible game grid.
  // The rest of the 40 x 50 m reserved site is a terrace, still free of permanent buildings.
  // The far bank flattens into the broad Cherek valley instead of descending forever.
  const down=Math.min(0,Math.max(z,-103)),up=Math.max(0,z-20);
  const side=Math.max(0,Math.abs(x-10)-10);
  const amplitude=smooth(Math.max(Math.abs(down),up,side)/13);
  const naturalSlope=down*.29+up*.30;
  // An approximately level gravel channel prevents the river ribbon being buried.
  const riverShoulder=1-smooth((Math.abs(z+91)-5)/10);
  const slope=naturalSlope*(1-riverShoulder)+(-91*.29)*riverShoulder;
  const rough=amplitude*(1.45*Math.sin(x*.105+z*.037)+.9*Math.sin(z*.14-x*.048));
  const channel=-7.2*Math.exp(-Math.pow(Math.max(0,Math.abs(z+91)-5)/8,2));
  const opposite=z<-103?Math.pow(smooth((-103-z)/35),1.45)*(4+(-103-z)*.19):0;
  return -.085+slope+rough+channel+opposite;
 }
 const groundGeo=new THREE.PlaneGeometry(340,360,mobile?58:112,mobile?58:112);
 groundGeo.rotateX(-Math.PI/2);groundGeo.translate(10,0,10);
 const p=groundGeo.getAttribute('position'),groundColors=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i);p.setY(i,groundY(x,z));
  const grass=rgba(colors.grass[Math.floor(rnd()*colors.grass.length)]);
  groundColors.push(grass.r,grass.g,grass.b);
 }
 groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(groundColors,3));groundGeo.computeVertexNormals();
 ownedGeometries.push(groundGeo);
 const land=new THREE.Mesh(groundGeo,mat('#ffffff',true));land.name='Terraformed natural hillside';group.add(land);

 // One *image*, not hundreds of high-poly distant mountains. A 21KB original SVG.
 const backdropGeo=new THREE.CylinderGeometry(230,230,260,40,1,true);
 ownedGeometries.push(backdropGeo);
 const backdropMat=new THREE.MeshBasicMaterial({color:'#adc4ca',side:THREE.BackSide,depthWrite:false,fog:false});
 ownedMaterials.push(backdropMat);
 const backdrop=new THREE.Mesh(backdropGeo,backdropMat);
 backdrop.position.set(10,15,10);backdrop.name='Distant landscape · 360° panoramic image';
 backdrop.renderOrder=-100;group.add(backdrop);
 try {
  new THREE.TextureLoader().load('/assets/tower/environment/kunlum-distant-panorama.svg?v=17.2.7',
   texture=>{if(disposed){texture.dispose();return;}
    texture.colorSpace=THREE.SRGBColorSpace;backdropTexture=texture;
    backdropMat.map=texture;backdropMat.color.set('#ffffff');backdropMat.needsUpdate=true;},
   undefined,()=>{/* Outdoor building must work offline without background image. */});
 }catch{/* Leave neutral fallback on restricted/offline browsers. */}

 // A real 3D low-poly Cherek water ribbon, visible downslope, not a flat blue wallpaper.
 const riverCenter=x=>-91+4.7*Math.sin((x+16)*.028);
 for(let i=0;i<84;i++){
  const x0=-155+i*3.8,x1=x0+3.8;
  const z0=riverCenter(x0),z1=riverCenter(x1);
  const y0=groundY(x0,z0)+.16,y1=groundY(x1,z1)+.16;
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

 // Historic-looking dry-stone terrace retaining walls. Courses overlap and have broken tops.
 const stone=()=>colors.wall[Math.floor(rnd()*colors.wall.length)];
 function wallLine(ax,az,bx,bz,{height=1.5,thickness=.5,gaps=[],course=.3}={}){
  const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),N=Math.max(3,Math.ceil(length/.88));
  const normal=[-dz/length*thickness*.5,dx/length*thickness*.5];
  for(let c=0;c<Math.ceil(height/course);c++){
   const n=Math.ceil(N*(c%2?.97:1)),v0=(c%2?.36:0);
   for(let j=0;j<n;j++){
    const t0=clamp((j+v0)/n,0,1),t1=clamp((j+1+v0)/n,0,1);
    if(t1-t0<.02||gaps.some(([lo,hi])=>(t0+t1)/2>lo&&(t0+t1)/2<hi))continue;
    const x=ax+dx*t0,z=az+dz*t0,xx=ax+dx*t1,zz=az+dz*t1;
    const topBreak=c>=Math.floor(height/course)-2&&(rnd()>.78||Math.sin((j+3)*3.8+c)>.92);
    if(topBreak)continue;
    const foot=Math.min(groundY(x,z),groundY(xx,zz))-.24;
    const yy=foot+c*course;
    prism('stone',x+normal[0],yy,z+normal[1],
     xx-normal[0],yy+course+.014,zz-normal[1],stone());
   }
  }
 }
 // Tangible village quarters hug the slope; none obstruct the reserved 40×50 m site.
 const terraces=[
  [[-58,40],[-15,43],1.1,[[.25,.34],[.78,.84]]],
  [[31,42],[79,44],1.5,[[.38,.45]]],
  [[-57,58],[-14,58],1.9,[[.42,.53]]],
  [[3,56],[52,57],1.1,[[.14,.24],[.8,.89]]],
  [[-57,77],[-15,77],2.3,[[.2,.28]]],
  [[10,77],[63,77],1.75,[[.53,.64]]],
  [[-40,-38],[-15,-36],.85,[[.5,.7]]],
  [[37,-26],[73,-28],1.15,[[.18,.3]]]
 ];
 for(const [a,b,h,gaps] of terraces)wallLine(...a,...b,{height:h,gaps});
 // Roofless ruined residences and fragmented courtyard walls (no invented intact village).
 const ruins=[
  [-25,23,7.5,5.8,1.4],[-24,44,6.8,6,1.75],[39,19,7.5,6.5,1.5],
  [43,37,6.8,7,1.45],[-21,61,7.1,5.9,2.1],[20,57,7,5.7,1.65],
  [53,57,6.5,7.5,1.2],[-37,77,7.1,6.2,1.3],[55,77,5.5,7.5,1.25],
  [-28,-36,7.5,5.2,1.0],[42,-41,6.2,6.1,1.1],[-23,-58,6.5,5.5,.85]
 ];
 for(const [x,z,w,d,h] of ruins){
  const a=[x-w/2,z-d/2],b=[x+w/2,z-d/2],c=[x+w/2,z+d/2],dd=[x-w/2,z+d/2];
  const corners=[a,b,c,dd];
  for(let j=0;j<4;j++)wallLine(...corners[j],...corners[(j+1)%4],{height:h*(.68+rnd()*.6),
    gaps:j===1?[[.34,.57]]:rnd()>.4?[[.27,.35]]:[]});
  for(let j=0;j<7;j++){
   const xx=x+(rnd()-.5)*(w+2),zz=z+(rnd()-.5)*(d+2),yy=groundY(xx,zz);
   prism('stone',xx-.24,yy-.15,zz-.18,xx+.3,yy+.08+rnd()*.20,zz+.31,stone());
  }
 }

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
   }return side===1&&y>10.3&&y<11.6&&Math.abs(u-.49)<.035;
  };
  const rows=mobile?21:29,columns=mobile?10:13;
  for(let side=0;side<4;side++)for(let row=0;row<rows;row++){
   const y0=row*H/rows,y1=(row+1)*H/rows;
   for(let k=0;k<columns;k++){
    const offset=row%2?.35:0,u0=clamp((k-offset)/columns,0,1),
      u1=clamp((k+1-offset)/columns,0,1),mid=(u0+u1)/2;
    if(u1<=u0||opening(side,mid,(y0+y1)/2))continue;
    quad('stone',surface(side,u0,y0),surface(side,u1,y0),
      surface(side,u1,y1),surface(side,u0,y1),stone());
   }
  }
  // Dark interiors of apertures, below the front plane.
  for(const [y0,y1,u0,u1] of [[.06,2.5,.41,.59],[5.3,6.9,.47,.53],[9.6,11,.47,.53],[13.1,14.6,.46,.54]]){
   const a=surface(0,u0,y0),b1=surface(0,u1,y0),cc=surface(0,u1,y1),d=surface(0,u0,y1);
   for(const p of [a,b1,cc,d]){p[0]+=(cx-p[0])*.046;p[2]+=(cz-p[2])*.046;}
   quad('stone',a,b1,cc,d,'#343732');
  }
  // Flat, low-pitched weathered cap; not a sharp fairy-tale spire.
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
  const y=groundY(x,z),scale=.38+rnd()*.95;
  proxy.position.set(x,y+.12*scale,z);proxy.rotation.set(rnd(),rnd()*6.28,rnd());
  proxy.scale.set(scale,.6*scale,1.25*scale);proxy.updateMatrix();rocks.setMatrixAt(i,proxy.matrix);
 }
 rocks.instanceMatrix.needsUpdate=true;rocks.computeBoundingSphere();rocks.name='Scattered stones';group.add(rocks);
 const grassGeo=new THREE.ConeGeometry(.085,.34,3),grassMat=mat('#78915b');
 ownedGeometries.push(grassGeo);
 const grass=new THREE.InstancedMesh(grassGeo,grassMat,mobile?120:320);
 for(let i=0;i<grass.count;i++){
  let x,z,n=0;do{x=-70+rnd()*170;z=-80+rnd()*190;n++;}while(n<25&&x>0&&x<20&&z>0&&z<20);
  proxy.position.set(x,groundY(x,z)+.08,z);proxy.rotation.set(0,rnd()*6.28,0);
  const k=.58+rnd()*.88;proxy.scale.set(k,k,k);proxy.updateMatrix();grass.setMatrixAt(i,proxy.matrix);
 }
 grass.instanceMatrix.needsUpdate=true;grass.computeBoundingSphere();grass.name='Sparse hillside grass';group.add(grass);
 emit('stone','Roofless courtyard ruins, retaining walls and Abaev tower');
 emit('water','Cherек · Cherek river');
 emit('path','Paths, gravel banks and reserved plot marker');
 group.userData.kunlum={
  plot:[40,50],buildable:[20,20],reserveX:[-10,30],reserveZ:[-15,35],
  gridStep:.25,monument:'Абай-къала',abaevModelPosition:abayKala,riverAxisZ:-91,
  orientation:'positive z is uphill, negative z is downstream toward Cherek',
  accuracy:'interpretative; pending site map georeferencing'
 };
 return {group,heightAt:groundY,dispose(){
  if(disposed)return;disposed=true;
  for(const geo of ownedGeometries)geo.dispose();
  for(const material of ownedMaterials)material.dispose();
  if(backdropTexture)backdropTexture.dispose();
  // InstancedMesh owns a small per-instance GPU attribute, too.
  rocks.dispose();grass.dispose();
  scene.remove(group);
 }};
}
