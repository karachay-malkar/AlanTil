/** Real Common 100 stone facing shared by the live village and 3D editor.
 * Dynamic camera-based LOD: close Common100, intermediate faceted stones,
 * and distant merged external stone faces. No opaque internal wall backing.
 */
import * as THREE from '../../vendor/three/three.module.js';
import {loadCommon100} from '../masonry/library.js?v=17.7-approved-masonry.1';
import {getApprovedStoneSurfaceGeometry,applyRockSurface,getRockSurface} from './rock-surface.js?v=balkaria-stone-v2.1-light-ochre.2';
import {layoutKunlumRuinStones} from './kunlum-ruin-layout.js?v=17.2.66';
import {makeKunlumRuinShell} from './kunlum-ruin-shell.js?v=17.2.66';
import {groupRuinSegments,ruinChunkDistance,selectKunlumRuinTier} from './kunlum-ruin-lod.mjs?v=17.2.66';

const hash=(x,y,z)=>{const v=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453123;return v-Math.floor(v)};
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
/** Three camera-selected physical LODs; never use a fixed landmark to
 * classify masonry quality. Chunks are both frustum- and distance-bounded. */
export async function enhanceKunlumStoneWalls(THREE,root,groups,{
 renderer,materialPromise,mobile=false,monument=null
}={}){
 const material=await (materialPromise||getRockSurface(renderer));
 if(root.userData.disposed)return null;
 if(monument)applyRockSurface(monument,material);
 const chunks=groupRuinSegments(groups.flatMap((entry,layer)=>
  entry.segments.map(seg=>({seg,layer}))));
 const sharedGeometries=[];
 const distantGeometries=Array.from({length:mobile?10:12},
  (_,i)=>makeDistanceStone(i+1,mobile?8:10));
 sharedGeometries.push(...distantGeometries);
 const makeBucket=(c)=>{
  const group=new THREE.Group();
  group.name='Kunlum ruin chunk '+c.key;
  const far=new THREE.Group();far.name='Merged exterior stone LOD';
  const geometry=makeKunlumRuinShell(THREE,c.segments);
  if(geometry){
   const mesh=new THREE.Mesh(geometry,material);
   mesh.name='Externally visible ruin stone facets';
   mesh.frustumCulled=true;
   far.add(mesh);sharedGeometries.push(geometry);
  }
  group.add(far);groups[c.layer].group.add(group);
  return {...c,group,far,medium:null,near:null,tier:'far'};
 };
 const buckets=[];
 for(let i=0;i<chunks.length;i++){
  buckets.push(makeBucket(chunks[i]));
  if(i%12===11){
   await new Promise(resolve=>setTimeout(resolve,0));
   if(root.userData.disposed)return null;
  }
 }
 root.userData.wallFacadeGeometries=sharedGeometries;
 root.userData.wallFacadeChunks=buckets.length;
 root.userData.ruinPlacementMode='camera-chunk-lod-v4';
 root.userData.ruinedCrown='collapsed-profile-v2';
 // Common100 is shared with authored tower sections, but near meshes are
 // instantiated only for the chunks the player can actually approach.
 const {manifest,geometries}=await loadCommon100();
 if(root.userData.disposed)return null;
 const sources=manifest.models.filter(m=>m.category==='main'||m.category==='large');
 const count=mobile?32:52;
 const selected=Array.from({length:count},
  (_,i)=>sources[Math.floor((i+.5)*sources.length/count)]);
 const models=selected.map(({name})=>{
  const source=geometries.get(name),size=source&&usable(source);
  if(!size)throw Error('Common100 stone source missing: '+name);
  return {name,geometry:getApprovedStoneSurfaceGeometry(source),size};
 });
 const dummy=new THREE.Object3D(),shade=new THREE.Color();
 const installedMeshes=new Set();
 function createDetail(bucket,near){
  const geometryList=near?models.map(m=>m.geometry):distantGeometries;
  const bins=geometryList.map(()=>[]);
  const colorBins=geometryList.map(()=>[]);
  for(const seg of bucket.segments){
   const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],length=Math.hypot(dx,dz);
   if(length<.01)continue;
   const nx=-dz/length,nz=dx/length,yaw=Math.atan2(nx,nz);
   for(const rock of layoutKunlumRuinStones(seg)){
    // Medium LOD retains both visible faces without 3 hidden interior rows.
    // Near LOD preserves all original irregular Common100 stone geometry.
    for(const layerDepth of (near?[-1,0,1]:[-1,1])){
     const k=(rock.kind+(layerDepth+1)*7)%geometryList.length;
     const offset=layerDepth*seg.width*(near?.32:.29);
     dummy.position.set(rock.x+nx*offset,rock.y-(layerDepth===0?.012:0),
                        rock.z+nz*offset);
     dummy.rotation.set(rock.tilt,yaw+(layerDepth<0?Math.PI:0),rock.lean);
     if(near){
      const m=models[k];
      dummy.scale.set(rock.width/m.size.x,rock.height/m.size.y,
                      (seg.width*.63)/m.size.z);
     }else{
      dummy.scale.set(rock.width,rock.height,seg.width*.74);
     }
     dummy.updateMatrix();
     bins[k].push(dummy.matrix.clone());
     if(!near)colorBins[k].push(.90+.10*hash(k,bins[k].length,bucket.layer));
    }
   }
  }
  const group=new THREE.Group();
  group.name=near?'Near Common100 stones':'Medium faceted stones';
  for(let k=0;k<bins.length;k++){
   if(!bins[k].length)continue;
   const mesh=new THREE.InstancedMesh(geometryList[k],material,bins[k].length);
   mesh.name=(near?'Common100':'Medium')+' ruin stone '+k;
   bins[k].forEach((matrix,i)=>{
    mesh.setMatrixAt(i,matrix);
    if(!near){shade.setScalar(colorBins[k][i]);mesh.setColorAt(i,shade);}
   });
   mesh.instanceMatrix.needsUpdate=true;
   if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   mesh.computeBoundingSphere();mesh.frustumCulled=true;
   group.add(mesh);installedMeshes.add(mesh);
  }
  bucket.group.add(group);
  return group;
 }
 function disposeDetail(bucket,kind){
  const group=bucket[kind];if(!group)return;
  bucket.group.remove(group);
  group.traverse(node=>{
   if(node.isInstancedMesh){installedMeshes.delete(node);node.dispose();}
  });
  bucket[kind]=null;
 }
 let lastUpdate=-Infinity,created=0;
 function update(camera,force=false){
  if(root.userData.disposed||!camera)return false;
  const now=typeof performance!=='undefined'?performance.now():0;
  if(!force&&now-lastUpdate<180)return false;
  lastUpdate=now;
  const targets=buckets.map(bucket=>{
   const distance=ruinChunkDistance(camera.position,bucket.bounds);
   return {bucket,distance,tier:selectKunlumRuinTier(distance,bucket.tier,{mobile})};
  });
  // Lazy creation of heavy meshes: at most two new chunks in one update.
  let available=force?4:2,active=0;
  targets.sort((a,b)=>a.distance-b.distance);
  for(const {bucket,distance,tier} of targets){
   if(tier==='near'&&!bucket.near&&available>0){
    bucket.near=createDetail(bucket,true);available--;created++;
   }else if((tier==='medium'||tier==='near')&&!bucket.medium&&!bucket.near&&available>0){
    bucket.medium=createDetail(bucket,false);available--;created++;
   }else if(tier==='medium'&&!bucket.medium&&available>0){
    bucket.medium=createDetail(bucket,false);available--;created++;
   }
   // Distant groups release geometry buffers, not the shared source meshes.
   if(distance>140){disposeDetail(bucket,'near');disposeDetail(bucket,'medium');}
   else if(distance>40)disposeDetail(bucket,'near');
   bucket.tier=tier;
   const showNear=tier==='near'&&!!bucket.near;
   const showMedium=!showNear&&tier!=='far'&&!!bucket.medium;
   bucket.far.visible=!showNear&&!showMedium;
   if(bucket.near)bucket.near.visible=showNear;
   if(bucket.medium)bucket.medium.visible=showMedium;
   if(distance<110)active++;
  }
  root.userData.ruinLOD={chunks:buckets.length,near:buckets.filter(c=>c.near?.visible).length,
   medium:buckets.filter(c=>c.medium?.visible).length,
   far:buckets.filter(c=>c.far.visible).length,active,created};
  return true;
 }
 function dispose(){
  for(const bucket of buckets){
   disposeDetail(bucket,'near');disposeDetail(bucket,'medium');
  }
 }
 root.userData.ruinLodController={update,dispose};
 root.userData.common100NearOnlyWallSegments=0;
 root.userData.ruinFarSegments=chunks.reduce((sum,c)=>sum+c.segments.length,0);
 root.userData.ruinFacingEngine='camera-driven Common100 / instanced stones / merged external shell';
 root.userData.common100FacingDensity=1;
 root.userData.common100Material=material.name;
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
 root.userData.common100StoneCount=total+actual;
 root.userData.common100WallSegments=chunks.reduce((n,c)=>n+c.segments.length,0);
 return {stones:total+actual,models:models.map(x=>x.name),update,dispose};
}
