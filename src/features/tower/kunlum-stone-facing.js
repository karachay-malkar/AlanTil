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
// Geometric low-detail stones for distant walls. These are real faceted 3D
// objects, not stretched Common100 blocks, decals or repeated image panels.
function makeDistanceStone(seed){
 const r=n=>hash(seed*13.7,n*7.3,seed+n*3.1)-.5;
 const front=[
  [-.46+r(1)*.09,-.47+r(2)*.06,.28+r(3)*.07],
  [ .46+r(4)*.08,-.46+r(5)*.08,.30+r(6)*.08],
  [ .47+r(7)*.08, .46+r(8)*.08,.27+r(9)*.09],
  [-.47+r(10)*.08,.47+r(11)*.06,.29+r(12)*.08]
 ];
 const back=front.map((p,i)=>[p[0]*1.01,p[1]*.98,-.32+r(i+17)*.08]);
 const peak=[r(25)*.16,r(26)*.13,.47+r(27)*.14],vertices=[];
 const tri=(a,b,c)=>vertices.push(...a,...b,...c);
 for(let i=0;i<4;i++)tri(peak,front[i],front[(i+1)%4]);
 tri(back[0],back[2],back[1]);tri(back[0],back[3],back[2]);
 for(let i=0;i<4;i++){
  const j=(i+1)%4;
  tri(front[i],back[i],back[j]);tri(front[i],back[j],front[j]);
 }
 const raw=new THREE.BufferGeometry();
 raw.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
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
 const detailGeometry=Array.from({length:6},(_,i)=>makeDistanceStone(i+1));
 const farBins=groups.map(()=>detailGeometry.map(()=>[]));
 let total=0;
 for(let i=0;i<jobs.length;i++){
  const {seg,layer,distance}=jobs[i];
  const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],length=Math.hypot(dx,dz);
  const nx=-dz/length,nz=dx/length,yaw=Math.atan2(nx,nz);
  // Geometry stays stone-sized throughout the village, including long traces.
  const step=distance>200?.90:distance>70?.77:.65;
  const columns=Math.max(1,Math.ceil(length/step));
  const rows=Math.max(2,Math.ceil(seg.height/(distance>200?.57:.44)));
  for(let row=0;row<rows;row++){
   const stagger=row%2?-.5:0;
   for(let col=0;col<=columns;col++){
    const left=Math.max(0,(col+stagger)/columns);
    const right=Math.min(1,(col+stagger+1)/columns);
    if(right-left<.012)continue;
    const t=(left+right)/2,x=seg.a[0]+dx*t,z=seg.a[1]+dz*t;
    const w=(right-left)*length,h=seg.height/rows;
    const kind=Math.floor(hash(x,row,z+col)*detailGeometry.length);
    for(const side of [-1,1]){
     dummy.position.set(x+side*nx*(seg.width*.5+.025),
                        seg.heightAt(x,z)+.035+(row+.5)*h,
                        z+side*nz*(seg.width*.5+.025));
     dummy.rotation.set((hash(z,row,x)-.5)*.08,
                        yaw+(side<0?Math.PI:0),
                        (hash(row,x,z)-.5)*.085);
     dummy.scale.set(w*1.045,h*1.05,.27);
     dummy.updateMatrix();
     farBins[layer][kind].push(dummy.matrix.clone());total++;
    }
   }
  }
  // Loading historic decoration cannot monopolize Android's UI thread.
  if(i%85===84){
   await new Promise(resolve=>setTimeout(resolve,0));
   if(root.userData.disposed){detailGeometry.forEach(g=>g.dispose());return null;}
  }
 }
 for(let layer=0;layer<groups.length;layer++)
  for(let k=0;k<detailGeometry.length;k++){
   const matrices=farBins[layer][k];if(!matrices.length)continue;
   const mesh=new THREE.InstancedMesh(detailGeometry[k],material,matrices.length);
   mesh.name='Solid low-detail masonry '+k;
   // All instances span distinct wall traces; disable culling on their shared
   // bounds so rotating the village overview never hides an entire layer.
   mesh.frustumCulled=false;
   matrices.forEach((matrix,i)=>{
    mesh.setMatrixAt(i,matrix);
    shade.setScalar(.90+.10*hash(k,i,layer));
    mesh.setColorAt(i,shade);
   });
   mesh.instanceMatrix.needsUpdate=true;
   if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   groups[layer].group.add(mesh);
  }
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
 const budget=mobile?3200:7200;
 for(let index=0;index<jobs.length;index++){
  const job=jobs[index],{seg,layer,distance}=job;
  if(distance>(mobile?45:70))continue;
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
    const h=seg.height/rows*(1.02+.04*hash(z,row,x));
    const k=Math.floor(hash(x+index,row*17+col*7,z)*models.length);
    const model=models[k];
    for(const side of [-1,1]){
     dummy.position.set(x+side*nx*(seg.width*.5+.082),
                        seg.heightAt(x,z)+.055+(row+.5)*seg.height/rows,
                        z+side*nz*(seg.width*.5+.082));
     dummy.rotation.set((hash(x,z,row)-.5)*.12,
                        yaw+(side<0?Math.PI:0),
                        (hash(z,x,col)-.5)*.12);
     dummy.scale.set(w/model.size.x,h/model.size.y,
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
