/** Mapped Kunlum walls use shared, prebuilt masonry casts. */
import * as THREE from '../../vendor/three/three.module.js';
import {loadCommon100} from '../masonry/library.js?v=17.7-approved-masonry.1';
import {getApprovedStoneSurfaceGeometry,applyRockSurface,getRockSurface} from './rock-surface.js?v=balkaria-stone-v2.1-light-ochre.2';
import {loadBakedMasonry} from './baked-masonry.js?v=5';
import {kunlumRuinCrown,kunlumRuinFoot} from './kunlum-wall-ground.js?v=17.2.77';
import {groupRuinSegments,ruinChunkDistance,fenceLodVisibility,FENCE_LOD_START,FENCE_LOD_END} from './kunlum-ruin-lod.mjs?v=17.2.84';

import {createDistantMasonry,distantWallPositions,loadDistantTower,masonryFade} from './kunlum-distant-masonry.js';

const WALL_SHELL={start:68,end:100};
const TOWER_SHELL={start:105,end:165};
const hash=(x,y,z)=>{const v=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453123;return v-Math.floor(v)};
const usable=(geom)=>{
 const box=geom.boundingBox||(geom.computeBoundingBox(),geom.boundingBox);
 const size=box.getSize(new THREE.Vector3());
 return size.x>.01&&size.y>.01&&size.z>.01?size:null;
};
const FENCE_SECTIONS=['manual-2x2x2-v3','manual-3x3x3-v2'];

function fenceMaterial(source,far){
 const material=source.clone();
 material.customProgramCacheKey=()=>far?'kunlum-fence-far':'kunlum-fence-near';
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vFenceOrigin;\n'+shader.vertexShader.replace(
   '#include <project_vertex>',
   '#include <project_vertex>\n vFenceOrigin = (modelMatrix * instanceMatrix[3]).xyz;'
  );
  shader.fragmentShader='varying vec3 vFenceOrigin;\n'+shader.fragmentShader.replace(
   '#include <clipping_planes_fragment>',
   `#include <clipping_planes_fragment>
   float fade = smoothstep(${FENCE_LOD_START}.0, ${FENCE_LOD_END}.0, distance(cameraPosition, vFenceOrigin));
   vec2 pixel = floor(gl_FragCoord.xy);
   float threshold = fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
   if (${far?'threshold >= fade':'threshold < fade'}) discard;`
  );
 };
 return material;
}

function fenceMatrices(seg,models,bins){
 const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],length=Math.hypot(dx,dz);
 if(length<.01)return;
 const ux=dx/length,uz=dz/length;
 const count=Math.ceil(length/1.35),step=length/count;
 const overlap=Math.min(.15,step*.16);
 const dummy=new THREE.Object3D();
 for(let i=0;i<count;i++){
  const start=Math.max(0,i*step-overlap),end=Math.min(length,(i+1)*step+overlap);
  const middle=(start+end)*.5,x=seg.a[0]+ux*middle,z=seg.a[1]+uz*middle;
  const bottom=Math.min(...[start,middle,end].map(d=>kunlumRuinFoot(
   seg.a[0]+ux*d,seg.a[1]+uz*d,seg.width,seg.heightAt,[-uz,ux]
  )));
  const top=seg.heightAt(x,z)+kunlumRuinCrown(seg.height,x,z);
  const index=Math.floor(hash(x,i,z)*models.length),{box,size,center}=models[index];
  dummy.rotation.y=-Math.atan2(dz,dx)+(i%2)*Math.PI;
  dummy.scale.set((end-start)/size.x,(top-bottom)/size.y,seg.width/size.z);
  dummy.position.set(-center.x,-box.min.y,-center.z).multiply(dummy.scale)
   .applyEuler(dummy.rotation).add(new THREE.Vector3(x,bottom,z));
  dummy.updateMatrix();
  bins[index].push(dummy.matrix.clone());
 }
}

export async function enhanceKunlumStoneWalls(THREE,root,groups,{
 renderer,materialPromise,mobile=false,monument=null,loadLibrary=loadCommon100,
 loadSection=loadBakedMasonry,distantShells=false
}={}){
 const material=await (materialPromise||getRockSurface(renderer));
 if(root.userData.disposed)return null;
 if(monument)applyRockSurface(monument,material);
 const chunks=groupRuinSegments(groups.flatMap((entry,layer)=>
  entry.segments.map(seg=>({seg,layer}))),24);
 chunks.sort((a,b)=>ruinChunkDistance({x:0,z:0},a.bounds)-
  ruinChunkDistance({x:0,z:0},b.bounds));
 const models=chunks.length?await Promise.all(FENCE_SECTIONS.map(async id=>{
  const near=await loadSection(id,{cast:true});
  if(!near)throw Error('Missing Kunlum fence cast: '+id);
  // A missing lower-detail asset leaves the corresponding full cast visible.
  const far=await loadSection(id,{fenceLod:true}).catch(error=>{
   console.warn('Kunlum fence LOD unavailable:',error);
   return null;
  });
  const box=near.boundingBox;
  return {near,far,box,size:box.getSize(new THREE.Vector3()),center:box.getCenter(new THREE.Vector3())};
 })):[];
 if(root.userData.disposed)return null;
 const nearSource=fenceMaterial(material,false),farSource=fenceMaterial(material,true);
 const nearMaterial=distantShells?masonryFade(nearSource,WALL_SHELL):nearSource;
 const farMaterial=distantShells?masonryFade(farSource,WALL_SHELL):farSource;
 const shellBase=distantShells?new THREE.MeshStandardMaterial({color:'#a99b83',roughness:1,side:THREE.DoubleSide}):null;
 const wallShellMaterial=shellBase&&masonryFade(shellBase,{...WALL_SHELL,distant:true});
 const shells=[],towerMeshes=[];
 const fallbackWallMaterial=distantShells?masonryFade(material,WALL_SHELL):material;
 let towerShell=null,towerShellMaterial=null,towerFacingMaterial=null,towerBaseMaterial=null,originalTowerMaterial=null;
 const zoomFor=camera=>Math.abs(camera.projectionMatrix.elements[5])/2.60509;
 const shellVisibility=(camera,mesh,limits)=>{
  mesh.updateWorldMatrix(true,false);
  const sphere=mesh.geometry.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);
  const distance=camera.position.distanceTo(sphere.center),zoom=zoomFor(camera);
  return {near:distance-sphere.radius<limits.end*zoom,far:distance+sphere.radius>limits.start*zoom};
 };
 const meshes=new Set(),pairs=[];
 let materialVersion=material.version,wallInstances=0;
 function batch(geometry,drawMaterial,matrices,group){
  const mesh=new THREE.InstancedMesh(geometry,drawMaterial,matrices.length);
  matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
  mesh.instanceMatrix.needsUpdate=true;
  mesh.computeBoundingSphere();
  mesh.name='Kunlum fence cast';
  group.add(mesh);
  meshes.add(mesh);
  return mesh;
 }
 function dispose(){
  for(const mesh of meshes){mesh.removeFromParent();mesh.dispose();}
  meshes.clear();
  for(const {mesh} of shells){mesh.removeFromParent();mesh.geometry.dispose();}
  if(towerShell){towerShell.removeFromParent();towerShell.geometry.dispose();}
  if(towerBaseMaterial)monument.material=originalTowerMaterial;
  const owned=new Set([nearSource,farSource,nearMaterial,farMaterial,shellBase,wallShellMaterial,
   towerShellMaterial,towerFacingMaterial,towerBaseMaterial]);
  if(distantShells)owned.add(fallbackWallMaterial);
  for(const variant of owned)variant?.dispose();
 }
 function update(camera){
  if(root.userData.disposed||!camera)return false;
  if(materialVersion!==material.version){
   materialVersion=material.version;
   for(const variant of new Set([nearMaterial,farMaterial,fallbackWallMaterial,towerFacingMaterial].filter(v=>v&&v!==material))){
    variant.copy(material);
    variant.needsUpdate=true;
   }
  }
  for(const {near,far} of pairs){
   const visible=fenceLodVisibility(camera.position,near.boundingSphere);
   near.visible=visible.near;
   far.visible=visible.far;
  }
  let shellCount=0;
  for(const {mesh,details,unpaired} of shells){
   const visible=shellVisibility(camera,mesh,WALL_SHELL);
   mesh.visible=visible.far;
   if(mesh.visible)shellCount++;
   if(!visible.near)for(const detail of details)detail.visible=false;
   else for(const detail of unpaired)detail.visible=true;
  }
  if(towerShell){
   const visible=shellVisibility(camera,towerShell,TOWER_SHELL);
   towerShell.visible=visible.far;
   monument.visible=visible.near;
   for(const mesh of towerMeshes)mesh.visible=visible.near;
  }
  const nearCount=pairs.reduce((n,{near})=>n+(near.visible?near.count:0),0);
  const farCount=pairs.reduce((n,{far})=>n+(far.visible?far.count:0),0);
  root.userData.ruinLOD={nearCount,farCount,shellCount,towerShell:!!towerShell?.visible};
  return true;
 }
 root.userData.ruinLodController={update,dispose};
 for(let i=0;i<chunks.length;i++){
  if(root.userData.disposed)return null;
  const chunk=chunks[i],group=groups[chunk.layer].group;
  const bins=models.map(()=>[]);
  const details=[],unpaired=new Set();
  for(const seg of chunk.segments)fenceMatrices(seg,models,bins);
  for(let k=0;k<models.length;k++){
   if(!bins[k].length)continue;
   const {near,far}=models[k];
   const full=batch(near,far?nearMaterial:fallbackWallMaterial,bins[k],group);
   details.push(full);
   if(far){
    const middle=batch(far,farMaterial,bins[k],group);
    pairs.push({near:full,far:middle});
    details.push(middle);
   }else unpaired.add(full);
   wallInstances+=bins[k].length;
  }
  if(distantShells&&details.length){
   const mesh=createDistantMasonry(THREE,distantWallPositions(chunk.segments),wallShellMaterial);
   mesh.name='Kunlum distant wall shell';
   mesh.visible=false;
   group.add(mesh);
   shells.push({mesh,details,unpaired});
  }
  if(i%4===3)await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(root.userData.disposed)return null;
 const segments=chunks.reduce((n,c)=>n+c.segments.length,0);
 root.userData.wallFacadeChunks=chunks.length;
 root.userData.ruinPlacementMode='baked-fence-lod-v1';
 root.userData.bakedFenceBlocks=wallInstances;
 root.userData.common100WallSegments=segments;
 let total=0;
 if(monument?.userData?.common100TowerBase){
  const {manifest,geometries}=await loadLibrary();
  if(root.userData.disposed)return null;
  const sources=manifest.models.filter(m=>m.category==='main'||m.category==='large');
  const count=mobile?12:24;
  const selected=Array.from({length:count},
   (_,i)=>sources[Math.floor((i+.5)*sources.length/count)]);
  const models=selected.map(({name})=>{
   const source=geometries.get(name),size=source&&usable(source);
   if(!size)throw Error('Common100 stone source missing: '+name);
   return {name,geometry:getApprovedStoneSurfaceGeometry(source),size};
  });
  const dummy=new THREE.Object3D();
  const {x,z,baseY,height:H}=monument.userData.common100TowerBase;
  const positions=distantShells?await loadDistantTower().catch(error=>{
   console.warn('Kunlum tower LOD unavailable:',error);
   return null;
  }):null;
  if(root.userData.disposed)return null;
  if(positions){
   towerShellMaterial=masonryFade(shellBase,{...TOWER_SHELL,distant:true});
   towerFacingMaterial=masonryFade(material,TOWER_SHELL);
   originalTowerMaterial=monument.material;
   towerBaseMaterial=masonryFade(originalTowerMaterial,TOWER_SHELL);
   monument.material=towerBaseMaterial;
   towerShell=createDistantMasonry(THREE,positions,towerShellMaterial);
   towerShell.position.set(x,baseY,z);
   towerShell.visible=false;
   towerShell.name='Abay-Kala distant shell';
   root.add(towerShell);
  }
  const rows=mobile?30:44,columns=mobile?7:11;
  const bins=models.map(()=>[]);
  for(let side=0;side<4;side++)for(let row=0;row<rows;row++){
   const h=H/rows,y=baseY+(row+.5)*h,relative=(row+.5)/rows;
   const width=6-(6-4.65)*relative,radius=width/2+.025;
   const nx=side===0?0:side===1?0:side===2?1:-1;
   const nz=side===0?1:side===1?-1:0;
   for(let col=0;col<columns;col++){
    const u=(col+.5+(row%2)*.20)/columns-.5;
    if(Math.abs(u)>.495)continue;
    // Preserve existing arched doorway and two window openings on the front.
    if(side===0&&Math.abs(u)<.09&&(y-baseY<2.6||
      (y-baseY>5.3&&y-baseY<7)||(y-baseY>9.5&&y-baseY<11.1)))continue;
    const k=Math.floor(hash(u*70,row,side)*models.length),model=models[k];
    const across=u*width;
    const px=x+nx*radius+(side<2?across:0);
    const pz=z+nz*radius+(side>=2?across:0);
    dummy.position.set(px,y,pz);
    dummy.rotation.set(0,Math.atan2(nx,nz),0);
    dummy.scale.set((width/columns*1.12)/model.size.x,(h*1.12)/model.size.y,.19/model.size.z);
    dummy.updateMatrix();
    bins[k].push(dummy.matrix.clone());
  }
  }
  for(let k=0;k<models.length;k++){
   if(!bins[k].length)continue;
   const inst=new THREE.InstancedMesh(models[k].geometry,towerFacingMaterial||material,bins[k].length);
   inst.name='Abay-Kala Common100 '+models[k].name;inst.frustumCulled=false;
   bins[k].forEach((matrix,j)=>inst.setMatrixAt(j,matrix));
   meshes.add(inst);
   towerMeshes.push(inst);
   inst.instanceMatrix.needsUpdate=true;root.add(inst);
   total+=bins[k].length;
  }
 }
 root.userData.common100StoneCount=total;
 return {stones:total,blocks:wallInstances,segments,update,dispose};
}
