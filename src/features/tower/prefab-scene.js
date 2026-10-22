/** Single approved authored masonry scene; no legacy mesh generation or manifest. */
import * as THREE from '../../vendor/three/three.module.js';
import {OrbitControls} from '../../vendor/three/addons/controls/OrbitControls.js';
import {createKunlumEnvironment} from './kunlum-environment.js?v=17.2.10';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';
import {prefabBounds,PREFAB_CELL_METERS as CELL,BUILDABLE_PREFAB_TYPES} from '../../../packages/tower-game/prefab-layout.mjs';
import {resolvePrefabJoints,JOINT_INTERFACE} from '../../../packages/tower-game/prefab-joints.mjs';
import {WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION,WINDOW_PREFAB_FILE,WINDOW_PREFAB_SPEC,WINDOW_WOOD_FILE,WINDOW_RENDER_VERSION,WINDOW_JOINT_FILES} from '../../../packages/tower-game/window-prefab.mjs';
import {DOOR_PREFAB_ID,DOOR_PREFAB_VERSION,DOOR_STONE_FILE,DOOR_WOOD_FILE,DOOR_RENDER_VERSION,DOOR_PREFAB_SPEC} from '../../../packages/tower-game/door-prefab.mjs';
import {GATE_PREFAB_ID,GATE_PREFAB_VERSION,GATE_PREFAB_FILE,GATE_RENDER_VERSION,GATE_PREFAB_SPEC} from '../../../packages/tower-game/gate-prefab.mjs';
import {applyGateSurfaces} from './gate-surface.js';
import {APPROVED_PREFAB_VERSION,isApprovedMasonryType} from '../../../packages/tower-game/approved-prefab.mjs';
import {createApprovedSectionLoader} from './approved-section-scene.js?v=17.7-approved-masonry.1';
import {getRockSurface,applyRockSurface} from './rock-surface.js?v=balkaria-stone-v2.1-light-ochre.1';
const hash=v=>{const q=Math.sin(v*127.1+311.7)*43758.5453;return q-Math.floor(q);};
const pixelLimit=()=>matchMedia('(max-width:749px), (max-height:520px)').matches?1.25:1.6;
const dir3=(a,b)=>new THREE.Vector3(...a).sub(new THREE.Vector3(...b));
export async function createTowerScene(container,{onPick=()=>{},onSelection=()=>{},onCameraChange=()=>{}}={}){
 const manifest={version:APPROVED_PREFAB_VERSION,types:BUILDABLE_PREFAB_TYPES,
  connectors:Object.fromEntries(Object.entries(WINDOW_JOINT_FILES).map(([axis,file])=>[axis,{file,interface:JOINT_INTERFACE}]))};
 const loader=new GLTFLoader(),loaded=new Map();
 const approvedSections=createApprovedSectionLoader();
 let disposed=false,layer=null,tool='select',blocks=[],selected=null;
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,pixelLimit()));
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 renderer.setSize(Math.max(1,container.clientWidth),Math.max(320,container.clientHeight),false);
 const stoneMaterial=await getRockSurface(renderer);
 container.dataset.stoneTextureEncoding=stoneMaterial.name.endsWith('KTX2')?'ktx2':'png';
 renderer.domElement.style.cssText='width:100%;height:100%;display:block;touch-action:none';container.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#b3c9d9');scene.fog=new THREE.Fog('#b3c9d9',180,680);
 const camera=new THREE.PerspectiveCamera(42,Math.max(1,container.clientWidth)/Math.max(1,container.clientHeight),.1,850);
 camera.position.set(32,15,-23);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(10,.5,10);controls.enableDamping=true;controls.dampingFactor=.095;controls.minDistance=1.5;controls.maxDistance=85;controls.maxPolarAngle=Math.PI*.48;controls.update();
 scene.add(new THREE.HemisphereLight('#f0f6ff','#766950',2.0));
 const sunlight=new THREE.DirectionalLight('#fff3df',3);sunlight.position.set(-10,20,13);scene.add(sunlight);
 const surface=new THREE.Group();scene.add(surface);
 // Existing open landscape remains independent of the construction engine.
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:'#929673',roughness:1}));
 floor.rotation.x=-Math.PI/2;floor.position.set(10,-.006,10);floor.receiveShadow=true;scene.add(floor);
 // Kunlum landscape stays independent from prefab placement and saved state.
 let kunlum=null;
 try { kunlum=createKunlumEnvironment(THREE,scene,{mobile:matchMedia('(max-width:749px)').matches}); }
 catch (error) { console.warn('Kunlum environment unavailable; tower building continues',error); }
 // Visible ONLY during installation; invisible 25-cm snapping applies in all cases.
 const grid=new THREE.GridHelper(20,80,'#d9ead7','#879e84');grid.position.set(10,.008,10);
 grid.material.transparent=true;grid.material.opacity=.28;grid.visible=false;scene.add(grid);
 const faceGrid=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#bcefc0',transparent:true,opacity:.67,depthTest:false}));
 scene.add(faceGrid);faceGrid.visible=false;
 const preview=new THREE.Group();scene.add(preview);preview.visible=false;
 const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),new THREE.LineBasicMaterial({color:'#e1be7b',depthTest:false,transparent:true,opacity:1}));outline.visible=false;outline.renderOrder=999;scene.add(outline);
 const ghostBounds=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),new THREE.LineBasicMaterial({color:'#a3e1b1',transparent:true,opacity:.55}));preview.add(ghostBounds);
 const previewContents=new THREE.Group();preview.add(previewContents);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();const targets=[],world=new THREE.Vector3();
 let previewGeneration=0,rebuildGeneration=0,rendered=[],activeGhost=null;
 function footprint(block){const b=prefabBounds(block);return new THREE.Vector3(...b.size.map(v=>v*CELL));}
 function center(block){const b=prefabBounds(block);return new THREE.Vector3(...b.min.map((v,i)=>(v+b.size[i]/2)*CELL));}
 async function getPrefab(block){
  if(block.geometryVersion===APPROVED_PREFAB_VERSION){
   if(!isApprovedMasonryType(block.sectionId))throw new TypeError('Not an approved author-built section');
   return approvedSections.make(block.sectionId,block.variant,stoneMaterial);
  }
  if(block.sectionId===WINDOW_PREFAB_ID){
   if(block.geometryVersion!==WINDOW_PREFAB_VERSION||block.variant!==0)throw new TypeError('Unsupported window prefab version');
   const stoneUrl=`${WINDOW_PREFAB_FILE}?v=${encodeURIComponent(WINDOW_RENDER_VERSION)}`;
   const woodUrl=`${WINDOW_WOOD_FILE}?v=${encodeURIComponent(WINDOW_RENDER_VERSION)}`;
   if(!loaded.has(stoneUrl))loaded.set(stoneUrl,loader.loadAsync(stoneUrl));
   if(!loaded.has(woodUrl))loaded.set(woodUrl,loader.loadAsync(woodUrl));
   const [stone,wood]=await Promise.all([loaded.get(stoneUrl),loaded.get(woodUrl)]);
   const assembled=new THREE.Group();
   const masonry=stone.scene.clone(true);applyRockSurface(masonry,stoneMaterial);assembled.add(masonry);
   const frame=wood.scene.clone(true);
   // Aperture spans y=-.625..+.375; timber spans -0.50..+0.50.
   frame.position.y=-.125;
   assembled.add(frame);
   container.dataset.windowWoodReady='true';
   return assembled;
  }
  if(block.sectionId===GATE_PREFAB_ID){
   if(block.geometryVersion!==GATE_PREFAB_VERSION||block.variant!==0)throw new TypeError('Unsupported gate version');
   const file=GATE_PREFAB_FILE+'?v='+encodeURIComponent(GATE_RENDER_VERSION);
   const reference=DOOR_WOOD_FILE+'?v='+encodeURIComponent(DOOR_RENDER_VERSION);
   if(!loaded.has(file))loaded.set(file,loader.loadAsync(file));
   if(!loaded.has(reference))loaded.set(reference,loader.loadAsync(reference));
   const [source,door]=await Promise.all([loaded.get(file),loaded.get(reference)]);
   const gate=source.scene.clone(true);
   applyGateSurfaces(gate,door.scene,stoneMaterial);
   // The approved v9 GLB already contains the rock-edge fitting.
   // Do not reapply the old editor stretch or modify wooden leaves.
   // Center the authored geometry inside its logical 2.5 m-high section.
   // Use a nested wrapper so setPosition() never destroys the offset.
   gate.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(gate);
   const targetBottom=-GATE_PREFAB_SPEC.size[1]*CELL/2;
   gate.position.y+=targetBottom-bounds.min.y;
   container.dataset.gatePbrReady='true';
   return gate;
  }
  if(block.sectionId===DOOR_PREFAB_ID){
   if(block.geometryVersion!==DOOR_PREFAB_VERSION||block.variant!==0)throw new TypeError('Unsupported door prefab version');
   const stoneUrl=`${DOOR_STONE_FILE}?v=${encodeURIComponent(DOOR_RENDER_VERSION)}`;
   const woodUrl=`${DOOR_WOOD_FILE}?v=${encodeURIComponent(DOOR_RENDER_VERSION)}`;
   if(!loaded.has(stoneUrl))loaded.set(stoneUrl,loader.loadAsync(stoneUrl));
   if(!loaded.has(woodUrl))loaded.set(woodUrl,loader.loadAsync(woodUrl));
   const [stone,wood]=await Promise.all([loaded.get(stoneUrl),loaded.get(woodUrl)]);
   const assembled=new THREE.Group();
   // Both authored door GLBs have their lowest point at ~-1.0m, whereas
   // a 9-cell (2.25m) prefab must reach -1.125m. Seat BOTH assets together
   // 12.5cm lower; moving only carpentry would break stone/wood contacts.
   // The offset belongs to the model, not the positioned outer wrapper.
   // Otherwise setPosition() overwrites it when the section is committed.
   const masonry=stone.scene.clone(true);applyRockSurface(masonry,stoneMaterial);
   masonry.position.y=-.125;assembled.add(masonry);
   const carpentry=wood.scene.clone(true);
   carpentry.traverse(node=>{if(node.isMesh)node.userData.alantilNonStone=true;});
   carpentry.position.y=-.125;
   assembled.add(carpentry);
   container.dataset.doorWoodReady='true';
   return assembled;
  }
  throw new TypeError('Unknown current prefab '+block.sectionId);
 }
 async function getConnector(joint){
  const url=joint.file;if(!url)throw new TypeError('Unknown prebuilt joint');
  // Query version changes with every rebuilt prefab pack: stale HTTP/PWA
  // cache must never silently return the earlier porous rock sections.
  const versionedUrl=`${url}?v=${encodeURIComponent(manifest.version)}`;
  if(!loaded.has(versionedUrl))loaded.set(versionedUrl,loader.loadAsync(versionedUrl));
  const assembly=(await loaded.get(versionedUrl)).scene.clone(true);
  return applyRockSurface(assembly,stoneMaterial);
 }
 function setPosition(group,block){
  group.position.copy(center(block));group.rotation.set(0,block.rotation*Math.PI/2,0);
 }
 function clearPrevious(){for(const group of rendered){surface.remove(group);group.traverse(node=>{if(node.isInstancedMesh)node.dispose();});}rendered=[];targets.length=0;}
 function setSelected(id){selected=id||null;const b=blocks.find(x=>x.id===selected&&x.type==='masonry_section');outline.visible=!!b;if(b){outline.position.copy(center(b));outline.scale.copy(footprint(b)).multiplyScalar(1.015);}}
 function prepareMesh(model,block){
  const group=new THREE.Group();group.add(model.clone(true));group.userData.block=block;
  group.traverse(child=>{if(!child.isMesh)return;
   child.userData.block=block;
  });
  setPosition(group,block);return group;
 }
 function cleanGhost(){for(const child of [...previewContents.children]){previewContents.remove(child);child.traverse(node=>{if(node.isMesh&&node.userData.ghostMaterial)node.material.dispose();if(node.isInstancedMesh)node.dispose();});}activeGhost=null;}
 async function setPreview(block,valid=true){
  const generation=++previewGeneration;cleanGhost();preview.visible=!!block;
  if(!block)return;
  try{
   const model=await getPrefab(block);if(disposed||generation!==previewGeneration)return;
   const clone=model.clone(true);clone.traverse(node=>{if(!node.isMesh)return;node.material=new THREE.MeshBasicMaterial({color:valid?'#69cf91':'#ed7777',transparent:true,opacity:valid?.45:.20,depthWrite:false,side:THREE.DoubleSide});node.userData.ghostMaterial=true;});
   previewContents.add(clone);activeGhost=clone;setPosition(preview,block);
   ghostBounds.scale.copy(footprint(block)).multiplyScalar(1.01);
  }catch(e){if(generation===previewGeneration){container.dataset.prefabError=String(e?.message||e);console.warn('Prefab preview:',e);}}
 }
 async function setBlocks(elements){
  const generation=++rebuildGeneration;blocks=[...elements];
  const next=[],used=blocks.filter(b=>layer===null||b.y<=layer);
  try{
   for(const block of used){
     if(block.type!=='masonry_section')throw new TypeError('Unsupported tower block');
     const model=await getPrefab(block);
     if(disposed||generation!==rebuildGeneration)return;
     next.push(prepareMesh(model,block));
    }
   // Prepared natural-stone join parts are placed, not generated or deformed.
   const owned=used.filter(b=>b.type==='masonry_section');
   const resolved=resolvePrefabJoints(owned,manifest);
   for(const joint of resolved.joints){
    const model=await getConnector(joint);
    if(disposed||generation!==rebuildGeneration)return;
    const mesh=applyRockSurface(model.clone(true),stoneMaterial);mesh.position.set(...joint.point.map(v=>v*CELL));
    next.push(mesh);
   }
   if(disposed||generation!==rebuildGeneration)return;
   clearPrevious();for(const g of next){surface.add(g);rendered.push(g);g.traverse(node=>{if(node.isMesh&&node.userData.block)targets.push(node);});}
   container.dataset.prefabReady='true';container.dataset.prefabCount=String(owned.length);
   container.dataset.prefabJoints=String(resolved.pairs.length);
   container.dataset.prefabJointTiles=String(resolved.joints.length);
   container.dataset.prefabJointErrors=String(resolved.incompatible.length);
   setSelected(selected);
  }catch(e){console.warn('Prefab build:',e);container.dataset.prefabError=String(e?.message||e);}
 }
 function showFaceGrid(hit){
  const geometry=faceGrid.geometry;
  geometry.dispose();
  faceGrid.visible=false;
  if(tool!=='place'||!hit?.block){return;}
  const bounds=prefabBounds(hit.block),n=hit.normal;
  const axis=Math.abs(n.x)>.5?0:Math.abs(n.y)>.5?1:2;
  const dir=[n.x,n.y,n.z][axis]>0?1:0;
  const axes=[0,1,2].filter(a=>a!==axis);
  const plane=bounds.min[axis]+(dir?bounds.size[axis]:0);
  const positions=[];
  for(let k=0;k<2;k++){
   const a=axes[k],b=axes[1-k];
   for(let i=bounds.min[a];i<=bounds.max[a];i++){
    const from=[0,0,0],to=[0,0,0];
    from[axis]=to[axis]=plane+([n.x,n.y,n.z][axis]>=0?.008:-.008)/CELL;
    from[a]=to[a]=i;from[b]=bounds.min[b];to[b]=bounds.max[b];
    positions.push(...from.map(v=>v*CELL),...to.map(v=>v*CELL));
   }
  }
  faceGrid.geometry=new THREE.BufferGeometry();faceGrid.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  faceGrid.visible=true;
 }
 function findHit(clientX,clientY){
  const r=renderer.domElement.getBoundingClientRect();if(!r.width||!r.height)return null;
  pointer.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects([...targets,floor],false);
  for(const hit of hits){
   const b=hit.object.userData.block||null;
   if(layer!==null&&hit.point.y>(layer+1)*CELL+.001)continue;
   const n=hit.face?.normal?.clone()||new THREE.Vector3(0,1,0);
   if(b){
    if(hit.object.isInstancedMesh&&hit.instanceId!==undefined){
     const instance=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,instance);
     const combined=new THREE.Matrix4().multiplyMatrices(hit.object.matrixWorld,instance);
     n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(combined)).normalize();
    }else n.transformDirection(hit.object.matrixWorld);
    let axis=0;for(let i=1;i<3;i++)if(Math.abs(n.getComponent(i))>Math.abs(n.getComponent(axis)))axis=i;
    const dir=Math.sign(n.getComponent(axis))||1;n.set(axis===0?dir:0,axis===1?dir:0,axis===2?dir:0);
   }else n.set(0,1,0);
   return{block:b,normal:{x:n.x,y:n.y,z:n.z},position:hit.point.toArray()};
  }
  return null;
 }
 const activePointers=new Set();let pressed=null;
 function pointerDown(e){activePointers.add(e.pointerId);pressed=activePointers.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now()}:null;}
 function pointerUp(e){activePointers.delete(e.pointerId);if(!pressed||pressed.id!==e.pointerId||activePointers.size||Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)>7||performance.now()-pressed.at>650){pressed=null;return;}pressed=null;const hit=findHit(e.clientX,e.clientY);if(!hit)return;if(tool==='select'){onSelection(hit.block?.id||null);return;}onPick(hit);}
 function pointerCancel(e){activePointers.delete(e.pointerId);pressed=null;}
 renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointercancel',pointerCancel);
 const observer=new ResizeObserver(()=>{if(disposed)return;const width=Math.max(1,container.clientWidth),height=Math.max(300,container.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();});observer.observe(container);
 function fit(){if(!blocks.length){controls.target.set(10,.5,10);camera.position.set(32,15,-23);}else{
  const bounds=new THREE.Box3();for(const b of blocks){const box=prefabBounds(b);bounds.expandByPoint(new THREE.Vector3(...box.min.map(v=>v*CELL)));bounds.expandByPoint(new THREE.Vector3(...box.max.map(v=>v*CELL)));}
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());controls.target.copy(center);
  const distance=Math.max(2.8,Math.max(size.x,size.y,size.z)*3);camera.position.copy(center).add(new THREE.Vector3(distance*.83,distance*.58,distance));}
  controls.update();}
 let frame=0,lastAim=0;function draw(time){if(disposed)return;frame=requestAnimationFrame(draw);controls.update();
  if(time-lastAim>300){lastAim=time;const forward=new THREE.Vector3();camera.getWorldDirection(forward);raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const point=raycaster.intersectObjects([...targets,floor],false)[0]?.point||controls.target;
   const hit=findHit(renderer.domElement.getBoundingClientRect().left+renderer.domElement.getBoundingClientRect().width/2,renderer.domElement.getBoundingClientRect().top+renderer.domElement.getBoundingClientRect().height/2);
   showFaceGrid(hit);
   onCameraChange({origin:camera.position.toArray(),forward:forward.toArray(),target:point.toArray(),hit});}
  renderer.render(scene,camera);}
 frame=requestAnimationFrame(draw);container.dataset.ready='true';container.dataset.gridVisible='false';
 return {manifest,async setBlocks(v){const wasEmpty=!blocks.length;await setBlocks(v||[]);if(wasEmpty&&(v||[]).length)fit();},setPreview,
  setSelected,getAimHit(){const r=renderer.domElement.getBoundingClientRect();return findHit(r.left+r.width/2,r.top+r.height/2);},
  setLayer(v){layer=v;void setBlocks(blocks);},setTool(v){tool=v;grid.visible=v==='place';container.dataset.gridVisible=String(grid.visible);if(v!=='place')faceGrid.visible=false;},home:fit,rotateView(delta){camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),delta).add(controls.target);controls.update();},
  zoom(multiplier){camera.position.sub(controls.target).multiplyScalar(multiplier).add(controls.target);controls.update();},
  pickAt:findHit,
  dispose(){disposed=true;kunlum?.dispose();previewGeneration++;rebuildGeneration++;cancelAnimationFrame(frame);grid.geometry.dispose();grid.material.dispose();faceGrid.geometry.dispose();faceGrid.material.dispose();observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointercancel',pointerCancel);cleanGhost();scene.traverse(o=>{if(o.geometry&&o!==floor)o.geometry.dispose();});floor.geometry.dispose();floor.material.dispose();renderer.dispose();renderer.domElement.remove();}
 };
}