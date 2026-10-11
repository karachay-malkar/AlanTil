import * as THREE from '../../vendor/three/three.module.js';
import { OrbitControls } from '../../vendor/three/addons/controls/OrbitControls.js';
import {ROCK_PACK} from '../../../assets/tower/processed-rocks.mjs';
import {generateMasonry} from '../../../packages/tower-game/masonry.mjs?v=17.0.4';

const CELL=.25;
const ROOT=new URL('../../../',import.meta.url);
const dimensions=b=> b.rotation===4?[b.sy,b.sx,b.sz]:b.rotation===5?[b.sx,b.sz,b.sy]:b.rotation%2?[b.sz,b.sy,b.sx]:[b.sx,b.sy,b.sz];
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

/** Local assets only. Coordinates are integer cells with y pointing up. */
export async function createTowerScene(container,{onPick=()=>{},onSelection=()=>{}}={}){
 const scene=new THREE.Scene(); scene.background=new THREE.Color('#afc6b9');scene.fog=new THREE.Fog('#afc6b9',34,100);
 const geometries=[],materials=[],textures=[];const keepG=g=>(geometries.push(g),g);const keepM=m=>(materials.push(m),m);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(max-width:749px), (max-height:520px)').matches?1.25:1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.setAttribute('aria-label','Трёхмерная стройка башни');renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none;';container.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(42,1,.1,180);camera.position.set(17,12,20);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(7.5,1,7.5);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=2;controls.maxDistance=48;controls.maxPolarAngle=Math.PI*.485;
 scene.add(new THREE.HemisphereLight('#e7f4ff','#695d41',2.3));
 const sun=new THREE.DirectionalLight('#fff1dc',3.3);sun.position.set(-9,24,14);sun.castShadow=true;sun.shadow.mapSize.set(matchMedia('(max-width:749px), (max-height:520px)').matches?1024:2048,matchMedia('(max-width:749px), (max-height:520px)').matches?1024:2048);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:.5,far:70});sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;sun.target.position.set(7.5,0,7.5);scene.add(sun,sun.target);
 // The playable 60x60 ground is grass with an unobtrusive quarter-metre grid.
 function grassTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#719b60';ctx.fillRect(0,0,512,512);
  let seed=71927;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<20000;i++){
   const x=random()*512,y=random()*512,l=.5+random()*2.7;
   ctx.fillStyle=['#62894e','#87ab6c','#7da665','#587d48','#a2b780'][Math.floor(random()*5)];
   ctx.globalAlpha=.16+random()*.23;ctx.fillRect(x,y,l,l*.75);
  }
  ctx.globalAlpha=1;const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(11,11);
  map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.push(map);return map;
 }
 const meadowMap=grassTexture(),outer=keepG(new THREE.PlaneGeometry(145,145,64,64));outer.rotateX(-Math.PI/2);
 const positions=outer.attributes.position;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),z=positions.getZ(i),beyond=Math.max(0,Math.max(Math.abs(x),Math.abs(z))-10.5);
  const swelling=Math.min(1,beyond/11);
  positions.setY(i,-.28+swelling*(1.8+Math.sin(x*.18)*.9+Math.cos(z*.23)*.65+Math.sin((x-z)*.11)*.75));
 }
 outer.computeVertexNormals();
 const grassMaterial=keepM(new THREE.MeshStandardMaterial({color:'#b2cf97',map:meadowMap,roughness:1,metalness:0}));
 const ground=new THREE.Mesh(outer,grassMaterial);ground.position.set(7.5,0,7.5);ground.receiveShadow=true;scene.add(ground);
 const platform=new THREE.Mesh(new THREE.BoxGeometry(15,.12,15),[
  new THREE.MeshStandardMaterial({color:'#698950',roughness:1}),new THREE.MeshStandardMaterial({color:'#698950',roughness:1}),
  new THREE.MeshStandardMaterial({color:'#bbd6a6',map:meadowMap,roughness:1}),new THREE.MeshStandardMaterial({color:'#755b40',roughness:1}),
  new THREE.MeshStandardMaterial({color:'#668b55',roughness:1}),new THREE.MeshStandardMaterial({color:'#668b55',roughness:1})]);
 platform.position.set(7.5,-.065,7.5);platform.receiveShadow=true;scene.add(platform);
 const grid=new THREE.GridHelper(15,60,'#d2e1bc','#deead3');grid.position.set(7.5,.003,7.5);
 grid.material.transparent=true;grid.material.opacity=.12;grid.material.depthWrite=false;scene.add(grid);
 // Distant layered ridges, kept outside the build area; no fictitious named peak.
 for(let ridge=0;ridge<3;ridge++){
  const points=[],indices=[],count=28;for(let i=0;i<count;i++){const x=-45+i*4;const h=5+hash(i+ridge*73)*11+ridge*4;points.push(x,-.2,-22-ridge*12,x,h,-22-ridge*12);if(i<count-1){let j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();scene.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:['#6c806d','#829282','#9aada1'][ridge],roughness:1,side:THREE.DoubleSide})));
 }
 // Stylized rocky gorge outside the buildable grass clearing.
 for(const side of [-1,1]){
  const vertices=[],faces=[],segments=42,step=3.3;
  for(let i=0;i<segments;i++){
   const z=-63+i*step,low=-.3+hash(i+side*53)*1.3,high=9+hash(i*3+side*131)*10;
   vertices.push(side<0?-16:31,low,z,side<0?-38:53,high,z);
   if(i<segments-1){const a=i*2;faces.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const cliff=keepG(new THREE.BufferGeometry());cliff.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  cliff.setIndex(faces);cliff.computeVertexNormals();
  scene.add(new THREE.Mesh(cliff,keepM(new THREE.MeshStandardMaterial({color:side<0?'#899184':'#7f8d85',roughness:1,side:THREE.DoubleSide,flatShading:true}))));
 }
 const box=keepG(new THREE.BoxGeometry(1,1,1));
 const timberLog=keepG(new THREE.CylinderGeometry(.32,.35,1,9));timberLog.rotateZ(-Math.PI/2);
 const rail=keepG(new THREE.CylinderGeometry(.022,.027,1,7));
 const stoneMaterial=keepM(new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.96,metalness:0,vertexColors:true,flatShading:true}));
 const woodMaterial=keepM(new THREE.MeshStandardMaterial({color:'#6e4c30',roughness:.85}));
 const mortarMaterial=keepM(new THREE.MeshStandardMaterial({color:'#8a8473',roughness:1}));
 const frameStone=keepM(new THREE.MeshStandardMaterial({color:'#938d7d',roughness:1,metalness:0}));
 const darkMaterial=keepM(new THREE.MeshStandardMaterial({color:'#292725',roughness:.8}));
 const loader=new THREE.TextureLoader();
 async function texture(path,srgb=false){try{const t=await loader.loadAsync(new URL(path,ROOT).href);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.push(t);return t;}catch{return null;}}
 // The 23 repaired meshes come from the supplied FBX/GLB set.
 // They are quantized only for transport; topology and hand-adjusted contours remain intact.
 const stoneTemplates={};
 for(const [category,entries] of Object.entries(ROCK_PACK)){
  stoneTemplates[category]=entries.map(([count,faceCount,base,alternate,encoded],variant)=>{
   const binary=atob(encoded),bytes=new Uint8Array(binary.length);
   for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
   if(bytes.length!==count*3+faceCount*3)throw new Error('Некорректная геометрия камня');
   const coords=new Float32Array(count*3),colors=new Float32Array(count*3);
   const color=new THREE.Color();
   for(let i=0;i<count;i++){
    const x=bytes[3*i]/255,y=bytes[3*i+2]/255,z=bytes[3*i+1]/255;
    coords.set([x-.5,y-.5,z-.5],i*3);
    const wave=(Math.sin(x*11.7+z*7.3+variant*.87)+Math.cos(y*8.4-x*9.1))*.12;
    const blend=THREE.MathUtils.clamp(.48+wave,0,1);
    const shade=.92+.07*y;
    color.setRGB(
     (base[0]*(1-blend)+alternate[0]*blend)*shade/255,
     (base[1]*(1-blend)+alternate[1]*blend)*shade/255,
     (base[2]*(1-blend)+alternate[2]*blend)*shade/255,
     THREE.SRGBColorSpace);
    color.toArray(colors,i*3);
   }
   const indices=new Uint16Array(faceCount*3),offset=count*3;
   for(let i=0;i<faceCount;i++){
    indices[3*i]=bytes[offset+3*i];
    // Source axes are Z-up, so swapping axes reverses triangle winding.
    indices[3*i+1]=bytes[offset+3*i+2];
    indices[3*i+2]=bytes[offset+3*i+1];
   }
   const g=keepG(new THREE.BufferGeometry());
   g.setAttribute('position',new THREE.BufferAttribute(coords,3));
   g.setAttribute('color',new THREE.BufferAttribute(colors,3));
   g.setIndex(new THREE.BufferAttribute(indices,1));
   // Every facet casts light naturally, without arbitrary extra stone decals.
   const flat=keepG(g.toNonIndexed());flat.computeVertexNormals();
   return {g:flat,m:stoneMaterial,variant};
  });
 }
 const woodMap=await texture('assets/tower/modular_wooden_pier/textures/modular_wooden_pier_planks_diff_1k.jpg',true);if(woodMap){woodMaterial.map=woodMap;woodMaterial.color.set('#a99a85');woodMaterial.needsUpdate=true;}
 const [woodNormal,woodArm]=await Promise.all([texture('assets/tower/modular_wooden_pier/textures/modular_wooden_pier_planks_nor_gl_1k.jpg'),texture('assets/tower/modular_wooden_pier/textures/modular_wooden_pier_planks_arm_1k.jpg')]);if(woodNormal){woodMaterial.normalMap=woodNormal;woodMaterial.normalScale.set(.45,.45);}if(woodArm)woodMaterial.roughnessMap=woodArm;woodMaterial.needsUpdate=true;
 let blocks=[],layer=null,tool='place',disposed=false,groups=[],pickables=[];
 const clipPlane=new THREE.Plane(new THREE.Vector3(0,-1,0),0);
 const content=new THREE.Group();scene.add(content);
 const preview=new THREE.Group();preview.visible=false;preview.renderOrder=5;scene.add(preview);
 const previewModel=new THREE.Group();preview.add(previewModel);
 let previewBlock=null,ghostTween=null;
 const previewEdgeMaterial=keepM(new THREE.LineBasicMaterial({color:'#e5f0e9',transparent:true,opacity:.65,depthTest:false}));
 const edges=new THREE.LineSegments(keepG(new THREE.EdgesGeometry(box)),previewEdgeMaterial);preview.add(edges);
 let previewType='',previewMaterials=[];
 const contact=new THREE.Mesh(keepG(new THREE.RingGeometry(.44,.51,48)),keepM(new THREE.MeshBasicMaterial({color:'#eaf1d8',side:THREE.DoubleSide,transparent:true,opacity:.62,depthWrite:false})));
 contact.rotation.x=-Math.PI/2;contact.renderOrder=7;contact.visible=false;scene.add(contact);
 const selection=new THREE.Box3Helper(new THREE.Box3(),'#c9e7aa');selection.visible=false;scene.add(selection);
 function transform(b){const d=dimensions(b);return {d,p:new THREE.Vector3((b.x+d[0]/2)*CELL,(b.y+d[1]/2)*CELL,(b.z+d[2]/2)*CELL)};}
 function parts(type){
  if(type==='window')return [
   [box,frameStone,[-.43,0,0],[.14,1,.72]],[box,frameStone,[.43,0,0],[.14,1,.72]],
   [box,frameStone,[0,.45,0],[.86,.11,.86]],[box,frameStone,[0,-.45,0],[.86,.11,.74]],
   [box,woodMaterial,[0,.02,.36],[.018,.78,.05]]
  ];
  if(type==='door')return [
   [box,frameStone,[-.45,0,0],[.12,1,.85]],[box,frameStone,[.45,0,0],[.12,1,.85]],
   [box,frameStone,[0,.45,0],[.9,.11,.94]],
   [box,woodMaterial,[0,-.48,.10],[.86,.04,.75]]
  ];
  if(type==='stairs'||type==='ladder'){
   const result=[[rail,woodMaterial,[-.36,0,0],[1,1,1]],[rail,woodMaterial,[.36,0,0],[1,1,1]]];
   for(let i=0;i<11;i++)result.push([box,woodMaterial,[0,-.42+i*.084,0],[.78,.026,.15]]);
   return result;
  }
  if(type==='beam')return [[timberLog,woodMaterial,[0,0,0],[1,.72,.72]]];
  if(type==='deck'||type==='floor'||type==='plank'){const result=[];for(let i=0;i<8;i++)result.push([box,woodMaterial,[-.4375+i*.125,0,0],[.12,1,1]]);return result;}
  if(type==='roof')return [[roofGeometry,roofMaterial,[0,0,0],[1,1,1]]];
  return [[box,woodMaterial,[0,0,0],[1,1,1]]];
 }
 const roofGeometry=keepG(new THREE.BufferGeometry());
 const roofPositions=[-.5,-.5,-.5,.5,-.5,-.5,0,.5,-.5,-.5,-.5,.5,0,.5,.5,.5,-.5,.5];
 roofGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roofPositions,3));roofGeometry.setIndex([0,1,2,3,4,5,0,2,4,0,4,3,1,5,4,1,4,2,0,3,5,0,5,1]);roofGeometry.computeVertexNormals();
 const roofMaterial=keepM(new THREE.MeshStandardMaterial({color:'#615f52',roughness:.92,map:woodMap||null}));
 function stoneCategory(type){return type==='stone'?'small':type;}
 function orientation(block,quat=new THREE.Quaternion()){
  const r=block.rotation||0;
  if(r===4)return quat.setFromAxisAngle(new THREE.Vector3(0,0,1),-Math.PI/2);
  if(r===5)return quat.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  return quat.setFromAxisAngle(new THREE.Vector3(0,1,0),r*Math.PI/2);
 }
 function previewMeshes(b){
  const stone=CATALOG_STONES.has(b.type);
  const variants=stoneTemplates[stoneCategory(b.type)]||[];const template=stone?variants[(b.variant||0)%Math.max(variants.length,1)]:null;
  return stone?[[template?.g||box,template?.m||stoneMaterial,[0,0,0],[1,1,1]]]:parts(b.type);
 }
 function clearPreview(){
  for(const child of [...previewModel.children])previewModel.remove(child);
  for(const m of previewMaterials)m.dispose();
  previewMaterials=[];previewType='';
 }
 function updateGhost(b,valid){
  const d=dimensions(b),key=[b.type,b.sx,b.sy,b.sz,b.rotation,b.variant||0].join(':');
  if(key!==previewType){
   const turning=previewBlock&&previewBlock.type===b.type&&previewBlock.sx===b.sx&&previewBlock.sy===b.sy&&previewBlock.sz===b.sz&&previewBlock.variant===b.variant&&previewBlock.rotation!==b.rotation;
   const current=turning?previewModel.quaternion.clone().multiply(orientation(previewBlock)):null;
   clearPreview();
   const q=orientation(b),scale=new THREE.Vector3(...[b.sx,b.sy,b.sz].map(v=>v*CELL));
   if(turning){previewModel.quaternion.copy(current).multiply(q.clone().invert());ghostTween={from:previewModel.quaternion.clone(),started:performance.now()};}
   else {previewModel.quaternion.identity();ghostTween=null;}
   if(b.type==='door'||b.type==='window')scale.z=.25;
   if(b.type==='deck')scale.y=.065;
   for(const [geometry,material,offset,factor] of previewMeshes(b)){
    const translucent=material.clone();translucent.transparent=true;translucent.depthWrite=false;translucent.side=THREE.DoubleSide;translucent.vertexColors=false;translucent.flatShading=true;previewMaterials.push(translucent);
    const mesh=new THREE.Mesh(geometry,translucent);
    mesh.position.set(...offset).multiply(scale).applyQuaternion(q);
    mesh.quaternion.copy(q);mesh.scale.copy(scale).multiply(new THREE.Vector3(...factor));mesh.renderOrder=6;
    previewModel.add(mesh);
   }
   previewType=key;
  }
  for(const material of previewMaterials){material.opacity=valid?.43:.24;material.color.set(valid?'#f6f6ec':'#ee8b80');}
  edges.material.color.set(valid?'#e8f5ec':'#da6254');
  edges.position.set(0,0,0);edges.rotation.set(0,0,0);edges.scale.set(...d.map(v=>v*CELL*1.012));
  if(b.type==='deck')edges.scale.y=.075;
  if(b.type==='door'||b.type==='window')edges.scale.z=.28;
  preview.position.set((b.x+d[0]/2)*CELL,(b.y+d[1]/2)*CELL,(b.z+d[2]/2)*CELL);
  if(b.type==='deck')preview.position.y=b.y*CELL+.0325;
  previewBlock={...b};
  contact.position.set((b.x+d[0]/2)*CELL,b.y*CELL+.007,(b.z+d[2]/2)*CELL);
  contact.scale.set(d[0]*CELL*.96,d[2]*CELL*.96,1);
  contact.material.color.set(valid?'#e3f2cc':'#e68d79');contact.visible=true;
 }
 const CATALOG_STONES=new Set(['stone','medium','long','big']);
 let loadedOnce=false,settling=null;
 function rebuild(){
  if(settling)settling.parts=[];
  for(const instance of groups){content.remove(instance);instance.dispose?.();}
  groups=[];pickables=[];
  const buckets=new Map();
  for(const block of blocks){
   if(layer!==null&&block.y>layer)continue;
   const stone=CATALOG_STONES.has(block.type);
   const count=stoneTemplates[stoneCategory(block.type)]?.length||1;
   const variant=((block.variant||0)%count+count)%count;
   const key=stone?`stone:${block.type}:${variant}`:block.type;
   if(!buckets.has(key))buckets.set(key,[]);
   buckets.get(key).push(block);
  }
  for(const [key,list] of buckets){
   const stone=key.startsWith('stone:');
   const type=stone?key.split(':')[1]:key;
   const template=stone?stoneTemplates[stoneCategory(type)]?.[Number(key.split(':')[2])]:null;
   const templates=stone?[[template?.g||box,template?.m||stoneMaterial,[0,0,0],[1,1,1]]]:parts(type);
   for(const [g,mat,offset,factor] of templates){
    mat.clippingPlanes=layer===null?[]:[clipPlane];mat.clipShadows=true;mat.needsUpdate=true;
    const instances=new THREE.InstancedMesh(g,mat,list.length);
    instances.castShadow=true;instances.receiveShadow=true;instances.userData.blocks=list;
    const matrix=new THREE.Matrix4(),quat=new THREE.Quaternion();
    list.forEach((block,i)=>{
     const {d,p}=transform(block);orientation(block,quat);
     const scale=new THREE.Vector3(...[block.sx,block.sy,block.sz].map(v=>v*CELL));
     if(type==='window'||type==='door')scale.z=.25;
     if(type==='deck'||type==='floor'||type==='plank'){scale.y=.065;p.y=block.y*CELL+.0325;}
     const local=new THREE.Vector3(...offset).multiply(scale).applyQuaternion(quat);
     p.add(local);scale.multiply(new THREE.Vector3(...factor));
     matrix.compose(p,quat,scale);
     if(settling&&block.id===settling.id){
      const base=matrix.clone(),raised=matrix.clone();raised.elements[13]+=.24;
      instances.setMatrixAt(i,raised);settling.parts.push({mesh:instances,index:i,base});
     }else instances.setMatrixAt(i,matrix);
     instances.setColorAt(i,stone?new THREE.Color('#ffffff'):new THREE.Color().setHSL(.085,.12,.67+hash((block.variant||0)+block.x*61+block.y*367+block.z*997)*.08));
    });
    instances.instanceMatrix.needsUpdate=true;instances.computeBoundingSphere();
    content.add(instances);groups.push(instances);pickables.push(instances);
   }
  }
  // These stones are a disposable visual projection, never purchasable blocks.
  const pebbles=generateMasonry(blocks,{layer,maxStones:Math.min(12000,Math.max(400,blocks.length*9))});
  const variants=stoneTemplates.small||[];
  if(variants.length){
   const batches=new Map();
   for(const pebble of pebbles){const v=pebble.variant%variants.length;if(!batches.has(v))batches.set(v,[]);batches.get(v).push(pebble);}
   for(const [variant,items] of batches){
    const entry=variants[variant],mesh=new THREE.InstancedMesh(entry.g,entry.m,items.length);
    mesh.castShadow=false;mesh.receiveShadow=true;
    const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
    for(let i=0;i<items.length;i++){
     const p=items[i];q.setFromAxisAngle(up,p.rotation);
     matrix.compose(new THREE.Vector3(p.x*CELL,p.y*CELL,p.z*CELL),q,new THREE.Vector3(p.sx*CELL,p.sy*CELL,p.sz*CELL));
     mesh.setMatrixAt(i,matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();content.add(mesh);groups.push(mesh);
   }
  }
 }
 const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let down=null;const pointers=new Set();
 function pickAt(clientX,clientY){
  const r=renderer.domElement.getBoundingClientRect();
  if(clientX<r.left||clientX>r.right||clientY<r.top||clientY>r.bottom||!r.width||!r.height)return null;
  mouse.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);
  const hit=ray.intersectObjects([...pickables,platform],false).find(h=>layer===null||h.point.y<=(layer+1)*CELL+.0001);
  if(!hit)return null;
  const b=hit.object.userData.blocks?.[hit.instanceId];
  const n=b?hit.face.normal.clone():new THREE.Vector3(0,1,0);
  if(b){
   const m=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,m);
   n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(m)).normalize();
   const values=[Math.abs(n.x),Math.abs(n.y),Math.abs(n.z)],axis=values.indexOf(Math.max(...values));
   n.set(axis===0?Math.sign(n.x):0,axis===1?Math.sign(n.y):0,axis===2?Math.sign(n.z):0);
  }
  const normal={x:Math.round(n.x),y:Math.round(n.y),z:Math.round(n.z)};
  const p=hit.point.clone().addScaledVector(n,.001);
  let x=Math.floor(p.x/CELL),y=Math.floor(p.y/CELL),z=Math.floor(p.z/CELL);
  if(b){
   const d=dimensions(b);
   if(normal.x)x=normal.x>0?b.x+d[0]:b.x-1;
   if(normal.y)y=normal.y>0?b.y+d[1]:b.y-1;
   if(normal.z)z=normal.z>0?b.z+d[2]:b.z-1;
  }else y=0;
  return {x,y,z,blockId:b?.id??null,normal};
 }
 function pointerDown(e){pointers.add(e.pointerId);if(pointers.size===1)down={pointerId:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()};else down=null;}
 function pointerUp(e){
  pointers.delete(e.pointerId);
  if(!down||pointers.size||down.pointerId!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||performance.now()-down.t>650){down=null;return;}
  down=null;
  const hit=pickAt(e.clientX,e.clientY);if(!hit)return;
  if(tool==='select'){
   onSelection(hit.blockId);
   const b=blocks.find(q=>q.id===hit.blockId);
   if(b){const {d,p}=transform(b);selection.box=new THREE.Box3(p.clone().sub(new THREE.Vector3(...d.map(v=>v*CELL/2))),p.clone().add(new THREE.Vector3(...d.map(v=>v*CELL/2))));selection.updateMatrixWorld();selection.visible=true;}
   else selection.visible=false;
   return;
  }
  onPick(hit);
 }
 function pointerCancel(e){pointers.delete(e.pointerId);down=null;}
 renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointercancel',pointerCancel);
 function contextLost(e){e.preventDefault();container.dataset.contextLost='true';}function contextRestored(){delete container.dataset.contextLost;}
 renderer.domElement.addEventListener('webglcontextlost',contextLost);renderer.domElement.addEventListener('webglcontextrestored',contextRestored);
 function resize(){const w=Math.max(container.clientWidth,1),h=Math.max(container.clientHeight,300);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}const observer=new ResizeObserver(resize);observer.observe(container);resize();
 let frame;function animate(time=performance.now()){
  if(disposed)return;frame=requestAnimationFrame(animate);
  if(ghostTween){
   const t=Math.min(1,(time-ghostTween.started)/240);
   previewModel.quaternion.slerpQuaternions(ghostTween.from,new THREE.Quaternion(),1-Math.pow(1-t,3));
   if(t>=1)ghostTween=null;
  }
  if(settling){
   const t=Math.min(1,(time-settling.started)/320),offset=.24*Math.pow(1-t,3);
   for(const part of settling.parts){const m=part.base.clone();m.elements[13]+=offset;part.mesh.setMatrixAt(part.index,m);part.mesh.instanceMatrix.needsUpdate=true;}
   if(t>=1)settling=null;
  }
  if(flight){
   const t=Math.min(1,(time-flight.started)/flight.duration),ease=t*t*(3-2*t);
   controls.target.lerpVectors(flight.fromTarget,flight.toTarget,ease);
   camera.position.lerpVectors(flight.fromPosition,flight.toPosition,ease);
   if(t>=1)flight=null;
  }
  controls.update();renderer.render(scene,camera);
 }animate();container.dataset.ready="true";
 const thumbnailCache=new Map();
 function thumbnail(type,variant=0){
  const key=type+':'+variant;if(thumbnailCache.has(key))return thumbnailCache.get(key);
  const thumbScene=new THREE.Scene();thumbScene.background=new THREE.Color('#e3e9dd');
  thumbScene.add(new THREE.AmbientLight('#ffffff',2));
  const light=new THREE.DirectionalLight('#fff6e1',3.3);light.position.set(-3,7,8);thumbScene.add(light);
  const group=new THREE.Group();thumbScene.add(group);
  const variants=stoneTemplates[stoneCategory(type)]||[];
  const template=variants.length?variants[variant%variants.length]:null;
  const source=template?[[template.g,template.m,[0,0,0],[1,1,1]]]:parts(type);
  for(const [geo,material,offset,factor]of source){const mesh=new THREE.Mesh(geo,material);mesh.position.set(...offset);mesh.scale.set(...factor);group.add(mesh);}
  group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  group.position.sub(center);group.scale.setScalar(1.25/Math.max(size.x,size.y,size.z,.01));
  const miniCamera=new THREE.PerspectiveCamera(38,1,.1,10);miniCamera.position.set(2.2,1.65,2.6);miniCamera.lookAt(0,0,0);
  const target=new THREE.WebGLRenderTarget(112,112),pixels=new Uint8Array(112*112*4),prev=renderer.getRenderTarget();
  try{
   renderer.setRenderTarget(target);renderer.setViewport(0,0,112,112);renderer.render(thumbScene,miniCamera);
   renderer.readRenderTargetPixels(target,0,0,112,112,pixels);
   const canvas=document.createElement('canvas');canvas.width=canvas.height=112;
   const ctx=canvas.getContext('2d'),img=ctx.createImageData(112,112);
   for(let y=0;y<112;y++)img.data.set(pixels.subarray((111-y)*448,(112-y)*448),y*448);
   ctx.putImageData(img,0,0);const result=canvas.toDataURL('image/png');thumbnailCache.set(key,result);return result;
  }finally{renderer.setRenderTarget(prev);target.dispose();resize();}
 }
 let flight=null;
 const cancelFlight=()=>{flight=null;};
 controls.addEventListener('start',cancelFlight);
 function flyTo(target,position,duration=480){
  flight={fromTarget:controls.target.clone(),fromPosition:camera.position.clone(),toTarget:target.clone(),toPosition:position.clone(),started:performance.now(),duration};
 }
 function screenPosition(b){
  if(!b||disposed)return null;
  const {d,p}=transform(b);p.y=b.y*CELL+d[1]*CELL+.17;
  const projection=p.project(camera);if(projection.z>1||projection.z< -1)return null;
  return{x:(projection.x+1)*container.clientWidth/2,y:(1-projection.y)*container.clientHeight/2};
 }
 return {setBlocks(value){const incoming=value||[];const ids=new Set(blocks.map(b=>b.id));const added=loadedOnce?incoming.find(b=>!ids.has(b.id)):null;settling=added?{id:added.id,started:performance.now(),parts:[]}:null;loadedOnce=true;blocks=incoming;selection.visible=false;rebuild();},setPreview(b,valid=true){preview.visible=!!b;contact.visible=!!b;if(!b){previewBlock=null;ghostTween=null;return;}updateGhost(b,valid);},thumbnail,screenPosition,pickAt(clientX,clientY){return pickAt(clientX,clientY);},setLayer(y){layer=y;clipPlane.constant=y===null?0:(y+1)*CELL;rebuild();},setTool(t){tool=t;selection.visible=false;},rotateView(delta){const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),delta);flyTo(controls.target,controls.target.clone().add(offset),320);},zoom(delta){const offset=camera.position.clone().sub(controls.target).multiplyScalar(delta);offset.clampLength(controls.minDistance,controls.maxDistance);flyTo(controls.target,controls.target.clone().add(offset),260);},home(){if(blocks.length){const box3=new THREE.Box3();for(const b of blocks){const {d,p}=transform(b);box3.expandByPoint(p.clone().sub(new THREE.Vector3(...d.map(v=>v*CELL/2))));box3.expandByPoint(p.clone().add(new THREE.Vector3(...d.map(v=>v*CELL/2))));}const center=box3.getCenter(new THREE.Vector3()),size=box3.getSize(new THREE.Vector3()),distance=Math.max(3,Math.max(size.x,size.y,size.z)*1.7);flyTo(center,center.clone().add(new THREE.Vector3(.8,.7,1).normalize().multiplyScalar(distance)),520);}else{flyTo(new THREE.Vector3(7.5,1,7.5),new THREE.Vector3(17,12,20),520);}},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('start',cancelFlight);controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointercancel',pointerCancel);clearPreview();renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('webglcontextrestored',contextRestored);scene.traverse(o=>{if(o.geometry&&!geometries.includes(o.geometry))o.geometry.dispose();if(o.material&&!materials.includes(o.material)){for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();}};
}
