/** Real Common 100 stone facing shared by the live village and 3D editor.
 * Instanced LOD; each rough physical stone is embedded in a watertight backing.
 * No new pseudo-cubic substitute stones, no independent palette or textures.
 */
import * as THREE from '../../vendor/three/three.module.js';
import {loadCommon100} from '../masonry/library.js?v=17.7-approved-masonry.1';
import {getApprovedStoneSurfaceGeometry,applyRockSurface,getRockSurface} from './rock-surface.js?v=balkaria-stone-v2.1-light-ochre.2';

const hash=(x,y,z)=>{const v=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453123;return v-Math.floor(v)};
const LANDMARK=[7.5,15];
const usable=(geom)=>{
 const box=geom.boundingBox||(geom.computeBoundingBox(),geom.boundingBox);
 const size=box.getSize(new THREE.Vector3());
 return size.x>.01&&size.y>.01&&size.z>.01?size:null;
};
/** Use the exact Common100 source geometry for visible stone courses.
 * Distant walls retain the identical PBR on an enclosed irregular masonry core.
 */
export async function enhanceKunlumStoneWalls(THREE,root,groups,{
 renderer,materialPromise,mobile=false,monument=null
}={}){
 const [material,{manifest,geometries}]=await Promise.all([
  materialPromise||getRockSurface(renderer),loadCommon100()
 ]);
 if(root.userData.disposed)return null; // Editor attaches layer groups independently
 const names=manifest.models.filter(m=>m.category==='main').map(m=>m.name);
 const choices=[3,14,26,37,49,60].map(i=>names[i]).filter(Boolean);
 if(choices.length!==6)throw Error('Common100 six stone variants missing');
 // Full PBR on every sealed wall body, including the Abay-Kala monument.
 for(const container of groups)applyRockSurface(container.group,material);
 if(monument)applyRockSurface(monument,material);
 const models=choices.map(name=>{
  const source=geometries.get(name),size=source&&usable(source);
  if(!size)throw Error('Common100 stone source missing: '+name);
  return {name,geometry:getApprovedStoneSurfaceGeometry(source),size};
 });
 const dummy=new THREE.Object3D();
 const laid=[];
 let total=0;
 for(const [layer,entry] of groups.entries()){
  const sorted=entry.segments.slice().sort((a,b)=>{
   const score=x=>Math.hypot((x.a[0]+x.b[0])*.5-LANDMARK[0],(x.a[1]+x.b[1])*.5-LANDMARK[1]);
   return score(a)-score(b);
  });
  const cap=mobile?(layer===1?1450:2100):(layer===1?4200:5200);
  const bins=models.map(()=>[]);
  let count=0;
  for(const seg of sorted){
   if(count>=cap)break;
   const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],length=Math.hypot(dx,dz);
   if(length<.16)continue;
   const x0=(seg.a[0]+seg.b[0])*.5,z0=(seg.a[1]+seg.b[1])*.5;
   const distance=Math.hypot(x0-LANDMARK[0],z0-LANDMARK[1]);
   const lod=distance>300?2.1:distance>110?1.45:1;
   const columns=Math.max(1,Math.ceil(length/(.57*lod)));
   const rows=Math.max(1,Math.ceil(seg.height/(.33*lod)));
   const ux=dx/length,uz=dz/length,nx=-uz,nz=ux;
   const yaw=Math.atan2(nx,nz);
   for(let row=0;row<rows&&count<cap;row++)for(let column=0;column<columns&&count<cap;column++){
    const t=Math.max(.015,Math.min(.985,(column+(row%2)*.5+.5)/columns));
    const sx=seg.a[0]+dx*t,sz=seg.a[1]+dz*t;
    const y0=seg.heightAt(sx,sz)+.08;
    const h=seg.height/rows*(.91+.07*hash(sx,sz,row));
    const y=y0+(row+.5)*seg.height/rows;
    const w=length/columns*(1.15+.13*hash(sx,sz,column));
    const shape=Math.floor(hash(sx,sz,row+column*13)*models.length);
    const model=models[shape];
    const heightScale=h/model.size.y,widthScale=w/model.size.x;
    for(const side of [-1,1]){
     if(count>=cap)break;
     dummy.position.set(sx+nx*side*(seg.width*.5+.035),y,sz+nz*side*(seg.width*.5+.035));
     dummy.rotation.set(hash(sx,sz,row)*.08-.04,yaw+(side<0?Math.PI:0),hash(sz,sx,column)*.08-.04);
     dummy.scale.set(widthScale,heightScale,.24/model.size.z);
     dummy.updateMatrix();
     bins[shape].push(dummy.matrix.clone());count++;
    }
   }
  }
  for(let k=0;k<models.length;k++){
   const entries=bins[k];if(!entries.length)continue;
   const instance=new THREE.InstancedMesh(models[k].geometry,material,entries.length);
   instance.name='Common100 genuine stone facing '+models[k].name;
   instance.frustumCulled=false;
   for(let i=0;i<entries.length;i++)instance.setMatrixAt(i,entries[i]);
   instance.instanceMatrix.needsUpdate=true;
   entry.group.add(instance);laid.push(instance);
  }
  total+=count;
 }

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
   inst.instanceMatrix.needsUpdate=true;root.add(inst);laid.push(inst);
   total+=bins[k].length;
  }
 }
 root.userData.common100StoneCount=total;
 root.userData.common100Material=material.name;
 return {stones:total,models:models.map(x=>x.name)};
}
