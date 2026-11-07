/** Deterministic mapped Kunlum casts with exclusive, offline-prepared LODs. */
import * as THREE from '../../vendor/three/three.module.js';
import {loadCommon100} from '../masonry/library.js?v=17.7-approved-masonry.1';
import {getApprovedStoneSurfaceGeometry,applyRockSurface,getRockSurface} from './rock-surface.js?v=balkaria-stone-v2.1-light-ochre.2';
import {loadBakedMasonry} from './baked-masonry.js?v=5';
import {kunlumRuinCrown,kunlumRuinFoot} from './kunlum-wall-ground.js?v=17.2.77';
import {groupRuinSegments,ruinChunkDistance,selectRuinLOD} from './kunlum-ruin-lod.mjs?v=17.2.85';
import {createDistantMasonry,loadDistantTower} from './kunlum-distant-masonry.js';
import {loadKunlumPrebakedLOD} from './kunlum-prebaked-lod.js';

const FENCE_SECTIONS=['manual-2x2x2-v3','manual-3x3x3-v2'];
const CELL_WIDTH=.65,CELL_HEIGHT=.56;
const hash=(x,y,z)=>{
 const v=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453123;
 return v-Math.floor(v);
};
const usable=geom=>{
 const box=geom.boundingBox||(geom.computeBoundingBox(),geom.boundingBox);
 const size=box.getSize(new THREE.Vector3());
 return size.x>.01&&size.y>.01&&size.z>.01?size:null;
};

/** Preserve natural 50–80 cm authored stone dimensions instead of inflating
 * one 50 cm prefab into a 1.35 × 1.5 m cuboid. */
function fenceMatrices(seg,models,bins){
 const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],len=Math.hypot(dx,dz);
 if(len<.01)return;
 const ux=dx/len,uz=dz/len;
 const columns=Math.ceil(len/CELL_WIDTH);
 const step=len/columns;
 const dummy=new THREE.Object3D();
 for(let c=0;c<columns;c++){
  const dist=(c+.5)*step,x=seg.a[0]+ux*dist,z=seg.a[1]+uz*dist;
  const base=kunlumRuinFoot(x,z,seg.width,seg.heightAt,[-uz,ux]);
  const top=seg.heightAt(x,z)+kunlumRuinCrown(seg.height,x,z);
  const height=top-base;
  if(!(height>.16))continue;
  const rows=Math.ceil(height/CELL_HEIGHT),course=height/rows;
  for(let row=0;row<rows;row++){
   const index=Math.floor(hash(x+row*1.7,c*3.13,z)*models.length);
   const {box,size,center}=models[index];
   dummy.rotation.set(0,-Math.atan2(dz,dx)+((c+row)%2)*Math.PI,0);
   dummy.scale.set(step/size.x,course/size.y,seg.width/size.z);
   dummy.position.set(-center.x,-box.min.y,-center.z)
     .multiply(dummy.scale).applyEuler(dummy.rotation)
     .add(new THREE.Vector3(x,base+row*course,z));
   dummy.updateMatrix();
   bins[index].push(dummy.matrix.clone());
  }
 }
}
const zoomFor=camera=>Math.max(.3,Math.abs(camera.projectionMatrix.elements[5])/2.60509);

export async function enhanceKunlumStoneWalls(THREE,root,groups,{
 renderer,materialPromise,mobile=false,monument=null,
 loadLibrary=loadCommon100,loadSection=loadBakedMasonry,
 loadLOD=loadKunlumPrebakedLOD,distantShells=false
}={}){
 const material=await (materialPromise||getRockSurface(renderer));
 if(root.userData.disposed)return null;
 if(monument)applyRockSurface(monument,material);
 const chunks=groupRuinSegments(groups.flatMap((entry,layer)=>
  entry.segments.map(seg=>({seg,layer}))),64);
 chunks.sort((a,b)=>ruinChunkDistance({x:0,z:0},a.bounds)-
  ruinChunkDistance({x:0,z:0},b.bounds));
 const models=chunks.length?await Promise.all(FENCE_SECTIONS.map(async id=>{
  const cast=await loadSection(id,{cast:true});
  if(!cast)throw Error('Missing approved Kunlum cast: '+id);
  const size=usable(cast);
  if(!size)throw Error('Invalid source cast bounds: '+id);
  let distant=[];
  try{
   distant=await Promise.all([1,2,3].map(level=>loadLOD(id,level,{renderer})));
   for(const [i,asset] of distant.entries()){
    if(!asset?.geometry||!asset?.material||!usable(asset.geometry))
     throw Error('Incomplete baked LOD '+(i+1)+' for '+id);
    const near=cast.boundingBox,far=asset.geometry.boundingBox;
    for(const axis of ['x','y','z']){
     if(Math.abs(near.min[axis]-far.min[axis])>.015||
        Math.abs(near.max[axis]-far.max[axis])>.015)
      throw Error('Mismatched LOD bounds '+id+' '+axis);
    }
   }
  }catch(error){
   // The original approved models always remain available; a failed optional
   // atlas can never leave holes in the village while the release propagates.
   console.warn('Kunlum prebaked LOD unavailable, using known casts:',error);
   const fallback=await loadSection(id,{fenceLod:true}).catch(()=>null)||cast;
   distant=[1,2,3].map(()=>({geometry:fallback,material}));
  }
  const box=cast.boundingBox;
  return {id,cast,distant,box,size,center:box.getCenter(new THREE.Vector3())};
 })):[];

 if(root.userData.disposed)return null;
 const ownedMeshes=new Set(),wallChunks=[],towerMeshes=[];
 const towerLevels=[];
 let towerState=null;
 let blocks=0;
 function batch(geometry,drawMaterial,matrices,group,level){
  const mesh=new THREE.InstancedMesh(geometry,drawMaterial,matrices.length);
  matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
  mesh.instanceMatrix.needsUpdate=true;
  mesh.computeBoundingSphere();
  mesh.name='Kunlum approved fence LOD '+level;
  mesh.userData.kunlumLOD=level;
  mesh.visible=level===0;
  group.add(mesh);ownedMeshes.add(mesh);
  return mesh;
 }
 for(let i=0;i<chunks.length;i++){
  if(root.userData.disposed)return null;
  const chunk=chunks[i],group=groups[chunk.layer].group;
  const bins=models.map(()=>[]);
  for(const seg of chunk.segments)fenceMatrices(seg,models,bins);
  const levels=[[],[],[],[]];
  for(let k=0;k<models.length;k++){
   if(!bins[k].length)continue;
   const model=models[k];
   levels[0].push(batch(model.cast,material,bins[k],group,0));
   for(let level=1;level<=3;level++){
    const asset=model.distant[level-1];
    levels[level].push(batch(asset.geometry,asset.material,bins[k],group,level));
   }
   blocks+=bins[k].length;
  }
  wallChunks.push({bounds:chunk.bounds,levels,selected:0});
  if(i%4===3)await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(root.userData.disposed)return null;
 const segmentCount=chunks.reduce((n,c)=>n+c.segments.length,0);
 root.userData.wallFacadeChunks=chunks.length;
 root.userData.ruinPlacementMode='approved-offline-lod-v2';
 root.userData.bakedFenceBlocks=blocks;
 root.userData.common100WallSegments=segmentCount;

 let stoneCount=0;
 if(monument?.userData?.common100TowerBase){
  const {manifest,geometries}=await loadLibrary();
  if(root.userData.disposed)return null;
  const sources=manifest.models.filter(m=>m.category==='main'||m.category==='large');
  const count=mobile?12:24;
  const selected=Array.from({length:count},
   (_,i)=>sources[Math.floor((i+.5)*sources.length/count)]);
  const stones=selected.map(({name})=>{
   const source=geometries.get(name),size=source&&usable(source);
   if(!size)throw Error('Common100 stone source missing: '+name);
   return {name,geometry:getApprovedStoneSurfaceGeometry(source),size};
  });
  const {x,z,baseY,height:H}=monument.userData.common100TowerBase;
  if(distantShells){
   try{
    const assets=await Promise.all([1,2,3].map(level=>loadLOD('abay-kala',level,{renderer})));
    if(root.userData.disposed)return null;
    for(let i=0;i<assets.length;i++){
     const asset=assets[i];
     if(!asset?.geometry||!asset?.material||!usable(asset.geometry))
      throw Error('Invalid Abay-Kala baked LOD '+(i+1));
    }
    for(let i=0;i<assets.length;i++){
     const {geometry,material:atlas}=assets[i];
     const mesh=new THREE.Mesh(geometry,atlas);
     mesh.name='Abay-Kala prebaked LOD '+(i+1);
     mesh.position.set(x,baseY,z);
     mesh.userData.kunlumTowerLOD=i+1;
     mesh.visible=false;
     root.add(mesh);towerLevels.push(mesh);
    }
   }catch(error){
    console.warn('Abay-Kala prebaked LOD unavailable; retaining approved near geometry:',error);
   }
  }
  const dummy=new THREE.Object3D();
  const rows=mobile?30:44,columns=mobile?7:11;
  const bins=stones.map(()=>[]);
  for(let side=0;side<4;side++)for(let row=0;row<rows;row++){
   const h=H/rows,y=baseY+(row+.5)*h,relative=(row+.5)/rows;
   const width=6-(6-4.65)*relative,radius=width/2+.025;
   const nx=side===2?1:side===3?-1:0;
   const nz=side===0?1:side===1?-1:0;
   for(let col=0;col<columns;col++){
    const u=(col+.5+(row%2)*.20)/columns-.5;
    if(Math.abs(u)>.495)continue;
    if(side===0&&Math.abs(u)<.09&&(y-baseY<2.6||
      (y-baseY>5.3&&y-baseY<7)||(y-baseY>9.5&&y-baseY<11.1)))continue;
    const k=Math.floor(hash(u*70,row,side)*stones.length),model=stones[k];
    const across=u*width;
    const px=x+nx*radius+(side<2?across:0);
    const pz=z+nz*radius+(side>=2?across:0);
    dummy.position.set(px,y,pz);
    dummy.rotation.set(0,Math.atan2(nx,nz),0);
    dummy.scale.set((width/columns*1.12)/model.size.x,
      (h*1.12)/model.size.y,.19/model.size.z);
    dummy.updateMatrix();bins[k].push(dummy.matrix.clone());
   }
  }
  for(let k=0;k<stones.length;k++){
   if(!bins[k].length)continue;
   const inst=new THREE.InstancedMesh(stones[k].geometry,material,bins[k].length);
   inst.name='Abay-Kala Common100 '+stones[k].name;
   inst.frustumCulled=false;
   bins[k].forEach((m,i)=>inst.setMatrixAt(i,m));
   inst.instanceMatrix.needsUpdate=true;
   root.add(inst);ownedMeshes.add(inst);towerMeshes.push(inst);
   stoneCount+=bins[k].length;
  }
 }
 root.userData.common100StoneCount=stoneCount;
 function update(camera){
  if(root.userData.disposed||!camera)return false;
  const active=[0,0,0,0],zoom=zoomFor(camera);
  for(const chunk of wallChunks){
   chunk.selected=selectRuinLOD(
    ruinChunkDistance(camera.position,chunk.bounds)/zoom,chunk.selected,
    mobile?[14,42,100]:undefined);
   for(let level=0;level<4;level++)for(const mesh of chunk.levels[level]){
    mesh.visible=chunk.selected===level;
    if(mesh.visible)active[level]+=mesh.count;
   }
  }
  if(towerLevels.length===3){
   const sphere=new THREE.Sphere(new THREE.Vector3(
    monument.userData.common100TowerBase.x,
    monument.userData.common100TowerBase.baseY+monument.userData.common100TowerBase.height*.5,
    monument.userData.common100TowerBase.z
   ),monument.userData.common100TowerBase.height*.65);
   const distance=Math.max(0,camera.position.distanceTo(sphere.center)-sphere.radius);
   towerState=selectRuinLOD(distance/zoom,towerState,[65,145,300]);
   monument.visible=towerState===0;
   for(const stone of towerMeshes)stone.visible=towerState===0;
   for(const mesh of towerLevels)mesh.visible=mesh.userData.kunlumTowerLOD===towerState;
  }else{
   towerState=0;
   monument.visible=true;
   for(const stone of towerMeshes)stone.visible=true;
  }
  root.userData.ruinLOD={
   nearCount:active[0],farCount:active[1]+active[2]+active[3],
   activeLevels:active,shellCount:0,towerShell:towerState>0,towerLOD:towerState
  };
  return true;
 }
 function dispose(){
  for(const mesh of ownedMeshes){mesh.removeFromParent();mesh.dispose();}
  ownedMeshes.clear();
  for(const mesh of towerLevels)mesh.removeFromParent();
 }
 root.userData.ruinLodController={update,dispose};
 return {stones:stoneCount,blocks,segments:segmentCount,update,dispose};
}
