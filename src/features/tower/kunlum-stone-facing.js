/** Real Common 100 stone facing shared by the live village and 3D editor.
 * Instanced LOD; each rough physical stone is embedded in a watertight backing.
 * No new pseudo-cubic substitute stones, no independent palette or textures.
 */
import * as THREE from '../../vendor/three/three.module.js';
import {loadCommon100} from '../masonry/library.js?v=17.7-approved-masonry.1';
import {getApprovedStoneSurfaceGeometry,applyRockSurface,getRockSurface} from './rock-surface.js?v=balkaria-stone-v2.1-light-ochre.2';
import {kunlumRuinCrown,kunlumRuinFoot} from './kunlum-wall-ground.js';

const hash=(x,y,z)=>{const v=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453123;return v-Math.floor(v)};
const LANDMARK=[7.5,15];
const usable=(geom)=>{
 const box=geom.boundingBox||(geom.computeBoundingBox(),geom.boundingBox);
 const size=box.getSize(new THREE.Vector3());
 return size.x>.01&&size.y>.01&&size.z>.01?size:null;
};
// Geometric low-detail stones for distant walls. These are real faceted 3D
// objects, not stretched Common100 blocks, decals or repeated image panels.
function makeDistanceStone(seed){
 const r=n=>hash(seed*13.7,n*7.3,seed+n*3.1)-.5;
 // Six uneven, chamfered rock shoulders and a broad fractured face.
 // This is intentionally an irregular stone, never a rectangular brick
 // or a pyramid. Real Common100 rocks replace this LOD near the player.
 const outline=[
  [-.49+r(1)*.12,-.20+r(2)*.12],
  [-.32+r(3)*.16,-.48+r(4)*.08],
  [ .36+r(5)*.16,-.47+r(6)*.09],
  [ .49+r(7)*.12,-.18+r(8)*.12],
  [ .37+r(9)*.16, .44+r(10)*.10],
  [-.40+r(11)*.16,.46+r(12)*.09]
 ];
 const outer=outline.map(([x,y],i)=>[x,y,.23+r(i+13)*.035]);
 const face=outline.map(([x,y],i)=>[x*(.84+r(i+21)*.05),y*(.86+r(i+29)*.04),.39+r(i+37)*.035]);
 const back=outline.map(([x,y],i)=>[x*1.02,y*.97,-.29+r(i+45)*.04]);
 const middle=[r(52)*.14,r(53)*.12,.40+r(54)*.035],verts=[];
 const tri=(a,b,c)=>verts.push(...a,...b,...c);
 for(let i=0;i<outline.length;i++){
  const j=(i+1)%outline.length;
  tri(outer[i],outer[j],face[j]);
  tri(outer[i],face[j],face[i]);
  tri(middle,face[i],face[j]);
 }
 for(let i=1;i<outline.length-1;i++)tri(back[0],back[i+1],back[i]);
 for(let i=0;i<outline.length;i++){
  const j=(i+1)%outline.length;
  tri(outer[i],back[i],back[j]);
  tri(outer[i],back[j],outer[j]);
 }
 const raw=new THREE.BufferGeometry();
 raw.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 raw.computeVertexNormals();
 const geometry=getApprovedStoneSurfaceGeometry(raw);raw.dispose();
 return geometry;
}
/** The complete settlement shares one renderer and material regardless of
 * confirmation origin. The original Common100 has bounded real-world sizes
 * close to the player. Farther away, inexpensive irregular solid stones form
 * complete tight courses; no stone is ever enlarged to span an entire wall.
 */
export async function enhanceKunlumStoneWalls(THREE,root,groups,{
 renderer,materialPromise,mobile=false,monument=null
}={}){
 const material=await (materialPromise||getRockSurface(renderer));
 if(root.userData.disposed)return null;
 for(const container of groups)applyRockSurface(container.group,material);
 if(monument)applyRockSurface(monument,material);
 const dummy=new THREE.Object3D(),shade=new THREE.Color();
 const jobs=groups.flatMap((entry,layer)=>entry.segments.map(seg=>({
  seg,layer,distance:Math.hypot((seg.a[0]+seg.b[0])*.5-LANDMARK[0],
                             (seg.a[1]+seg.b[1])*.5-LANDMARK[1])
 }))).filter(({seg})=>Math.hypot(seg.b[0]-seg.a[0],seg.b[1]-seg.a[1])>=.01)
  .sort((a,b)=>a.distance-b.distance);
 // Unlike an all-village instance budget, this never enlarges individual
 // stones if there are more wall segments than GPU capacity.
 // Reserve Common100 budget FIRST. A near wall must not simultaneously
 // render the regular far-row substitute underneath its wild facing.
 const budget=mobile?3200:7200,nearJobs=new Set();
 let reserved=0;
 jobs.forEach(({seg,distance},i)=>{
  if(distance>(mobile?45:70))return;
  const len=Math.hypot(seg.b[0]-seg.a[0],seg.b[1]-seg.a[1]);
  const required=Math.max(1,Math.ceil(len/.57))*
   Math.max(3,Math.ceil(seg.height/.34))*2;
  if(reserved+required>budget)return;
  reserved+=required;nearJobs.add(i);
 });
 const detailGeometry=Array.from({length:8},(_,i)=>makeDistanceStone(i+1));
 const farBins=new Map();
 const chunkWidth=85; // metres: bound visibility to small terrain regions
 let total=0;
 for(let i=0;i<jobs.length;i++){
  const {seg,layer,distance}=jobs[i];
  if(nearJobs.has(i))continue;
  const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],length=Math.hypot(dx,dz);
  const nx=-dz/length,nz=dx/length,yaw=Math.atan2(nx,nz);
  // Geometry stays stone-sized throughout the village, including long traces.
  const step=distance>200?1.00:distance>70?.85:.65;
  const columns=Math.max(1,Math.ceil(length/step));
  const rows=Math.max(2,Math.ceil(seg.height/(distance>200?.68:distance>70?.54:.44)));
  for(let row=0;row<rows;row++){
   // Each course uses independent unequal stone widths. Vertical joints
   // cannot line up into a repetitive modern-brick pattern.
   const widths=Array.from({length:columns},(_,col)=>
    .70+.60*hash(seg.a[0]+row*7.1,col*3.7,seg.a[1]+i));
   const sum=widths.reduce((a,b)=>a+b,0);
   let left=0;
   for(let col=0;col<columns;col++){
    const right=col===columns-1?1:left+widths[col]/sum;
    const t=(left+right)/2,x=seg.a[0]+dx*t,z=seg.a[1]+dz*t;
    const w=(right-left)*length,h=seg.height/rows;
    const foot=kunlumRuinFoot(x,z,seg.width,seg.heightAt,[nx,nz]);
    const crown=seg.heightAt(x,z)+kunlumRuinCrown(seg.height,x,z);
    const stagger=(hash(x*1.3,row,z*1.7)-.5)*h*.15;
    const bottom=foot+row*h+stagger;
    const visibleH=Math.min(h*1.24,crown-bottom+.025);
    if(visibleH<.09){left=right;continue;}
    const kind=Math.floor(hash(x,row,z+col)*detailGeometry.length);
    for(const side of [-1,1]){
     dummy.position.set(x+side*nx*(seg.width*.5+.025),
                        bottom+visibleH*.50,
                        z+side*nz*(seg.width*.5+.025));
     dummy.rotation.set((hash(z,row,x)-.5)*.16,
                        yaw+(side<0?Math.PI:0),
                        (hash(row,x,z)>.50?Math.PI:0)+(hash(row,x,z)-.5)*.12);
     dummy.scale.set(w*1.065,visibleH,.27);
     dummy.updateMatrix();
     const key=layer+':'+kind+':'+Math.floor(x/chunkWidth)+':'+Math.floor(z/chunkWidth);
     let bucket=farBins.get(key);
     if(!bucket){bucket={layer,kind,matrices:[]};farBins.set(key,bucket);}
     bucket.matrices.push(dummy.matrix.clone());total++;
    }
    left=right;
   }
  }
  // Loading historic decoration cannot monopolize Android's UI thread.
  if(i%85===84){
   await new Promise(resolve=>setTimeout(resolve,0));
   if(root.userData.disposed){detailGeometry.forEach(g=>g.dispose());return null;}
  }
 }
 for(const {layer,kind,matrices} of farBins.values()){
  const mesh=new THREE.InstancedMesh(detailGeometry[kind],material,matrices.length);
  mesh.name='Solid masonry LOD '+kind;
  matrices.forEach((matrix,i)=>{
   mesh.setMatrixAt(i,matrix);
   shade.setScalar(.90+.10*hash(kind,i,layer));
   mesh.setColorAt(i,shade);
  });
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  // Unlike the former settlement-wide mesh, each 85m cluster can be
  // rejected by the GPU camera frustum without inspecting its stones.
  mesh.computeBoundingSphere();
  mesh.frustumCulled=true;
  groups[layer].group.add(mesh);
 }
 root.userData.wallFacadeChunks=farBins.size;
 root.userData.wallFacadeGeometries=detailGeometry;
 if(root.userData.disposed)return null;
 const {manifest,geometries}=await loadCommon100();
 if(root.userData.disposed)return null;
 // Varied original author-made rock shapes, distributed deterministically
 // rather than the six identical forms in the previous renderer.
 const sources=manifest.models.filter(m=>m.category==='main'||m.category==='large');
 const count=mobile?32:52;
 const selected=Array.from({length:count},(_,i)=>sources[Math.floor((i+.5)*sources.length/count)]);
 const models=selected.map(({name})=>{
  const source=geometries.get(name),size=source&&usable(source);
  if(!size)throw Error('Common100 stone source missing: '+name);
  return {name,geometry:getApprovedStoneSurfaceGeometry(source),size};
 });
 const bins=groups.map(()=>models.map(()=>[]));
 let actual=0;
 for(let index=0;index<jobs.length;index++){
  const job=jobs[index],{seg,layer,distance}=job;
  if(!nearJobs.has(index))continue;
  const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],length=Math.hypot(dx,dz);
  const columns=Math.max(1,Math.ceil(length/.57));
  const rows=Math.max(3,Math.ceil(seg.height/.34));
  const needed=columns*rows*2;
  if(actual+needed>budget)continue; // no stretched leftovers
  const nx=-dz/length,nz=dx/length,yaw=Math.atan2(nx,nz);
  for(let row=0;row<rows;row++)
   for(let col=0;col<columns;col++){
    const offset=row%2?.45:0;
    const t=Math.min(.98,Math.max(.02,(col+.5+offset)/columns));
    const x=seg.a[0]+dx*t,z=seg.a[1]+dz*t;
    const w=length/columns*(1.035+.065*hash(x,row,z));
    const h=seg.height/rows;
    const foot=kunlumRuinFoot(x,z,seg.width,seg.heightAt,[nx,nz]);
    const crown=seg.heightAt(x,z)+kunlumRuinCrown(seg.height,x,z);
    const bottom=foot+row*h+(hash(x,row,z)-.5)*h*.13;
    const visibleH=Math.min(h*(1.16+.12*hash(z,row,x)),crown-bottom+.03);
    if(visibleH<.08)continue;
    const k=Math.floor(hash(x+index,row*17+col*7,z)*models.length);
    const model=models[k];
    for(const side of [-1,1]){
     dummy.position.set(x+side*nx*(seg.width*.5+.082),
                        bottom+visibleH*.49,
                        z+side*nz*(seg.width*.5+.082));
     dummy.rotation.set((hash(x,z,row)-.5)*.15,
                        yaw+(side<0?Math.PI:0),
                        (hash(z,x,col)-.5)*.18);
     dummy.scale.set(w/model.size.x,visibleH/model.size.y,
                     (.23+.035*hash(row,z,x))/model.size.z);
     dummy.updateMatrix();
     bins[layer][k].push(dummy.matrix.clone());
     actual++;
    }
   }
 }
 for(let layer=0;layer<groups.length;layer++)
  for(let k=0;k<models.length;k++){
   const matrices=bins[layer][k];if(!matrices.length)continue;
   const mesh=new THREE.InstancedMesh(models[k].geometry,material,matrices.length);
   mesh.name='Common100 bounded wall stone '+models[k].name;
   mesh.frustumCulled=false;
   matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
   mesh.instanceMatrix.needsUpdate=true;
   groups[layer].group.add(mesh);
  }
 root.userData.common100FacingDensity=1;
 root.userData.common100NearOnlyWallSegments=nearJobs.size;
 root.userData.ruinedCrown='shared-profile-v1';
 root.userData.common100ActualWallStones=actual;
 root.userData.wallFacadeLODStones=total;
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
 root.userData.common100StoneCount=total+actual;
 root.userData.common100WallSegments=jobs.length;
 root.userData.common100Material=material.name;
 return {stones:total+actual,common100:actual,models:models.map(x=>x.name)};
}
