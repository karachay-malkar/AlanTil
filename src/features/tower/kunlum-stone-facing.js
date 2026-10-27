/** Real Common 100 stone facing shared by the live village and 3D editor.
 * Instanced LOD; each rough physical stone is embedded in a watertight backing.
 * No new pseudo-cubic substitute stones, no independent palette or textures.
 */
import * as THREE from '../../vendor/three/three.module.js';
import {loadCommon100} from '../masonry/library.js?v=17.7-approved-masonry.1';
import {getApprovedStoneSurfaceGeometry,applyRockSurface,getRockSurface} from './rock-surface.js?v=balkaria-stone-v2.1-light-ochre.2';
import {layoutKunlumRuinStones} from './kunlum-ruin-layout.js?v=17.2.35';

const hash=(x,y,z)=>{const v=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453123;return v-Math.floor(v)};
const LANDMARK=[7.5,15];
const usable=(geom)=>{
 const box=geom.boundingBox||(geom.computeBoundingBox(),geom.boundingBox);
 const size=box.getSize(new THREE.Vector3());
 return size.x>.01&&size.y>.01&&size.z>.01?size:null;
};
// Geometric low-detail stones for distant walls. These are real faceted 3D
// objects, not stretched Common100 blocks, decals or repeated image panels.
function makeDistanceStone(seed,angles=10){
 const random=i=>hash(seed*9.81,i*13.7,seed+i*3.3);
 const outline=[];
 const initial=(random(1)-.5)*.31;
 for(let i=0;i<angles;i++){
  const a=2*Math.PI*i/angles+initial;
  // Angular, broken shoulders with deep irregularities rather than 6-sided
  // beveled rectangular bricks. The same stone placement drives Common100.
  const r=.63+.55*random(2+i);
  const along=(Math.cos(a)*.50*r)+(.11*(random(15+i)-.5));
  const up=(Math.sin(a)*.49*r)+(.10*(random(34+i)-.5));
  outline.push([along,up]);
 }
 const outer=outline.map(([x,y],i)=>[x,y,.18+.055*(random(i+51)-.5)]);
 const face=outline.map(([x,y],i)=>[
   x*(.73+.20*random(i+70)),y*(.73+.18*random(i+83)),
   .32+.07*(random(i+95)-.5)
 ]);
 const back=outline.map(([x,y],i)=>[x*1.06,y*1.06,-.26-.07*random(i+120)]);
 const centre=[(random(170)-.5)*.16,(random(180)-.5)*.13,.39],verts=[];
 const tri=(v1,v2,v3)=>verts.push(...v1,...v2,...v3);
 for(let i=0;i<angles;i++){
  const j=(i+1)%angles;
  tri(outer[i],outer[j],face[j]);
  tri(outer[i],face[j],face[i]);
  tri(centre,face[i],face[j]);
 }
 for(let i=1;i<angles-1;i++)tri(back[0],back[i+1],back[i]);
 for(let i=0;i<angles;i++){
  const j=(i+1)%angles;
  tri(outer[i],back[i],back[j]);tri(outer[i],back[j],outer[j]);
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
 // All wall cores remain sealed, but their previously bright, perfectly
 // planar PBR face used to show through as rectangular-looking patches.
 // Recess the visual core into shadow; irregular 3D stones own the silhouette.
 const backing=material.clone();
 backing.color.multiplyScalar(.49);
 backing.roughness=1;
 backing.polygonOffset=true;
 backing.polygonOffsetFactor=1;
 backing.polygonOffsetUnits=1;
 for(const container of groups){
  applyRockSurface(container.group,material);
  container.group.children.filter(node=>node.isMesh).forEach(node=>{
   node.material=backing;
  });
 }
 root.userData.wallBackingMaterial=backing;
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
 const detailGeometry=Array.from({length:mobile?12:16},(_,i)=>makeDistanceStone(i+1,mobile?8:10));
 const farBins=new Map();
 const chunkWidth=85; // metres: bound visibility to small terrain regions
 let total=0;
 for(let i=0;i<jobs.length;i++){
  const {seg,layer}=jobs[i];
  if(nearJobs.has(i))continue;
  const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],length=Math.hypot(dx,dz);
  const nx=-dz/length,nz=dx/length,yaw=Math.atan2(nx,nz);
  for(const rock of layoutKunlumRuinStones(seg)){
   const {x,z}=rock;
   const kind=rock.kind%detailGeometry.length;
   for(const side of [-1,1]){
    dummy.position.set(x+side*nx*(seg.width*.5+.025),rock.y,
                       z+side*nz*(seg.width*.5+.025));
    dummy.rotation.set(rock.tilt,yaw+(side<0?Math.PI:0),rock.lean);
    dummy.scale.set(rock.width,rock.height,rock.depth);
    dummy.updateMatrix();
    const key=layer+':'+kind+':'+Math.floor(x/chunkWidth)+':'+Math.floor(z/chunkWidth);
    let bucket=farBins.get(key);
    if(!bucket){bucket={layer,kind,matrices:[]};farBins.set(key,bucket);}
    bucket.matrices.push(dummy.matrix.clone());total++;
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
  const nx=-dz/length,nz=dx/length,yaw=Math.atan2(nx,nz);
  for(const rock of layoutKunlumRuinStones(seg)){
   const {x,z}=rock;
   const k=rock.kind%models.length,model=models[k];
   for(const side of [-1,1]){
    dummy.position.set(x+side*nx*(seg.width*.5+.082),rock.y,
                       z+side*nz*(seg.width*.5+.082));
    dummy.rotation.set(rock.tilt,yaw+(side<0?Math.PI:0),rock.lean);
    dummy.scale.set(rock.width/model.size.x,rock.height/model.size.y,
                    rock.depth/model.size.z);
    dummy.updateMatrix();
    bins[layer][k].push(dummy.matrix.clone());actual++;
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
 root.userData.ruinPlacementMode='shared-irregular-v2';
 root.userData.common100NearOnlyWallSegments=nearJobs.size;
 root.userData.ruinFarSegments=jobs.length-nearJobs.size;
 root.userData.ruinFacingEngine='Kunlum shared placement; 16 faceted organic shapes; 52 Common100 near';
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
