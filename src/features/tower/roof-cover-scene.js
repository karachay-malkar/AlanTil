/** Rendered roof modules: actual 3D wood, chaff, juniper, earth and grass.
 * Source geometry is a single 25cm cell, instanced over a deterministic polygon mask.
 */
export function createRoofCoverRenderer(THREE,root,requestRender){
 const C=.25;
 const soilGeo=new THREE.BoxGeometry(C,.10,C);
 const strawGeo=new THREE.BoxGeometry(C,.02,C);
 const scrubGeo=new THREE.CylinderGeometry(.004,.005,.27,4,2);
 scrubGeo.rotateZ(-Math.PI/2);
 const logGeo=new THREE.CylinderGeometry(.048,.054,.25,9,2);
 logGeo.rotateZ(-Math.PI/2);
 const grassGeo=new THREE.ConeGeometry(.012,.058,3);
 const highlightGeo=new THREE.BoxGeometry(C,.007,C);
 const nodeGeo=new THREE.SphereGeometry(.11,12,8);
 const woodMat=new THREE.MeshStandardMaterial({color:'#977048',roughness:.96});
 const strawMat=new THREE.MeshStandardMaterial({color:'#b5a072',roughness:1});
 const twigMat=new THREE.MeshStandardMaterial({color:'#687048',roughness:1});
 const earthMat=new THREE.MeshStandardMaterial({color:'#897352',roughness:1});
 const grassMat=new THREE.MeshStandardMaterial({color:'#70934f',roughness:1,side:THREE.DoubleSide});
 const draftMat=new THREE.MeshBasicMaterial({color:'#16ce69',transparent:true,opacity:.19,depthWrite:false});
 const nodeMat=new THREE.MeshBasicMaterial({color:'#19df75',depthTest:false});
 const lineMat=new THREE.LineBasicMaterial({color:'#17db6b',depthTest:false});
 const geometries=[soilGeo,strawGeo,scrubGeo,logGeo,grassGeo,highlightGeo,nodeGeo];
 const materials=[woodMat,strawMat,twigMat,earthMat,grassMat,draftMat,nodeMat,lineMat];
 const tmp=new THREE.Object3D(),col=new THREE.Color();
 const saved=new THREE.Group(),draftLayer=new THREE.Group();
 root.add(saved,draftLayer);
 function rand(seed){const t=Math.sin(seed*127.1+311.7)*43758.5453;return t-Math.floor(t);}
 function instance(group,geometry,material,cells,level,repeat,place,colors=false){
  if(!cells.length)return;
  const mesh=new THREE.InstancedMesh(geometry,material,cells.length*repeat);
  mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  let i=0;
  for(const [x,z] of cells){
   for(let part=0;part<repeat;part++){
    tmp.position.set((x+.5)*C,level*C,(z+.5)*C);
    tmp.scale.set(1,1,1);tmp.rotation.set(0,0,0);
    place(tmp,x,z,part);
    tmp.updateMatrix();mesh.setMatrixAt(i,tmp.matrix);
    if(colors){
     const f=.79+.19*rand(x*39+z*71+part*17);
     col.setRGB(f,f,f);mesh.setColorAt(i,col);
    }
    i++;
   }
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.userData.roofGeometry=true;
  group.add(mesh);
 }
 /** Merge adjacent 25-cm log segments into continuous natural poles along X. */
 function poles(group,cells,level){
  const rows=new Map();
  for(const [x,z] of cells){if(!rows.has(z))rows.set(z,[]);rows.get(z).push(x);}
  const runs=[];
  for(const [z,xs] of rows){
   xs.sort((a,b)=>a-b);
   let start=xs[0],end=start;
   for(const x of xs.slice(1)){
    if(x===end+1){end=x;continue;}
    runs.push([start,end,z]);start=end=x;
   }
   runs.push([start,end,z]);
  }
  const mesh=new THREE.InstancedMesh(logGeo,woodMat,runs.length*2);
  mesh.frustumCulled=false;
  let i=0;
  for(const [start,end,z] of runs)for(const offset of [-.059,.059]){
   tmp.position.set((start+(end-start+1)/2)*C,level*C+.05,(z+.5)*C+offset);
   tmp.scale.set(end-start+1,1,1);tmp.rotation.set(0,0,0);tmp.updateMatrix();
   mesh.setMatrixAt(i,tmp.matrix);
   const f=.83+.12*rand(start*15+end*17+z*31+offset*59);
   col.setRGB(f,f,f);mesh.setColorAt(i,col);i++;
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  group.add(mesh);
 }
 function assembly(cells,level,ghost=false){
  const group=new THREE.Group();if(!cells.length)return group;
  poles(group,cells,level);
  instance(group,strawGeo,strawMat,cells,level,1,o=>{o.position.y+=.11;},true);
  instance(group,scrubGeo,twigMat,cells,level,3,(o,x,z,i)=>{
   o.position.y+=.135;o.position.z+=(i-1)*.064;
   o.rotation.y=(rand(x*23+z*17+i)-.5)*.30;
  },true);
  instance(group,soilGeo,earthMat,cells,level,1,o=>{o.position.y+=.20;});
  instance(group,grassGeo,grassMat,cells,level,4,(o,x,z,i)=>{
   const seed=x*97+z*31+i*47;
   o.position.y+=.25+.021*rand(seed);
   o.position.x+=(rand(seed+13)-.5)*.192;
   o.position.z+=(rand(seed+71)-.5)*.194;
   o.scale.set(.65+rand(seed+33)*.7,.65+rand(seed+55)*.7,.65+rand(seed+33)*.7);
  },true);
  if(ghost)instance(group,highlightGeo,draftMat,cells,level,1,o=>{o.position.y+=.254;});
  return group;
 }
 function clear(group){
  for(const item of [...group.children]){
   group.remove(item);
   item.traverse(n=>{
    if(n.isInstancedMesh)n.dispose();
    else if(n.isLine)n.geometry.dispose();
   });
  }
 }
 function setSaved(roofs){
  clear(saved);
  for(const roof of roofs||[]){
   if(!Array.isArray(roof.cells)||!Number.isInteger(roof.level))continue;
   const section=assembly(roof.cells,roof.level,false);
   section.userData.roofId=roof.id;saved.add(section);
  }
  requestRender();
 }
 function setDraft(roof,cells){
  clear(draftLayer);
  if(!roof?.points?.length){requestRender();return;}
  const {points,level}=roof;
  draftLayer.add(assembly(cells,level,true));
  const pos=[];
  for(const [x,z] of points)pos.push((x+.5)*C,level*C+.27,(z+.5)*C);
  if(points.length>=2)pos.push(pos[0],pos[1],pos[2]);
  if(pos.length>=6){
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
   const line=new THREE.Line(g,lineMat);line.renderOrder=1000;draftLayer.add(line);
  }
  for(const [x,z] of points){
   const n=new THREE.Mesh(nodeGeo,nodeMat);
   n.position.set((x+.5)*C,level*C+.28,(z+.5)*C);
   n.renderOrder=1001;draftLayer.add(n);
  }
  requestRender();
 }
 function screenVertex(camera,rect,screenX,screenY,points,level){
  const pos=new THREE.Vector3();
  for(let i=points.length-1;i>=0;i--){
   const [x,z]=points[i];pos.set((x+.5)*C,level*C+.28,(z+.5)*C).project(camera);
   if(pos.z>1||pos.z< -1)continue;
   const px=rect.left+(pos.x+1)*rect.width/2,py=rect.top+(1-pos.y)*rect.height/2;
   if(Math.hypot(px-screenX,py-screenY)<24)return i;
  }
  return -1;
 }
 function dispose(){
  clear(saved);clear(draftLayer);root.remove(saved,draftLayer);
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 }
 return {setSaved,setDraft,screenVertex,dispose};
}
