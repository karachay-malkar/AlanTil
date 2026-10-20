/** Three.js manual authoring canvas, independent of the tower game's snapped placement engine. */
import * as THREE from '../../vendor/three/three.module.js';
import {OrbitControls} from '../../vendor/three/addons/controls/OrbitControls.js';
import {CELL_METERS,stoneColor,serializeTransform} from './library.js';

export function createMasonryScene(host,{models,geometries,onSelect,onDragStart,onTransform}){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.4;
 renderer.domElement.style.cssText='width:100%;height:100%;display:block;touch-action:none';
 host.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#c6c4bc');
 const camera=new THREE.PerspectiveCamera(40,1,.01,400);
 const controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.15;controls.maxDistance=120;
 controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
 scene.add(new THREE.HemisphereLight('#f7f5ec','#736b5c',2.1));
 const sun=new THREE.DirectionalLight('#fff4df',2.5);sun.position.set(4,9,6);scene.add(sun);
 const bounce=new THREE.DirectionalLight('#dfe7eb',.8);bounce.position.set(-4,3,-4);scene.add(bounce);
 const floor=new THREE.GridHelper(12,48,'#8b968f','#a1aba2');
 floor.material.transparent=true;floor.material.opacity=.28;floor.position.y=-.008;scene.add(floor);
 const stoneGroup=new THREE.Group();scene.add(stoneGroup);
 const ghost=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),
  new THREE.LineDashedMaterial({color:'#358c72',dashSize:.055,gapSize:.028,depthTest:false,transparent:true,opacity:.85}));
 ghost.computeLineDistances();ghost.renderOrder=100;scene.add(ghost);
 const selector=new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)),0xffd07a);
 selector.material.depthTest=false;selector.renderOrder=200;selector.visible=false;scene.add(selector);
 const objects=new Map();
 const modelByName=new Map(models.map(m=>[m.name,m]));
 const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
 const tmp=new THREE.Vector3();
 let selectedId=null,axis='free',drag=null,disposed=false;
 function material(model){return new THREE.MeshStandardMaterial({color:stoneColor(model),roughness:.98,metalness:0,flatShading:false});}
 function setBounds(cells){
  const [x,y,z]=cells.map(n=>n*CELL_METERS);
  ghost.scale.set(x,y,z);ghost.position.set(0,y/2,0);
 }
 function resetCamera(cells=[3,3,3]){
  const d=Math.max(...cells)*CELL_METERS;
  controls.target.set(0,cells[1]*CELL_METERS*.5,0);
  camera.position.copy(controls.target).add(new THREE.Vector3(d*1.7,d*1.2,d*1.8));
  camera.near=Math.max(.005,d/100);camera.far=300;camera.updateProjectionMatrix();controls.update();
 }
 function get(id){return objects.get(id)||null;}
 function select(id){
  selectedId=objects.has(id)?id:null;
  refreshSelection();
 }
 function refreshSelection(){
  const m=get(selectedId);
  selector.visible=Boolean(m);
  if(m)selector.setFromObject(m);
 }
 function sync(stones){
  const valid=new Set(stones.map(s=>s.id));
  for(const [id,m] of objects)if(!valid.has(id)){
   stoneGroup.remove(m);m.material.dispose();objects.delete(id);
  }
  for(const stone of stones){
   let m=get(stone.id);
   if(!m){
    const model=modelByName.get(stone.name),geometry=geometries.get(stone.name);
    if(!model||!geometry)throw new Error('Не найдена оригинальная модель '+stone.name);
    m=new THREE.Mesh(geometry,material(model));m.userData.stoneId=stone.id;
    stoneGroup.add(m);objects.set(stone.id,m);
   }
   m.position.fromArray(stone.position);m.quaternion.fromArray(stone.quaternion);m.scale.fromArray(stone.scale);
   m.updateMatrixWorld(true);
  }
  if(selectedId&&!objects.has(selectedId))selectedId=null;
  refreshSelection();
 }
 function setGhostVisible(show){ghost.visible=Boolean(show);}
 function setAxis(value){axis=['free','x','y','z'].includes(value)?value:'free';}
 function resize(){
  if(disposed)return;
  const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 }
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 function toRay(e){
  const rect=renderer.domElement.getBoundingClientRect();
  mouse.set((e.clientX-rect.left)/Math.max(rect.width,1)*2-1,-(e.clientY-rect.top)/Math.max(rect.height,1)*2+1);
  raycaster.setFromCamera(mouse,camera);
 }
 function pick(e){
  toRay(e);
  return raycaster.intersectObjects([...objects.values()],false)[0]?.object?.userData?.stoneId||null;
 }
 function intersection(e,plane){
  toRay(e);const pt=new THREE.Vector3();return raycaster.ray.intersectPlane(plane,pt)?pt:null;
 }
 function pointerDown(e){
  if(e.button!==0||!e.isPrimary)return;
  const id=pick(e);
  if(id!==selectedId){select(id);onSelect(id);}
  if(!id||!objects.has(id))return;
  const m=get(id);
  // Second touch on a selected stone moves it; the first touch may select it.
  // Desktop dragging starts immediately after selection.
  if(e.pointerType==='touch'&&id!==drag?.id&&id!==previousTapId){previousTapId=id;return;}
  onDragStart?.();
  const normal=camera.getWorldDirection(new THREE.Vector3());
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,m.position);
  const start=intersection(e,plane);if(!start)return;
  drag={id,pointerId:e.pointerId,start:start.clone(),position:m.position.clone(),plane};
  controls.enabled=false;
  renderer.domElement.setPointerCapture(e.pointerId);
 }
 let previousTapId=null;
 function pointerMove(e){
  if(!drag||e.pointerId!==drag.pointerId)return;
  const hit=intersection(e,drag.plane);if(!hit)return;
  const delta=hit.sub(drag.start);
  if(axis!=='free'){
   const component=axis==='x'?0:axis==='y'?1:2;
   for(let i=0;i<3;i++)if(i!==component)delta.setComponent(i,0);
  }
  const m=get(drag.id);if(!m)return;
  m.position.copy(drag.position).add(delta);m.updateMatrixWorld(true);
  refreshSelection();onTransform(drag.id,serializeTransform(m),false);
 }
 function pointerUp(e){
  if(!drag||e.pointerId!==drag.pointerId)return;
  const m=get(drag.id);const id=drag.id;drag=null;controls.enabled=true;
  if(m)onTransform(id,serializeTransform(m),true);
  try{renderer.domElement.releasePointerCapture(e.pointerId);}catch{}
 }
 renderer.domElement.addEventListener('pointerdown',pointerDown);
 renderer.domElement.addEventListener('pointermove',pointerMove);
 renderer.domElement.addEventListener('pointerup',pointerUp);
 renderer.domElement.addEventListener('pointercancel',pointerUp);
 function cameraFitOnStones(cells){
  const [width,height,depth]=cells.map(n=>n*CELL_METERS);
  const box=new THREE.Box3(
   new THREE.Vector3(-width/2,0,-depth/2),
   new THREE.Vector3(width/2,height,depth/2)
  );
  // Newly staged rocks lie beyond +X. Frame both the cube and all visible
  // stones, accounting for the narrower horizontal field of view on phones.
  if(objects.size)box.union(new THREE.Box3().setFromObject(stoneGroup));
  const center=box.getCenter(new THREE.Vector3());
  const radius=Math.max(.12,box.getSize(new THREE.Vector3()).length()*.5);
  const halfVertical=THREE.MathUtils.degToRad(camera.fov*.5);
  const halfHorizontal=Math.atan(Math.tan(halfVertical)*camera.aspect);
  const limit=Math.max(.05,Math.min(halfVertical,halfHorizontal));
  const distance=Math.max(.8,radius/Math.sin(limit)*1.12);
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(new THREE.Vector3(1,.7,1.2).normalize(),distance);
  camera.near=Math.max(.005,distance/1000);
  camera.far=Math.max(300,distance+radius*5);
  camera.updateProjectionMatrix();controls.update();
 }
 renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
 // Single shared offscreen renderer: thumbnails depict the same mesh as the editor.
 const thumbnails=new Map();
 let previewRenderer=null;
 function thumbnail(name){
  if(thumbnails.has(name))return thumbnails.get(name);
  const g=geometries.get(name);if(!g)return '';
  try{
   if(!previewRenderer){previewRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});previewRenderer.setPixelRatio(1);previewRenderer.setSize(96,72);}
   const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(40,96/72,.01,20);
   sc.add(new THREE.AmbientLight(0xffffff,1.8));
   const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(1,2,3);sc.add(light);
   const size=new THREE.Box3().setFromBufferAttribute(g.attributes.position).getSize(new THREE.Vector3());
   const length=Math.max(size.length(),.02);
   const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:stoneColor(modelByName.get(name)),roughness:1}));
   sc.add(mesh);cam.position.set(length*1.2,length*.7,length*1.8);cam.lookAt(0,0,0);
   previewRenderer.render(sc,cam);const img=previewRenderer.domElement.toDataURL('image/png');
   mesh.material.dispose();thumbnails.set(name,img);return img;
  }catch(error){console.warn('Stone thumbnail unavailable',name,error);return '';}
 }
 function dispose(){
  if(disposed)return;disposed=true;renderer.setAnimationLoop(null);observer.disconnect();
  renderer.domElement.removeEventListener('pointerdown',pointerDown);
  renderer.domElement.removeEventListener('pointermove',pointerMove);
  renderer.domElement.removeEventListener('pointerup',pointerUp);
  renderer.domElement.removeEventListener('pointercancel',pointerUp);
  controls.dispose();
  for(const m of objects.values())m.material.dispose();
  previewRenderer?.dispose();renderer.dispose();
  selector.geometry.dispose();selector.material.dispose();
  ghost.geometry.dispose();ghost.material.dispose();floor.geometry.dispose();floor.material.dispose();
  renderer.domElement.remove();
 }
 return {sync,select,get,setAxis,setBounds,setGhostVisible,resetCamera,cameraFitOnStones,thumbnail,dispose};
}
