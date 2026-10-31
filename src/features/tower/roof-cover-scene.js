/** AlanTil's traditional turf roof. Dynamic 25cm occupancy, one continuous earthen skin.
 * All visible elements are genuine 3D geometry: irregular pole courses, barley chaff,
 * juniper twigs, packed soil and small grass blades. No per-cell earth boxes.
 */
export function createRoofCoverRenderer(THREE,root,requestRender){
 const C=.25,STEP=4,SOIL_BASE=.153,TOP=.246;
 const saved=new THREE.Group(),draftLayer=new THREE.Group();
 root.add(saved,draftLayer);
 const dark=(r,g,b)=>new THREE.Color(r/255,g/255,b/255);
 const hash=(x,z,seed=0)=>{
  let h=(Math.imul(x|0,374761393)+Math.imul(z|0,668265263)+Math.imul(seed,1442695041))|0;
  h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;
  return (h>>>0)/4294967295;
 };
 function noise(x,z,scale,seed){
  const xx=x/scale,zz=z/scale,ix=Math.floor(xx),iz=Math.floor(zz);
  const a=xx-ix,b=zz-iz,tx=a*a*(3-2*a),tz=b*b*(3-2*b);
  const u=hash(ix,iz,seed)*(1-tx)+hash(ix+1,iz,seed)*tx;
  const v=hash(ix,iz+1,seed)*(1-tx)+hash(ix+1,iz+1,seed)*tx;
  return u*(1-tz)+v*tz;
 }
 function soilHeight(x,z){
  const variation=(noise(x,z,.53,7)-.5)*.006+(noise(x,z,.14,11)-.5)*.007;
  return TOP+variation;
 }
 const groundMap=new THREE.DataTexture((()=>{
  const n=256,data=new Uint8Array(n*n*4);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
   const i=(z*n+x)*4,p=noise(x,z,52,9),fine=noise(x,z,5,19),grain=hash(x,z,23);
   const moss=Math.max(0,Math.min(1,(p-.40)*1.9));
   const r=99-26*moss+fine*22+(grain-.5)*17;
   const g=80+29*moss+fine*20+(grain-.5)*13;
   const b=52-6*moss+fine*15+(grain-.5)*12;
   data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;
  }
  return data;
 })(),256,256);
 groundMap.colorSpace=THREE.SRGBColorSpace;
 groundMap.wrapS=groundMap.wrapT=THREE.RepeatWrapping;
 groundMap.anisotropy=4;groundMap.minFilter=THREE.LinearMipmapLinearFilter;
 groundMap.magFilter=THREE.LinearFilter;groundMap.generateMipmaps=true;
 groundMap.needsUpdate=true;
 const barkMap=new THREE.DataTexture((()=>{
  const w=128,h=256,data=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4;
   const ridges=noise(x+Math.sin(y*.028)*3,y*.18,8,27);
   const scratches=noise(x,y*.10,2,29);
   const v=67+ridges*31+scratches*16;
   data[i]=v+11;data[i+1]=v*.66;data[i+2]=v*.42;data[i+3]=255;
  }
  return data;
 })(),128,256);
 barkMap.colorSpace=THREE.SRGBColorSpace;
 barkMap.wrapS=barkMap.wrapT=THREE.RepeatWrapping;
 barkMap.minFilter=THREE.LinearMipmapLinearFilter;barkMap.magFilter=THREE.LinearFilter;
 barkMap.generateMipmaps=true;barkMap.needsUpdate=true;
 const earthMat=new THREE.MeshStandardMaterial({map:groundMap,color:0xffffff,roughness:1,metalness:0});
 const sideMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide,metalness:0});
 const poleMat=new THREE.MeshStandardMaterial({map:barkMap,color:0xffffff,roughness:.97,metalness:0});
 const chaffMat=new THREE.MeshStandardMaterial({color:0xb8a078,roughness:1,side:THREE.DoubleSide});
 const twigMat=new THREE.MeshStandardMaterial({color:0x6b6446,roughness:1});
 const needleMat=new THREE.MeshStandardMaterial({color:0x656c40,roughness:1,side:THREE.DoubleSide});
 const grassMat=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,side:THREE.DoubleSide});
 const ghostMat=new THREE.MeshBasicMaterial({color:0x20bd64,transparent:true,opacity:.08,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 const nodeMat=new THREE.MeshBasicMaterial({color:0x22e377,depthTest:false});
 const lineMat=new THREE.LineBasicMaterial({color:0x23e681,depthTest:false});
 const materials=[earthMat,sideMat,poleMat,chaffMat,twigMat,needleMat,grassMat,ghostMat,nodeMat,lineMat];
 // Make real non-uniform naturally weathered poles; scale length along X for contiguous courses.
 const poleGeo=new THREE.CylinderGeometry(.043,.049,C,13,8,false);
 poleGeo.rotateZ(-Math.PI/2);
 const polePos=poleGeo.getAttribute('position');
 for(let i=0;i<polePos.count;i++){
  const x=polePos.getX(i),y=polePos.getY(i),z=polePos.getZ(i);
  const angle=Math.atan2(z,y),r=1+.056*Math.sin(x*53+angle*3.4)+.031*Math.cos(x*92-angle*5);
  polePos.setY(i,y*r);polePos.setZ(i,z*r);
 }
 poleGeo.computeVertexNormals();
 const fiberGeo=new THREE.CylinderGeometry(.0009,.0018,.13,3,1);
 const twigGeo=new THREE.CylinderGeometry(.0018,.0045,.17,5,2);
 const needleGeo=new THREE.ConeGeometry(.009,.050,3);
 const nodeGeo=new THREE.SphereGeometry(.073,14,10);
 const grassGeo=(()=>{
  const positions=[],colors=[],indices=[];let vertex=0;
  // A tuft is ten individually curved, tapered double-sided grass blades.
  for(let i=0;i<10;i++){
   const angle=i*2.3999632,dx=Math.cos(angle),dz=Math.sin(angle);
   const height=.030+.024*hash(i,0,41),radius=.004+.005*hash(i,1,47);
   const lean=.010+.018*hash(i,2,53);
   const center=[dx*radius,0,dz*radius],tip=[dx*(radius+lean),height,dz*(radius+lean)];
   const side=[-dz,0,dx],half=.0021+.0008*hash(i,3,71);
   const knee=[dx*(radius+lean*.41),height*.55,dz*(radius+lean*.41)];
   for(const p of [
    [center[0]-side[0]*half,center[1],center[2]-side[2]*half],
    [center[0]+side[0]*half,center[1],center[2]+side[2]*half],
    [knee[0]-side[0]*half*.45,knee[1],knee[2]-side[2]*half*.45],
    [knee[0]+side[0]*half*.45,knee[1],knee[2]+side[2]*half*.45],
    tip]){
    positions.push(...p);
   }
   const c=new THREE.Color().setRGB(.20+hash(i,2,73)*.15,.39+hash(i,3,79)*.18,.10+hash(i,4,83)*.09);
   for(let k=0;k<5;k++){const f=k===4?1.15:k<2?.83:1;colors.push(c.r*f,c.g*f,c.b*f);}
   indices.push(vertex,vertex+1,vertex+2,vertex+1,vertex+3,vertex+2,vertex+2,vertex+3,vertex+4);
   vertex+=5;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(indices);g.computeVertexNormals();return g;
 })();
 const shared=[poleGeo,fiberGeo,twigGeo,needleGeo,nodeGeo,grassGeo];
 const tmp=new THREE.Object3D(),col=new THREE.Color();
 function instances(parent,geometry,material,cells,level,perCell,place,tint=false){
  if(!cells.length||!perCell)return;
  const mesh=new THREE.InstancedMesh(geometry,material,cells.length*perCell);
  mesh.frustumCulled=false;
  let i=0;
  for(const [x,z] of cells)for(let n=0;n<perCell;n++){
   tmp.position.set((x+.5)*C,level*C,(z+.5)*C);
   tmp.rotation.set(0,0,0);tmp.scale.set(1,1,1);
   place(tmp,x,z,n);
   tmp.updateMatrix();mesh.setMatrixAt(i,tmp.matrix);
   if(tint){
    const f=.83+.29*hash(x*31+n,z*71,19);
    col.setRGB(f,f,f);mesh.setColorAt(i,col);
   }
   i++;
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  parent.add(mesh);
 }
 function poles(parent,cells,level){
  const rows=new Map();
  for(const [x,z] of cells){
   if(!rows.has(z))rows.set(z,[]);
   rows.get(z).push(x);
  }
  const runs=[];
  for(const [z,xx] of rows){
   xx.sort((a,b)=>a-b);
   let start=xx[0],end=start;
   for(let k=1;k<xx.length;k++){
    if(xx[k]===end+1){end=xx[k];continue;}
    runs.push([start,end,z]);start=end=xx[k];
   }
   runs.push([start,end,z]);
  }
  const mesh=new THREE.InstancedMesh(poleGeo,poleMat,runs.length*2);
  mesh.frustumCulled=false;
  let i=0;
  for(const [start,end,z] of runs)for(const lane of [-1,1]){
   const n=hash(z,start+lane,19);
   tmp.position.set((start+end+1)*C/2,level*C+.054+(.003*(n-.5)),(z+.5)*C+lane*.062);
   tmp.rotation.set(0,0,0);
   tmp.scale.set(end-start+1,.91+n*.14,.91+n*.14);
   tmp.updateMatrix();mesh.setMatrixAt(i,tmp.matrix);
   const t=.86+.25*hash(start,end+z,lane+11);
   col.setRGB(t,t,t);mesh.setColorAt(i,col);i++;
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  parent.add(mesh);
 }
 function terrain(parent,cells,level){
  if(!cells.length)return null;
  const occupied=new Set(cells.map(c=>c[0]+','+c[1]));
  const positions=[],uv=[],indices=[],vertices=new Map();
  const gIndex=(gx,gz)=>{
   const key=gx+','+gz;
   if(vertices.has(key))return vertices.get(key);
   const x=gx*C/STEP,z=gz*C/STEP;
   const i=positions.length/3;positions.push(x,level*C+soilHeight(x,z),z);
   uv.push(x*1.65,z*1.65);vertices.set(key,i);return i;
  };
  const skirtPos=[],skirtColors=[],skirtUv=[],skirtIndices=[];
  const addSkirt=(x0,z0,x1,z1)=>{
   const s=skirtPos.length/3;
   const y0=soilHeight(x0,z0),y1=soilHeight(x1,z1);
   const lower0=SOIL_BASE+.003*(hash(Math.round(x0*32),Math.round(z0*32),5)-.5);
   const lower1=SOIL_BASE+.003*(hash(Math.round(x1*32),Math.round(z1*32),5)-.5);
   skirtPos.push(x0,level*C+y0,z0,x1,level*C+y1,z1,
     x0,level*C+lower0,z0,x1,level*C+lower1,z1);
   const c0=.74+.16*noise(x0,z0,.18,21),c1=.74+.16*noise(x1,z1,.18,21);
   skirtColors.push(c0*.55,c0*.43,c0*.28,c1*.55,c1*.43,c1*.28,
     c0*.62,c0*.48,c0*.31,c1*.62,c1*.48,c1*.31);
   skirtUv.push(x0*2,z0*2,x1*2,z1*2,x0*2,lower0*2,x1*2,lower1*2);
   skirtIndices.push(s,s+1,s+2,s+1,s+3,s+2);
  };
  for(const [x,z] of cells){
   for(let ix=0;ix<STEP;ix++)for(let iz=0;iz<STEP;iz++){
    const a=gIndex(x*STEP+ix,z*STEP+iz);
    const b=gIndex(x*STEP+ix+1,z*STEP+iz);
    const c=gIndex(x*STEP+ix,z*STEP+iz+1);
    const d=gIndex(x*STEP+ix+1,z*STEP+iz+1);
    indices.push(a,c,b,b,c,d);
   }
   const border=[
    [x-1,z,x*C,z*C,x*C,(z+1)*C],
    [x+1,z,(x+1)*C,z*C,(x+1)*C,(z+1)*C],
    [x,z-1,x*C,z*C,(x+1)*C,z*C],
    [x,z+1,x*C,(z+1)*C,(x+1)*C,(z+1)*C]
   ];
   for(const [nx,nz,ax,az,bx,bz] of border)if(!occupied.has(nx+','+nz)){
    for(let k=0;k<STEP;k++){
     const t0=k/STEP,t1=(k+1)/STEP;
     addSkirt(ax+(bx-ax)*t0,az+(bz-az)*t0,ax+(bx-ax)*t1,az+(bz-az)*t1);
    }
   }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();g.userData.roofOwned=true;
  const top=new THREE.Mesh(g,earthMat);
  parent.add(top);
  const sideG=new THREE.BufferGeometry();
  sideG.setAttribute('position',new THREE.Float32BufferAttribute(skirtPos,3));
  sideG.setAttribute('color',new THREE.Float32BufferAttribute(skirtColors,3));
  sideG.setIndex(skirtIndices);sideG.computeVertexNormals();
  sideG.userData.roofOwned=true;
  parent.add(new THREE.Mesh(sideG,sideMat));
  return g;
 }
 function assembly(cells,level,preview=false){
  const group=new THREE.Group();
  if(!cells?.length||!Number.isInteger(level))return group;
  poles(group,cells,level);
  const strands=cells.length<=500?21:cells.length<1500?13:7;
  instances(group,fiberGeo,chaffMat,cells,level,strands,(o,x,z,n)=>{
   const k=x*59+z*337+n*17;
   o.position.x+=(hash(x,z,k)-.5)*C*.85;
   o.position.z+=(hash(z,x,k+11)-.5)*C*.85;
   o.position.y+=.11+.014*hash(n,x,z);
   o.rotation.set(Math.PI/2,.3+hash(n,z,k)*2.7,0);
   o.scale.set(.7, .38+.7*hash(k,x,z),.7);
  },true);
  instances(group,twigGeo,twigMat,cells,level,cells.length<1300?7:3,(o,x,z,n)=>{
   const k=x*113+z*419+n*17;
   o.position.x+=(hash(k,1,7)-.5)*C*.75;
   o.position.z+=(hash(k,2,7)-.5)*C*.75;
   o.position.y+=.134;
   o.rotation.set(Math.PI/2,hash(k,4,7)*Math.PI,0);
   o.scale.set(1,.55+hash(k,3,7)*.58,1);
  },true);
  instances(group,needleGeo,needleMat,cells,level,cells.length<900?8:3,(o,x,z,n)=>{
   const k=x*131+z*53+n*13;
   o.position.x+=(hash(k,5,6)-.5)*C*.9;
   o.position.z+=(hash(k,6,7)-.5)*C*.9;
   o.position.y+=.142;
   o.rotation.set(Math.PI/2.25,hash(k,9,5)*Math.PI*2,0);
   o.scale.set(.7,.45+hash(k,7,6)*.45,.7);
  },true);
  const top=terrain(group,cells,level);
  const blades=cells.length>2500?3:cells.length>900?5:cells.length>300?9:16;
  instances(group,grassGeo,grassMat,cells,level,blades,(o,x,z,n)=>{
   const k=x*997+z*337+n*67;
   o.position.x+=(hash(k,2,10)-.5)*C*.92;
   o.position.z+=(hash(k,5,12)-.5)*C*.92;
   o.position.y+=soilHeight(o.position.x,o.position.z)-.002;
   o.rotation.y=hash(k,3,13)*Math.PI*2;
   const scale=.68+.62*hash(k,4,17);
   o.scale.set(scale,scale,scale);
  },true);
  if(preview&&top){
   const overlay=new THREE.Mesh(top,ghostMat);
   overlay.renderOrder=997;group.add(overlay);
  }
  return group;
 }
 function clear(group){
  for(const item of [...group.children]){
   group.remove(item);
   item.traverse(n=>{
    if(n.isInstancedMesh)n.dispose();
    if(n.geometry?.userData?.roofOwned)n.geometry.dispose();
    if(n.isLine)n.geometry.dispose();
   });
  }
 }
 function setSaved(roofs){
  clear(saved);
  for(const roof of roofs||[]){
   if(!Array.isArray(roof.cells)||!Number.isInteger(roof.level))continue;
   saved.add(assembly(roof.cells,roof.level,false));
  }
  requestRender();
 }
 function setDraft(roof,cells){
  clear(draftLayer);
  if(!roof?.points?.length){requestRender();return;}
  const {points,level}=roof;
  draftLayer.add(assembly(cells,level,true));
  const lines=[];
  for(const [x,z] of points)lines.push((x+.5)*C,level*C+.27,(z+.5)*C);
  if(points.length>1)lines.push(...lines.slice(0,3));
  if(lines.length>=6){
   const lineGeo=new THREE.BufferGeometry();
   lineGeo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
   const line=new THREE.Line(lineGeo,lineMat);
   line.renderOrder=1000;draftLayer.add(line);
  }
  for(const [x,z] of points){
   const marker=new THREE.Mesh(nodeGeo,nodeMat);
   marker.position.set((x+.5)*C,level*C+.285,(z+.5)*C);
   marker.renderOrder=1001;draftLayer.add(marker);
  }
  requestRender();
 }
 function screenVertex(camera,rect,sx,sy,points,level){
  const pos=new THREE.Vector3();
  for(let i=points.length-1;i>=0;i--){
   const [x,z]=points[i];
   pos.set((x+.5)*C,level*C+.285,(z+.5)*C).project(camera);
   if(pos.z<-1||pos.z>1)continue;
   const px=rect.left+(pos.x+1)*rect.width/2,py=rect.top+(1-pos.y)*rect.height/2;
   if(Math.hypot(px-sx,py-sy)<24)return i;
  }
  return -1;
 }
 function dispose(){
  clear(saved);clear(draftLayer);
  root.remove(saved,draftLayer);
  shared.forEach(g=>g.dispose());
  materials.forEach(m=>m.dispose());groundMap.dispose();barkMap.dispose();
 }
 return {setSaved,setDraft,screenVertex,dispose};
}
