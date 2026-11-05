/** Real Common 100 stone facing shared by the live village and 3D editor.
 * Permanent Common100 geometry at every distance; only texture mipmaps vary.
 * Spatial instancing and frustum culling avoid changing the shape.
 */
import * as THREE from '../../vendor/three/three.module.js';
import {loadCommon100} from '../masonry/library.js?v=17.7-approved-masonry.1';
import {getApprovedStoneSurfaceGeometry,applyRockSurface,getRockSurface} from './rock-surface.js?v=balkaria-stone-v2.1-light-ochre.2';
import {layoutKunlumRuinStones} from './kunlum-ruin-layout.js?v=17.2.80';
import {BAKED_MASONRY_PILOT,loadBakedMasonry} from './baked-masonry.js?v=3';
import {kunlumRuinCrown,kunlumRuinFoot} from './kunlum-wall-ground.js?v=17.2.77';
import {groupRuinSegments,ruinChunkDistance} from './kunlum-ruin-lod.mjs?v=17.2.80';

const hash=(x,y,z)=>{const v=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453123;return v-Math.floor(v)};
const usable=(geom)=>{
 const box=geom.boundingBox||(geom.computeBoundingBox(),geom.boundingBox);
 const size=box.getSize(new THREE.Vector3());
 return size.x>.01&&size.y>.01&&size.z>.01?size:null;
};
function buildBakedFencePilot(seg,geometry,material){
 const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],length=Math.hypot(dx,dz);
 const xDir=dx/length,zDir=dz/length;
 const size=geometry.boundingBox.getSize(new THREE.Vector3());
 const center=geometry.boundingBox.getCenter(new THREE.Vector3());
 const count=4,step=length/count,overlap=.05;
 const blocks=new THREE.InstancedMesh(geometry,material,count);
 const instance=new THREE.Object3D();
 for(let i=0;i<count;i++){
  // Overlap adjacent envelopes while keeping both ends in the cut wall interval.
  const start=Math.max(0,i*step-overlap),end=Math.min(length,(i+1)*step+overlap);
  const middle=(start+end)*.5;
  const x=seg.a[0]+xDir*middle,z=seg.a[1]+zDir*middle;
  const foot=Math.min(...[start,middle,end].map(distance=>kunlumRuinFoot(
   seg.a[0]+xDir*distance,seg.a[1]+zDir*distance,seg.width,seg.heightAt,[-zDir,xDir]
  )));
  const top=seg.heightAt(x,z)+kunlumRuinCrown(seg.height,x,z);
  if(!Number.isFinite(foot)||!Number.isFinite(top)||top<=foot){blocks.dispose();return null;}
  instance.rotation.y=-Math.atan2(dz,dx)+(i%2)*Math.PI;
  instance.scale.set((end-start)/size.x,(top-foot)/size.y,seg.width/size.z);
  instance.position.set(-center.x,-geometry.boundingBox.min.y,-center.z)
   .multiply(instance.scale).applyEuler(instance.rotation).add(new THREE.Vector3(x,foot,z));
  instance.updateMatrix();
  blocks.setMatrixAt(i,instance.matrix);
 }
 blocks.instanceMatrix.needsUpdate=true;
 blocks.computeBoundingSphere();
 blocks.name='Kunlum baked fence pilot V174';
 return blocks;
}

/** The full near-field stone arrangement is permanently used at every distance. */
export async function enhanceKunlumStoneWalls(THREE,root,groups,{
 renderer,materialPromise,mobile=false,monument=null,bakedFencePilot=false,loadLibrary=loadCommon100
}={}){
 const bakedTask=bakedFencePilot?loadBakedMasonry(BAKED_MASONRY_PILOT).catch(error=>{
  console.warn('Kunlum baked fence unavailable; keeping original stones:',error);
  return null;
 }):null;
 const material=await (materialPromise||getRockSurface(renderer));
 if(root.userData.disposed)return null;
 if(monument)applyRockSurface(monument,material);
 const chunks=groupRuinSegments(groups.flatMap((entry,layer)=>
  entry.segments.map(seg=>({seg,layer}))));
 // Build chunks nearest the site first, without changing them afterwards.
 chunks.sort((a,b)=>ruinChunkDistance({x:0,z:0},a.bounds)-
  ruinChunkDistance({x:0,z:0},b.bounds));
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
 const meshes=new Set(),buckets=[];
 let wallInstances=0;
 function installChunk(chunk,bakedGeometry=null){
  const group=new THREE.Group();
  group.name='Fixed Common100 ruin chunk '+chunk.key;
  const bins=models.map(()=>[]);
  for(const seg of chunk.segments){
   const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],length=Math.hypot(dx,dz);
   if(length<.01)continue;
   if(bakedGeometry){
    const pilot=buildBakedFencePilot(seg,bakedGeometry,material);
    if(pilot){
     group.add(pilot);meshes.add(pilot);
     root.userData.bakedFenceBlocks=pilot.count;
     continue;
    }
   }
   const nx=-dz/length,nz=dx/length,yaw=Math.atan2(nx,nz);
   for(const rock of layoutKunlumRuinStones(seg)){
    // Preserve the existing near-field geometry, on both desktop and mobile.
    for(const layerDepth of (mobile?[-1,1]:[-1,0,1])){
     const k=(rock.kind+(layerDepth+1)*7)%models.length;
     const offset=layerDepth*seg.width*.32;
     dummy.position.set(rock.x+nx*offset,rock.y-(layerDepth===0?.012:0),
                        rock.z+nz*offset);
     dummy.rotation.set(rock.tilt,yaw+(layerDepth<0?Math.PI:0),rock.lean);
     const model=models[k];
     dummy.scale.set(rock.width/model.size.x,rock.height/model.size.y,
                     (seg.width*.63)/model.size.z);
     dummy.updateMatrix();
     bins[k].push(dummy.matrix.clone());
    }
   }
  }
  for(let k=0;k<bins.length;k++){
   if(!bins[k].length)continue;
   const mesh=new THREE.InstancedMesh(models[k].geometry,material,bins[k].length);
   mesh.name='Fixed Common100 ruin stone '+k;
   bins[k].forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
   mesh.instanceMatrix.needsUpdate=true;
   mesh.computeBoundingSphere();
   mesh.frustumCulled=true;
   group.add(mesh);meshes.add(mesh);
   wallInstances+=bins[k].length;
  }
  groups[chunk.layer].group.add(group);
  buckets.push({...chunk,group});
 }
 // The optional GLB must not delay the rest of the mapped walls.
 let pilotChunk=null;
 // Yield between chunks. No proxy geometry is shown during loading.
 for(let i=0;i<chunks.length;i++){
  if(root.userData.disposed)return null;
  const chunk=chunks[i];
  const pilot=bakedTask&&chunk.layer===0&&!pilotChunk&&chunk.segments.find(seg=>{
   const length=Math.hypot(seg.b[0]-seg.a[0],seg.b[1]-seg.a[1]);
   return seg.featureId==='V174'&&length>3.2&&length<3.25;
  });
  if(pilot){
   pilotChunk={...chunk,segments:[pilot]};
   const segments=chunk.segments.filter(seg=>seg!==pilot);
   if(segments.length)installChunk({...chunk,segments});
  }else installChunk(chunk);
  if(i%2===1){
   await new Promise(resolve=>setTimeout(resolve,0));
   if(root.userData.disposed)return null;
  }
 }
 if(pilotChunk){
  const geometry=await bakedTask;
  if(root.userData.disposed)return null;
  installChunk(pilotChunk,geometry);
 }
 root.userData.wallFacadeChunks=buckets.length;
 root.userData.wallFacadeGeometries=[];
 root.userData.ruinPlacementMode='fixed-common100-instances-v1';
 root.userData.ruinedCrown='collapsed-profile-v2';
 root.userData.ruinFacingEngine='fixed Common100 / instanced stones / GPU mipmaps';
 root.userData.ruinWallStoneInstances=wallInstances;
 root.userData.common100FacingDensity=1;
 root.userData.common100Material=material.name;
 root.userData.common100NearOnlyWallSegments=0;
 root.userData.ruinFarSegments=0;
 let lastUpdate=-Infinity;
 function update(camera){
  if(root.userData.disposed||!camera)return false;
  const now=typeof performance!=='undefined'?performance.now():0;
  if(now-lastUpdate<300)return false;
  lastUpdate=now;
  root.userData.ruinLOD={
   chunks:buckets.length,mode:'fixed',stoneInstances:wallInstances,
   active:buckets.filter(bucket=>ruinChunkDistance(camera.position,bucket.bounds)<110).length
  };
  return true;
 }
 function dispose(){
  for(const mesh of meshes)mesh.dispose();
  meshes.clear();
 }
 root.userData.ruinLodController={update,dispose};
 let total=0,actual=0;
 // Abay-Kala uses the same real library stones. Facing follows the original
 // tapered monument polygon at every course, so no stones float outside it.
 if(monument?.userData?.common100TowerBase){
  const {x,z,baseY,height:H}=monument.userData.common100TowerBase;
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
   const inst=new THREE.InstancedMesh(models[k].geometry,material,bins[k].length);
   inst.name='Abay-Kala Common100 '+models[k].name;inst.frustumCulled=false;
   bins[k].forEach((matrix,j)=>inst.setMatrixAt(j,matrix));
   inst.instanceMatrix.needsUpdate=true;root.add(inst);
   total+=bins[k].length;
  }
 }
 root.userData.common100StoneCount=total+actual+wallInstances;
 root.userData.common100WallSegments=chunks.reduce((n,c)=>n+c.segments.length,0);
 return {stones:total+actual+wallInstances,segments:root.userData.common100WallSegments,models:models.map(x=>x.name),update,dispose};
}
