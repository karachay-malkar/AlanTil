import * as THREE from '../../vendor/three/three.module.js';
import { OrbitControls } from '../../vendor/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';

const CELL=.25;
const ROOT=new URL('../../../',import.meta.url);
const dimensions=b=> b.rotation===4?[b.sy,b.sx,b.sz]:b.rotation===5?[b.sx,b.sz,b.sy]:b.rotation%2?[b.sz,b.sy,b.sx]:[b.sx,b.sy,b.sz];
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

/** Local assets only. Coordinates are integer cells with y pointing up. */
export async function createTowerScene(container,{onPick=()=>{},onSelection=()=>{}}={}){
 const scene=new THREE.Scene(); scene.background=new THREE.Color('#bccbd0');scene.fog=new THREE.Fog('#bccbd0',30,95);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.setAttribute('aria-label','Трёхмерная стройка башни');renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none;';container.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(42,1,.1,180);camera.position.set(17,12,20);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(7.5,1,7.5);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=2;controls.maxDistance=48;controls.maxPolarAngle=Math.PI*.485;
 scene.add(new THREE.HemisphereLight('#e7f4ff','#695d41',2.3));
 const sun=new THREE.DirectionalLight('#fff1dc',3.3);sun.position.set(-9,24,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:.5,far:70});sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;sun.target.position.set(7.5,0,7.5);scene.add(sun,sun.target);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:'#77765c',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(7.5,-.075,7.5);ground.receiveShadow=true;scene.add(ground);
 const platform=new THREE.Mesh(new THREE.BoxGeometry(15,.12,15),new THREE.MeshStandardMaterial({color:'#b8b39c',roughness:.97}));platform.position.set(7.5,-.065,7.5);platform.receiveShadow=true;scene.add(platform);
 const grid=new THREE.GridHelper(15,60,'#625e4e','#928d78');grid.position.set(7.5,.002,7.5);grid.material.transparent=true;grid.material.opacity=.28;scene.add(grid);
 // Distant layered ridges, kept outside the build area; no fictitious named peak.
 for(let ridge=0;ridge<3;ridge++){
  const points=[],indices=[],count=28;for(let i=0;i<count;i++){const x=-45+i*4;const h=6+hash(i+ridge*73)*12+ridge*3;points.push(x,-.2,-22-ridge*12,x,h,-22-ridge*12);if(i<count-1){let j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();scene.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:['#7c8580','#8b9896','#a0b0b1'][ridge],roughness:1,side:THREE.DoubleSide})));
 }
 const geometries=[],materials=[],textures=[];const keepG=g=>(geometries.push(g),g);const keepM=m=>(materials.push(m),m);
 const box=keepG(new THREE.BoxGeometry(1,1,1));
 const stoneMaterial=keepM(new THREE.MeshStandardMaterial({color:'#a19b87',roughness:.94}));
 const woodMaterial=keepM(new THREE.MeshStandardMaterial({color:'#6e4c30',roughness:.85}));
 const mortarMaterial=keepM(new THREE.MeshStandardMaterial({color:'#8a8473',roughness:1}));
 const darkMaterial=keepM(new THREE.MeshStandardMaterial({color:'#292725',roughness:.8}));
 const loader=new THREE.TextureLoader();
 async function texture(path,srgb=false){try{const t=await loader.loadAsync(new URL(path,ROOT).href);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.push(t);return t;}catch{return null;}}
 const stoneTemplates=[];
 const gltfLoader=new GLTFLoader();
 // Prefer optimized derivatives; fall back to original model, sampled down when indexed.
 for(const name of ['rock_07','rock_09']){
  try{const gltf=await gltfLoader.loadAsync(new URL(`assets/tower/${name}/${name}-lod.glb`,ROOT).href);let mesh;gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isMesh){if(!mesh)mesh=o;keepG(o.geometry);for(const material of(Array.isArray(o.material)?o.material:[o.material])){keepM(material);for(const value of Object.values(material)){if(value?.isTexture&&!textures.includes(value))textures.push(value);}}}});if(!mesh)continue;
   let g=mesh.geometry.clone();g.applyMatrix4(mesh.matrixWorld);g.computeBoundingBox();const bb=g.boundingBox,sz=bb.getSize(new THREE.Vector3()),center=bb.getCenter(new THREE.Vector3());g.translate(-center.x,-center.y,-center.z);g.scale(1/sz.x,1/sz.y,1/sz.z);keepG(g);
   const m=mesh.material.clone();m.color.multiplyScalar(.9);keepM(m);stoneTemplates.push({g,m});
  }catch{/* Other local candidate may be present. */}
 }
 const woodMap=await texture('assets/tower/modular_wooden_pier/textures/modular_wooden_pier_planks_diff_1k.jpg',true);if(woodMap){woodMaterial.map=woodMap;woodMaterial.color.set('#a99a85');woodMaterial.needsUpdate=true;}
 const [woodNormal,woodArm]=await Promise.all([texture('assets/tower/modular_wooden_pier/textures/modular_wooden_pier_planks_nor_gl_1k.jpg'),texture('assets/tower/modular_wooden_pier/textures/modular_wooden_pier_planks_arm_1k.jpg')]);if(woodNormal){woodMaterial.normalMap=woodNormal;woodMaterial.normalScale.set(.45,.45);}if(woodArm)woodMaterial.roughnessMap=woodArm;woodMaterial.needsUpdate=true;
 let blocks=[],layer=null,tool='place',disposed=false,groups=[],pickables=[];
 const clipPlane=new THREE.Plane(new THREE.Vector3(0,-1,0),0);
 const content=new THREE.Group();scene.add(content);
 const preview=new THREE.Mesh(box,keepM(new THREE.MeshBasicMaterial({color:'#64d8b2',transparent:true,opacity:.38,depthWrite:false})));preview.visible=false;scene.add(preview);
 const edges=new THREE.LineSegments(keepG(new THREE.EdgesGeometry(box)),keepM(new THREE.LineBasicMaterial({color:'#edfff4',transparent:true,opacity:.9})));preview.add(edges);
 const selection=new THREE.Box3Helper(new THREE.Box3(),'#ffda86');selection.visible=false;scene.add(selection);
 function transform(b){const d=dimensions(b);return {d,p:new THREE.Vector3((b.x+d[0]/2)*CELL,(b.y+d[1]/2)*CELL,(b.z+d[2]/2)*CELL)};}
 function parts(type){
  if(type==='window')return [[box,woodMaterial,[-.44,0,0],[.12,1,.48]],[box,woodMaterial,[.44,0,0],[.12,1,.48]],[box,woodMaterial,[0,.44,0],[.76,.12,.48]],[box,woodMaterial,[0,-.44,0],[.76,.12,.48]],[box,woodMaterial,[-.19,0,.06],[.35,.76,.14]],[box,woodMaterial,[.19,0,.06],[.35,.76,.14]]];
  if(type==='door')return [[box,woodMaterial,[0,0,0],[.96,1,.48]],[box,darkMaterial,[0,.26,.26],[.95,.035,.025]],[box,darkMaterial,[0,-.26,.26],[.95,.035,.025]]];
  if(type==='stairs'||type==='ladder'){
   const result=[[box,woodMaterial,[0,0,0],[.48,1,.58]]];for(let i=0;i<12;i++)result.push([box,woodMaterial,[0,-.44+i*.08,.32],[.54,.025,.35]]);return result;
  }
  if(type==='deck'||type==='floor'||type==='plank'){const result=[];for(let i=0;i<8;i++)result.push([box,woodMaterial,[-.4375+i*.125,0,0],[.12,1,1]]);return result;}
  if(type==='roof')return [[roofGeometry,roofMaterial,[0,0,0],[1,1,1]]];
  return [[box,woodMaterial,[0,0,0],[1,1,1]]];
 }
 const roofGeometry=keepG(new THREE.BufferGeometry());
 const roofPositions=[-.5,-.5,-.5,.5,-.5,-.5,0,.5,-.5,-.5,-.5,.5,0,.5,.5,.5,-.5,.5];
 roofGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roofPositions,3));roofGeometry.setIndex([0,1,2,3,4,5,0,2,4,0,4,3,1,5,4,1,4,2,0,3,5,0,5,1]);roofGeometry.computeVertexNormals();
 const roofMaterial=keepM(new THREE.MeshStandardMaterial({color:'#615f52',roughness:.92,map:woodMap||null}));
 function rebuild(){for(const g of groups){content.remove(g);g.dispose?.();}groups=[];pickables=[];
  const buckets=new Map();for(const b of blocks){if(layer!==null&&b.y>layer)continue;const key=['ordinary','medium','elongated','large','stone','stone_small','stone_medium','stone_long','stone_large','small','long','big'].includes(b.type)?('stone'+((b.x+b.y+b.z)%2)):b.type;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(b);}
  for(const [type,list]of buckets){
   const stone=type.startsWith('stone');const template=stoneTemplates[Number(type.slice(5))%Math.max(stoneTemplates.length,1)];const templates=stone?[[box,mortarMaterial,[0,0,0],[.65,.65,.65]],[template?.g||box,template?.m||stoneMaterial,[0,0,0],[1,1,1]]]:parts(type);
   for(const [g,mat,offset,factor]of templates){
    mat.clippingPlanes=layer===null?[]:[clipPlane];mat.clipShadows=true;mat.needsUpdate=true;
    const instances=new THREE.InstancedMesh(g,mat,list.length);instances.castShadow=true;instances.receiveShadow=true;instances.userData.blocks=list;
    const matrix=new THREE.Matrix4(),quat=new THREE.Quaternion();list.forEach((b,i)=>{const {d,p}=transform(b);quat.identity();const special=!stone&&['window','door','stairs','ladder','roof','deck','floor','plank'].includes(type);if(special)quat.setFromAxisAngle(new THREE.Vector3(0,1,0),(b.rotation||0)*Math.PI/2);const scale=new THREE.Vector3(...(special?[b.sx,b.sy,b.sz]:d).map(v=>v*CELL));
     if(type==='window'||type==='door'){scale.z=.25;}
     if(type==='deck'||type==='floor'||type==='plank'){scale.y=.065;p.y=b.y*CELL+.0325;}
     const local=new THREE.Vector3(...offset).multiply(scale).applyQuaternion(quat);p.add(local);scale.multiply(new THREE.Vector3(...factor));
     matrix.compose(p,quat,scale);instances.setMatrixAt(i,matrix);instances.setColorAt(i,new THREE.Color().setHSL(stone?.105:.085,stone?.09:.12,(stone?.75:.67)+hash((b.variant||0)+b.x*61+b.y*367+b.z*997)*.08));
    });instances.instanceMatrix.needsUpdate=true;instances.computeBoundingSphere();content.add(instances);groups.push(instances);pickables.push(instances);
   }
  }
 }
 const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let down=null;
 function pointerDown(e){down={x:e.clientX,y:e.clientY,t:performance.now()};}
 function pointerUp(e){if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||performance.now()-down.t>650){down=null;return;}down=null;
  const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects([...pickables,platform],false).find(h=>layer===null||h.point.y<=(layer+1)*CELL+.0001);if(!hit)return;
  const b=hit.object.userData.blocks?.[hit.instanceId];if(tool==='select'){onSelection(b?.id??null);if(b){const {d,p}=transform(b);selection.box=new THREE.Box3(p.clone().sub(new THREE.Vector3(...d.map(v=>v*CELL/2))),p.clone().add(new THREE.Vector3(...d.map(v=>v*CELL/2))));selection.updateMatrixWorld();selection.visible=true;}else selection.visible=false;return;}
  const n=b?hit.face.normal.clone():new THREE.Vector3(0,1,0);if(b){const m=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,m);n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(m)).normalize();const values=[Math.abs(n.x),Math.abs(n.y),Math.abs(n.z)],axis=values.indexOf(Math.max(...values));n.set(axis===0?Math.sign(n.x):0,axis===1?Math.sign(n.y):0,axis===2?Math.sign(n.z):0);}const normal={x:Math.round(n.x),y:Math.round(n.y),z:Math.round(n.z)};const p=hit.point.clone().addScaledVector(n,.001);let x=Math.floor(p.x/CELL),y=Math.floor(p.y/CELL),z=Math.floor(p.z/CELL);
  if(b){const d=dimensions(b);if(normal.x)x=normal.x>0?b.x+d[0]:b.x-1;if(normal.y)y=normal.y>0?b.y+d[1]:b.y-1;if(normal.z)z=normal.z>0?b.z+d[2]:b.z-1;}else y=0;onPick({x,y,z,blockId:b?.id??null,normal});
 }
 renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
 function contextLost(e){e.preventDefault();container.dataset.contextLost='true';}function contextRestored(){delete container.dataset.contextLost;}
 renderer.domElement.addEventListener('webglcontextlost',contextLost);renderer.domElement.addEventListener('webglcontextrestored',contextRestored);
 function resize(){const w=Math.max(container.clientWidth,1),h=Math.max(container.clientHeight,300);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}const observer=new ResizeObserver(resize);observer.observe(container);resize();
 let frame;function animate(){if(disposed)return;frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();container.dataset.ready="true";
 return {setBlocks(value){blocks=value||[];selection.visible=false;rebuild();},setPreview(b,valid=true){preview.visible=!!b;if(!b)return;const {d,p}=transform(b);preview.position.copy(p);preview.scale.set(...d.map(v=>v*CELL));preview.material.color.set(valid?'#65d6b0':'#ef786f');preview.material.opacity=valid?.25:.12;},setLayer(y){layer=y;clipPlane.constant=y===null?0:(y+1)*CELL;rebuild();},setTool(t){tool=t;selection.visible=false;},rotateView(delta){const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),delta);camera.position.copy(controls.target).add(offset);controls.update();},zoom(delta){camera.position.sub(controls.target).multiplyScalar(delta).add(controls.target);controls.update();},home(){if(blocks.length){const box3=new THREE.Box3();for(const b of blocks){const {d,p}=transform(b);box3.expandByPoint(p.clone().sub(new THREE.Vector3(...d.map(v=>v*CELL/2))));box3.expandByPoint(p.clone().add(new THREE.Vector3(...d.map(v=>v*CELL/2))));}const center=box3.getCenter(new THREE.Vector3()),size=box3.getSize(new THREE.Vector3()),distance=Math.max(3,Math.max(size.x,size.y,size.z)*1.7);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(.8,.7,1).normalize().multiplyScalar(distance));}else{controls.target.set(7.5,1,7.5);camera.position.set(17,12,20);}controls.update();},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('webglcontextrestored',contextRestored);scene.traverse(o=>{if(o.geometry&&!geometries.includes(o.geometry))o.geometry.dispose();if(o.material&&!materials.includes(o.material)){for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();}};
}
