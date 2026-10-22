/**
 * Kunlum lightweight, stylised THREE.js environment.
 * Historic reference: Abaev tower (approximately 6x6x16m), Kunlum, Upper Balkaria.
 * Scene is an interpretation, not a survey-based digital twin.
 * All decorative geometry is excluded from the tower raycast/save/prefab state.
 */
export function createKunlumEnvironment(THREE, scene, {mobile=false} = {}) {
 const group = new THREE.Group();
 group.name = 'Kunlum / decorative landscape';
 scene.add(group);
 const made = [];
 const material = (color, vertexColors=false) => {
  const m = new THREE.MeshLambertMaterial({color,vertexColors,side:THREE.DoubleSide});
  made.push(m);return m;
 };
 const rng = (()=>{let s=477812;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);})();
 const rgb=(a)=>new THREE.Color(a);
 const pos=[],cols=[],roofPos=[],roofColors=[],pathPos=[],pathCols=[];
 function tri(dst,colors,a,b,c,color) {
  const co=rgb(color);
  for(const p of [a,b,c]) {dst.push(...p);colors.push(co.r,co.g,co.b);}
 }
 function quad(dst,colors,a,b,c,d,color) {
  tri(dst,colors,a,b,c,color);tri(dst,colors,a,c,d,color);
 }
 function rect(x0,y0,z0,x1,y1,z1,color) {
  const a=[x0,y0,z0],b=[x1,y0,z0],c=[x1,y1,z0],d=[x0,y1,z0],
   e=[x0,y0,z1],f=[x1,y0,z1],g=[x1,y1,z1],h=[x0,y1,z1];
  for(const v of [[a,b,c,d],[f,e,h,g],[e,a,d,h],[b,f,g,c],[d,c,g,h],[e,f,b,a]])
   quad(pos,cols,...v,color);
 }
 function fillMesh(dst,colors,mat,name){
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(dst,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.frustumCulled=true;group.add(mesh);
  return mesh;
 }
 const stoneTones=['#b4aa91','#a69c87','#c0b59f','#968f81','#c8bba5','#bcb29b','#9c9687'];
 const roofTones=['#464c48','#52544a','#616058'];
 function stone(){return stoneTones[Math.floor(rng()*stoneTones.length)];}
 function height(x,z) {
  const reserve=Math.max(Math.abs(x-10)-20,Math.abs(z-10)-25,0);
  const taper=Math.min(1,reserve/38);
  return -.07 + Math.pow(taper,1.65)*(1.8*Math.sin(x*.077)+1.7*Math.cos(z*.061)+.9*Math.sin((x+z)*.08));
 }
 // Smooth ground covering build area + enough land for surrounding houses.
 const groundGeo = new THREE.PlaneGeometry(320,320,mobile?36:72,mobile?36:72);
 groundGeo.rotateX(-Math.PI/2);groundGeo.translate(10,0,10);
 const gp=groundGeo.attributes.position,groundColors=[];
 const grasses=['#899565','#919b69','#a6ab76','#88966c','#b3aa79','#9b9d70'];
 for(let i=0;i<gp.count;i++){
  const x=gp.getX(i),z=gp.getZ(i);
  gp.setY(i,height(x,z));
  const grass=rgb(grasses[Math.floor(rng()*grasses.length)]);
  groundColors.push(grass.r,grass.g,grass.b);
 }
 groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(groundColors,3));groundGeo.computeVertexNormals();
 const ground=new THREE.Mesh(groundGeo,material('#ffffff',true));
 ground.name='Landscape outside buildable 20x20 area';group.add(ground);
 // 360-degree overlapping alpine silhouettes. All are real geometry but very inexpensive.
 for(let tier=0;tier<3;tier++){
  const g=new THREE.BufferGeometry(),v=[],c=[],segments=120;
  const radius=160+tier*95,base=-4+tier*8,color=['#6f806e','#819397','#9fb0b5'][tier];
  const previous=(angle)=> {
   const a=angle*3.0 + tier*1.7;
   return base+24+tier*17+11*Math.sin(a*2.1)+8*Math.cos(a*4.3)+4*Math.sin(a*11.7);
  };
  for(let j=0;j<segments;j++){
   const a=j/segments*Math.PI*2,b=(j+1)/segments*Math.PI*2,
   p=[10+Math.cos(a)*radius,-16,10+Math.sin(a)*radius],
   q=[10+Math.cos(b)*radius,-16,10+Math.sin(b)*radius],
   r=[10+Math.cos(a)*radius,previous(a),10+Math.sin(a)*radius],
   s=[10+Math.cos(b)*radius,previous(b),10+Math.sin(b)*radius];
   quad(v,c,p,q,s,r,color);
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
  g.computeVertexNormals();const m=new THREE.Mesh(g,material('#ffffff',true));
  m.name='Distant mountain ring '+tier;group.add(m);
 }
 // Main monument: tapered walls, deliberately open door and slit apertures.
 function tower(cx,cz,rot=0){
  const base=6,top=4.75,H=15.5,c=Math.cos(rot),s=Math.sin(rot);
  function transform(v){const [x,y,z]=v;return [cx+x*c-z*s,y+height(cx,cz),cz+x*s+z*c].map((n,i)=>i===1?n+v[1]:n);}
  function wall(side,u,y) {
   const w=base+(top-base)*y/H, x=(u-.5)*w;
   if(side===0)return transform([x,y,w/2]);
   if(side===1)return transform([-x,y,-w/2]);
   if(side===2)return transform([w/2,y,-x]);
   return transform([-w/2,y,x]);
  }
  const hole=(side,u,y)=>{
   if(side===0 && y<2.2 && Math.abs(u-.5)<.085)return true;
   if(side===0 && y>6.1 && y<8.1 && Math.abs(u-.5)<.026)return true;
   if(side===0 && y>9.0 && y<10.35 && Math.abs(u-.5)<.024)return true;
   if(side===0 && y>13.35 && y<14.7 && (Math.abs(u-.38)<.075 || Math.abs(u-.64)<.06))return true;
   if(side===1 && y>11 && y<11.9 && Math.abs(u-.53)<.042)return true;
   if(side===2 && y>8.5 && y<9.75 && Math.abs(u-.45)<.035)return true;
   if(side===3 && y>12.7 && y<14 && Math.abs(u-.5)<.06)return true;
   return false;
  };
  const courses=mobile?22:36,segments=mobile?11:15;
  for(let side=0;side<4;side++){
   for(let i=0;i<courses;i++){
    const y0=i*H/courses,y1=(i+1)*H/courses;
    for(let k=0;k<segments;k++){
     const shift=i%2?0.48:0;
     const u0=Math.max(0,(k-shift)/segments),u1=Math.min(1,(k+1-shift)/segments);
     if(u1<=u0)continue;
     const um=(u0+u1)/2,ym=(y0+y1)/2;
     if(hole(side,um,ym))continue;
     const a=wall(side,u0,y0),b=wall(side,u1,y0),
           cc=wall(side,u1,y1),d=wall(side,u0,y1);
     const rough=.006+.015*rng();
     const normal=new THREE.Vector3(...wall(side,.52,ym)).sub(new THREE.Vector3(...wall(side,.5,ym))).normalize();
     const color=stone();
     // Closed, flush-faced courses: no visual holes between large stones.
     quad(pos,cols,a,b,cc,d,color);
     // Small shallow offset facet for irregular masonry relief, never a floating cube.
     if(!mobile && rng()>.68){
      const center=wall(side,um,ym),offset=[center[0],center[1],center[2]];
      offset[0]+=normal.x*rough;offset[2]+=normal.z*rough;
      tri(pos,cols,a,offset,d,color);
     }
    }
   }
  }
  // Dark recesses: actual missing front-facing masonry faces, not painted door graphics.
  const black='#302e2a';
  function opening(side,u0,u1,y0,y1) {
   const a=wall(side,u0,y0),b=wall(side,u1,y0),
         cc=wall(side,u1,y1),d=wall(side,u0,y1);
   const inward=new THREE.Vector3(cx-(a[0]+b[0])/2,0,cz-(a[2]+b[2])/2).normalize().multiplyScalar(.15);
   for(const q of [a,b,cc,d]){q[0]+=inward.x;q[2]+=inward.z;}
   quad(pos,cols,a,b,cc,d,black);
  }
  opening(0,.425,.575,.10,2.15);
  opening(0,.476,.524,6.1,8.1);
  opening(0,.477,.523,9.0,10.35);
  opening(0,.31,.45,13.35,14.7);opening(0,.59,.69,13.35,14.7);
  opening(1,.49,.57,11,11.9);opening(2,.41,.49,8.5,9.75);
  opening(3,.44,.56,12.7,14);
  // Four hipped roof faces, slight eaves and dark slate cap.
  const corners=[[-2.58,H,2.58],[2.58,H,2.58],[2.58,H,-2.58],[-2.58,H,-2.58]];
  const peak=transform([0,16.05,0]);
  for(let j=0;j<4;j++)tri(roofPos,roofColors,transform(corners[j]),transform(corners[(j+1)%4]),peak,roofTones[j%3]);
  // Foundation stones around the hill.
  for(let i=0;i<22;i++){
   const a=rng()*Math.PI*2,d=3.3+rng()*3.1,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;
   rect(x-.23,height(x,z),z-.2,x+.31,height(x,z)+.20+rng()*.23,z+.28,stone());
  }
 }
 tower(-27,44,-.18);
 // Abaev second tower site / ruins - deliberately incomplete, not an invented full tower.
 function ruin(cx,cz,sx,sz,h){
  const y=height(cx,cz);
  rect(cx-sx/2,y,cz-sz/2,cx+sx/2,y+h,cz-sz/2+.55,stone());
  rect(cx-sx/2,y,cz-sz/2,cx-sx/2+.53,y+h*.72,cz+sz/2,stone());
  rect(cx+sx/2-.5,y,cz-sz/2,cx+sx/2,y+h*.42,cz+sz/2,stone());
  for(let i=0;i<18;i++){
   const x=cx+(rng()-.5)*(sx+3),z=cz+(rng()-.5)*(sz+3);
   rect(x-.3,height(x,z),z-.3,x+.35,height(x,z)+.18+rng()*.28,z+.34,stone());
  }
 }
 ruin(-105,105,5.8,5.9,5.2);
 // Repeated stone houses are static decor, outside even the future 40x50m buildable reserve.
 const houses=[[-18,23,6,7,3.1],[-19,10,5.5,6,2.7],[35,31,6,8,3.5],
 [39,16,5,6,2.9],[37,-14,7,6,3.3],[4,43,5.4,7,2.5],[22,44,7,5,3.0]];
 for(let idx=0;idx<houses.length;idx++){
  const [x,z,w,d,h]=houses[idx],y=height(x,z);
  rect(x-w/2,y,z-d/2,x+w/2,y+h,z+d/2,stone());
  const rh=.35;
  quad(roofPos,roofColors,[x-w/2-.22,y+h,z-d/2-.22],[x+w/2+.22,y+h,z-d/2-.22],
   [x+w/2+.22,y+h+rh,z],[x-w/2-.22,y+h+rh,z],roofTones[idx%3]);
  quad(roofPos,roofColors,[x-w/2-.22,y+h+rh,z],[x+w/2+.22,y+h+rh,z],
   [x+w/2+.22,y+h,z+d/2+.22],[x-w/2-.22,y+h,z+d/2+.22],roofTones[idx%3]);
  // Dark inset doorway and tiny window blocks, independent from the game raycast.
  const f=z+d/2+.005;
  quad(pos,cols,[x-.5,y+.03,f],[x+.5,y+.03,f],[x+.5,y+1.7,f],[x-.5,y+1.7,f],'#403c35');
  quad(pos,cols,[x+w*.26,y+1.7,f],[x+w*.43,y+1.7,f],[x+w*.43,y+2.1,f],[x+w*.26,y+2.1,f],'#4b483e');
 }
 // Broken stone enclosures and terraced walls.
 for(const [x,z,w,d,h] of [[-14,35,8,4,1.35],[31,39,10,3,1.2],[-29,11,7,3,1.1]]){
  const y=height(x,z);
  rect(x,y,z,x+w,y+h,z+.4,stone());
  rect(x,y,z,x+.4,y+h*.82,z+d,stone());
 }
 // Stone and dirt track: gently follows ground level around the buildings.
 for(const [ax,az,bx,bz] of [[-18,10,-27,43],[-18,23,4,43],[33,31,10,36]]){
  const pa=[ax,height(ax,az)+.017,az],pb=[bx,height(bx,bz)+.017,bz];
  const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
  const nx=dz/len*.65,nz=-dx/len*.65;
  quad(pathPos,pathCols,[pa[0]+nx,pa[1],pa[2]+nz],[pb[0]+nx,pb[1],pb[2]+nz],
   [pb[0]-nx,pb[1],pb[2]-nz],[pa[0]-nx,pa[1],pa[2]-nz],'#998c72');
 }
 const stoneMat=material('#ffffff',true);
 fillMesh(pos,cols,stoneMat,'Abaev towers and stone houses');
 fillMesh(roofPos,roofColors,stoneMat,'Stone slate roofs');
 fillMesh(pathPos,pathCols,stoneMat,'Village paths');
 // Low-overhead instanced rough boulders, reserve buildable plot kept clean.
 const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.4,0),material('#817f72'),mobile?45:100);
 const dummy=new THREE.Object3D();
 const rockColors=['#939287','#847e73','#a5a08d'];
 for(let i=0;i<rocks.count;i++){
  const x=-72+rng()*160,z=-70+rng()*170;
  dummy.position.set(x,height(x,z)+.13,z);dummy.rotation.set(rng()*3,rng()*3,rng()*3);
  dummy.scale.set(.3+rng()*1.2,.25+rng()*.65,.45+rng()*1.4);dummy.updateMatrix();
  rocks.setMatrixAt(i,dummy.matrix);rocks.setColorAt(i,rgb(rockColors[i%3]));
 }
 rocks.instanceMatrix.needsUpdate=true;rocks.instanceColor.needsUpdate=true;
 rocks.computeBoundingSphere();rocks.name='Boulders / instanced';group.add(rocks);
 const grassesGeo=new THREE.ConeGeometry(.10,.46,3,1);
 const grassesMat=material('#788d57');
 const grassesMesh=new THREE.InstancedMesh(grassesGeo,grassesMat,mobile?100:240);
 for(let i=0;i<grassesMesh.count;i++){
  let x,z;
  do{x=-36+rng()*99;z=-23+rng()*90;}while(x>=0&&x<=20&&z>=0&&z<=20);
  dummy.position.set(x,height(x,z)+.17,z);dummy.rotation.set(0,rng()*6.28,0);
  const k=.65+rng()*.8;dummy.scale.set(k,k,k);dummy.updateMatrix();
  grassesMesh.setMatrixAt(i,dummy.matrix);
 }
 grassesMesh.instanceMatrix.needsUpdate=true;grassesMesh.computeBoundingSphere();
 grassesMesh.name='Grass / instanced';group.add(grassesMesh);
 group.userData.kunlum={plot:[40,50],buildable:[20,20],gridStep:.25,
  monument:'Abay-Kala',monumentApproximate:[6,6,16],historicalAccuracy:'interpretative'};
 return {group,dispose(){
  group.traverse(o=>{if(o.geometry)o.geometry.dispose();});
  for(const m of made)m.dispose();
  scene.remove(group);
 }};
}
