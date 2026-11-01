/** AlanTil's traditional turf roof. Dynamic 25cm occupancy, one continuous earthen skin.
 * All visible elements are genuine 3D geometry: irregular pole courses, barley chaff,
 * juniper twigs, packed soil and small grass blades. No per-cell earth boxes.
 */
export function createRoofCoverRenderer(THREE,root,requestRender){
 const C=.25,STEP=4,TOP=.246;
 // All four layers use the exact same occupied 25-cm cells. Adjacent layers overlap 3-6 mm.
 const CHAFF_BOTTOM=.096,CHAFF_TOP=.123,JUNIPER_BOTTOM=.119,JUNIPER_TOP=.155,SOIL_BOTTOM=.150;
 const saved=new THREE.Group(),draftLayer=new THREE.Group();
 root.add(saved,draftLayer);
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
  return Math.max(.237,Math.min(.25,TOP+variation));
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
 const fillMat=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
 const twigMat=new THREE.MeshStandardMaterial({color:0x6b6446,roughness:1});
 const needleMat=new THREE.MeshStandardMaterial({color:0x656c40,roughness:1,side:THREE.DoubleSide});
 const grassMat=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,side:THREE.DoubleSide});
 const clodMat=new THREE.MeshStandardMaterial({color:0x725c43,roughness:1,metalness:0});
 const ghostMat=new THREE.MeshBasicMaterial({color:0x20bd64,transparent:true,opacity:.08,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 const nodeMat=new THREE.MeshBasicMaterial({color:0x22e377,depthTest:false});
 const lineMat=new THREE.LineBasicMaterial({color:0x23e681,depthTest:false});
 const materials=[earthMat,sideMat,poleMat,chaffMat,fillMat,twigMat,needleMat,grassMat,clodMat,ghostMat,nodeMat,lineMat];
 // Make real non-uniform naturally weathered poles; scale length along X for contiguous courses.
 const poleGeo=new THREE.CylinderGeometry(.061,.064,C,13,8,false);
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
 const clodGeo=new THREE.SphereGeometry(.012,7,5);
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
 const shared=[poleGeo,fiberGeo,twigGeo,needleGeo,nodeGeo,grassGeo,clodGeo];
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
   tmp.position.set((start+end+1)*C/2,level*C+.052+(.001*(n-.5)),(z+.5)*C+lane*.062);
   tmp.rotation.set(0,0,0);
   tmp.scale.set(end-start+1,.77+n*.045,1.01+n*.025);
   tmp.updateMatrix();mesh.setMatrixAt(i,tmp.matrix);
   const t=.86+.25*hash(start,end+z,lane+11);
   col.setRGB(t,t,t);mesh.setColorAt(i,col);i++;
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  parent.add(mesh);
 }

 /**
  * Continuous solids over EXACTLY the same cell mask as the timber courses.
  * Each band has a shared-vertex top and underside, plus sides only on exposed
  * cell edges. No polygon clipping and no internal seams or floating layers.
  */
 function solidLayer(parent,cells,level,{name,bottom,top,material,shade,divisions=1}){
  if(!cells.length)return null;
  const occupied=new Set(cells.map(([x,z])=>x+','+z));
  const grid=new Map(),vertices=[],colors=[],uv=[],faces=[];
  const variation=(x,z,y,seed)=>y+(noise(x,z,.17,seed)-.5)*.0018;
  const bottomAt=(x,z)=>variation(x,z,bottom,name==='soil'?39:55);
  const topAt=(x,z)=>name==='soil'?soilHeight(x,z):variation(x,z,top,name==='chaff'?21:37);
  function vertex(gx,gz,upper){
   const key=gx+','+gz+','+Number(upper);
   if(grid.has(key))return grid.get(key);
   const x=gx*C/divisions,z=gz*C/divisions;
   const y=upper?topAt(x,z):bottomAt(x,z);
   const idx=vertices.length/3;
   vertices.push(x,level*C+y,z);
   uv.push(x*1.65,z*1.65);
   const variance=.86+.26*noise(x,z,.12,name==='chaff'?71:85);
   colors.push(shade[0]*variance,shade[1]*variance,shade[2]*variance);
   grid.set(key,idx);return idx;
  }
  const sidePos=[],sideColors=[],sideIndices=[];
  function border(x0,z0,x1,z1,inX,inZ){
   const yTop0=topAt(x0,z0),yTop1=topAt(x1,z1);
   const yBottom0=bottomAt(x0,z0),yBottom1=bottomAt(x1,z1);
   const soil=name==='soil';
   const steps=soil?2:1;
   const shift=soil?.0025*(.65+noise((x0+x1)/2,(z0+z1)/2,.08,63)):0;
   // Soil has a shallow, broken face, not a flat vertical rectangular slab.
   const levels=soil?
    [[x0,yTop0,z0,x1,yTop1,z1],
     [x0+inX*shift,(yTop0+yBottom0)/2,z0+inZ*shift,
      x1+inX*shift,(yTop1+yBottom1)/2,z1+inZ*shift],
     [x0,yBottom0,z0,x1,yBottom1,z1]]:
    [[x0,yTop0,z0,x1,yTop1,z1],[x0,yBottom0,z0,x1,yBottom1,z1]];
   for(let j=0;j<steps;j++){
    const a=levels[j],b=levels[j+1],index=sidePos.length/3;
    sidePos.push(a[0],level*C+a[1],a[2],a[3],level*C+a[4],a[5],
      b[0],level*C+b[1],b[2],b[3],level*C+b[4],b[5]);
    const grit=noise((x0+x1)/2,(z0+z1)/2,.085,19+j);
    const tone=soil?.73+.24*grit:.83+.18*grit;
    const f=j===steps-1?.93:1.04;
    for(let k=0;k<4;k++){
     const fleck=.91+.13*noise(x0+k*.017,z0+k*.029,.061,51);
     sideColors.push(shade[0]*tone*f*fleck,shade[1]*tone*f*fleck,shade[2]*tone*f*fleck);
    }
    sideIndices.push(index,index+1,index+2,index+1,index+3,index+2);
   }
  }
  for(const [x,z] of cells){
   for(let ix=0;ix<divisions;ix++)for(let iz=0;iz<divisions;iz++){
    const a=vertex(x*divisions+ix,z*divisions+iz,true);
    const b=vertex(x*divisions+ix+1,z*divisions+iz,true);
    const c=vertex(x*divisions+ix,z*divisions+iz+1,true);
    const d=vertex(x*divisions+ix+1,z*divisions+iz+1,true);
    faces.push(a,c,b,b,c,d);
    // Closed underside is required to avoid hollow floating material in section views.
    const e=vertex(x*divisions+ix,z*divisions+iz,false);
    const f=vertex(x*divisions+ix+1,z*divisions+iz,false);
    const g=vertex(x*divisions+ix,z*divisions+iz+1,false);
    const h=vertex(x*divisions+ix+1,z*divisions+iz+1,false);
    faces.push(e,f,g,f,h,g);
   }
   const edges=[
    [x-1,z,x*C,z*C,x*C,(z+1)*C,1,0],
    [x+1,z,(x+1)*C,z*C,(x+1)*C,(z+1)*C,-1,0],
    [x,z-1,x*C,z*C,(x+1)*C,z*C,0,1],
    [x,z+1,x*C,(z+1)*C,(x+1)*C,(z+1)*C,0,-1]
   ];
   for(const [nx,nz,ax,az,bx,bz,inX,inZ] of edges)if(!occupied.has(nx+','+nz)){
    for(let k=0;k<divisions;k++){
     const t0=k/divisions,t1=(k+1)/divisions;
     border(ax+(bx-ax)*t0,az+(bz-az)*t0,ax+(bx-ax)*t1,az+(bz-az)*t1,inX,inZ);
    }
   }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(faces);geometry.computeVertexNormals();geometry.userData.roofOwned=true;
  const mesh=new THREE.Mesh(geometry,material);
  mesh.userData.roofLayer=name;
  parent.add(mesh);
  const sides=new THREE.BufferGeometry();
  sides.setAttribute('position',new THREE.Float32BufferAttribute(sidePos,3));
  sides.setAttribute('color',new THREE.Float32BufferAttribute(sideColors,3));
  sides.setIndex(sideIndices);sides.computeVertexNormals();sides.userData.roofOwned=true;
  const side=new THREE.Mesh(sides,sideMat);
  side.userData.roofLayer=name+'-edge';
  parent.add(side);
  return geometry;
 }
 function terrain(parent,cells,level){
  solidLayer(parent,cells,level,{name:'chaff',bottom:CHAFF_BOTTOM,top:CHAFF_TOP,
    material:fillMat,shade:[.67,.54,.33]});
  solidLayer(parent,cells,level,{name:'juniper',bottom:JUNIPER_BOTTOM,top:JUNIPER_TOP,
    material:fillMat,shade:[.33,.38,.24]});
  return solidLayer(parent,cells,level,{name:'soil',bottom:SOIL_BOTTOM,top:TOP,
    material:earthMat,shade:[.48,.37,.24],divisions:STEP});
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
  // Small real three-dimensional earth clods interrupt the former flat slab silhouette.
  const clods=cells.length>2500?1:cells.length>900?2:4;
  instances(group,clodGeo,clodMat,cells,level,clods,(o,x,z,n)=>{
   const k=x*173+z*367+n*71;
   o.position.x+=(hash(k,2,31)-.5)*C*.88;
   o.position.z+=(hash(k,5,37)-.5)*C*.88;
   o.position.y+=soilHeight(o.position.x,o.position.z)-.001;
   o.scale.set(.65+hash(k,3,43)*.9,.24+hash(k,4,47)*.36,.7+hash(k,6,53)*.8);
   o.rotation.y=hash(k,1,59)*Math.PI*2;
  },true);
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
  const disposed=new Set();
  for(const item of [...group.children]){
   group.remove(item);
   item.traverse(n=>{
    if(n.isInstancedMesh)n.dispose();
    const geometry=n.geometry;
    if((geometry?.userData?.roofOwned||n.isLine)&&!disposed.has(geometry)){
     geometry.dispose();disposed.add(geometry);
    }
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
