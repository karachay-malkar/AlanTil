/** Shared BalkariaStone v2.1 PBR material for every authored natural-rock mesh.
 * UASTC KTX2 is preferred; identical UV PNG maps are kept as a reliable fallback.
 * Stone geometry and the prefab V3 persisted format are never mutated.
 */
import * as THREE from '../../vendor/three/three.module.js';
import {KTX2Loader} from '../../vendor/three/addons/loaders/KTX2Loader.js';

export const ROCK_SURFACE_VERSION='balkaria-stone-v2.1-light-ochre.1';
const root='/assets/tower/materials/balkaria-stone-v2.1/';
const cache=new WeakMap();
const names=['BaseColor','Normal_OpenGL','ORM'];
let materialPromise=null;
const url=(name,extension)=>root+'BalkariaStone_'+name+'_2K.'+extension+'?v='+ROCK_SURFACE_VERSION;

async function loadRockMaps(renderer){
 // A/B diagnostic for devices that return valid KTX2 textures but render black.
 // ?towerTexture=png uses the identical UV maps; it never changes saved towers.
 if(typeof location!=='undefined' && new URLSearchParams(location.search).get('towerTexture')==='png'){
  const loader=new THREE.TextureLoader();
  return {maps:await Promise.all(names.map(name=>loader.loadAsync(url(name,'png')))),encoding:'PNG'};
 }
 let compressed=null;
 try{
  if(!renderer)throw new TypeError('WebGL renderer required to initialize KTX2');
  compressed=new KTX2Loader()
   .setTranscoderPath('/src/vendor/three/addons/libs/basis/')
   .setWorkerLimit(2)
   .detectSupport(renderer);
  const result=await Promise.all(names.map(name=>compressed.loadAsync(url(name,'ktx2'))));
  return {maps:result,encoding:'KTX2'};
 }catch(error){
  // Unsupported browsers, missing/invalid GPU format or unavailable WebAssembly
  // must never block the tower scene. The PNGs use exactly the same UV coordinates.
  console.warn('BalkariaStone KTX2 unavailable; falling back to PNG:',error);
  const loader=new THREE.TextureLoader();
  return {maps:await Promise.all(names.map(name=>loader.loadAsync(url(name,'png')))),encoding:'PNG'};
 }finally{
  compressed?.dispose();
 }
}

export function getRockSurface(renderer){
 if(!materialPromise){
  materialPromise=loadRockMaps(renderer).then(({maps:[map,normalMap,orm],encoding})=>{
   map.colorSpace=THREE.SRGBColorSpace;
   normalMap.colorSpace=THREE.NoColorSpace;
   orm.colorSpace=THREE.NoColorSpace;
   for(const tex of [map,normalMap,orm]){
    tex.wrapS=THREE.RepeatWrapping;
    tex.wrapT=THREE.RepeatWrapping;
    tex.anisotropy=4;
    tex.needsUpdate=true;
   }
   return new THREE.MeshStandardMaterial({
    name:'AlanTil BalkariaStone v2.1 '+encoding,
    map,normalMap,
    // The ORM R channel is ambient occlusion; its values must not
    // blacken entire stones on mobile GPUs with compressed textures.
    // Keep the authored albedo/normal/roughness, but disable AO until
    // the packed R channel can be validated across Android GPUs.
    roughnessMap:orm,roughness:1,
    metalness:0,
    normalScale:new THREE.Vector2(.38,.38),
    side:THREE.DoubleSide
   });
  }).catch(error=>{materialPromise=null;throw error;});
 }
 return materialPromise;
}

const approvedUvCache=new WeakMap();
/**
 * Physical, per-triangle planar projection for authored Common 100 stones.
 * GLB triangles often share vertices across differently sloped faces, so
 * the original single UV at a shared vertex smears the PBR texture sideways.
 * Keep all positions, normals, indices and transforms of the ORIGINAL GLB
 * untouched; only this disposable render geometry receives new texture UVs.
 *
 * Per-stone non-uniform scales must be included in UV coordinates so a 2x
 * stretched stone has the same rock grain size in world metres, not 2x blur.
 */
export function getApprovedStoneSurfaceGeometry(source,stoneScale=[1,1,1]){
 const key=stoneScale.map(n=>Number(n).toFixed(6)).join(',');
 let variants=approvedUvCache.get(source);
 if(!variants){variants=new Map();approvedUvCache.set(source,variants);}
 if(variants.has(key))return variants.get(key);
 const geometry=source.getIndex()?source.toNonIndexed():source.clone();
 const p=geometry.getAttribute('position');
 if(!p||p.count%3!==0)throw new TypeError('Common 100 source must contain triangles');
 const uv=new Float32Array(p.count*2);
 const scale=3.15; // one texture repeat per ~32 cm, matching architecture rocks
 const [sx,sy,sz]=stoneScale;
 for(let i=0;i<p.count;i+=3){
  const ax=p.getX(i)*sx,ay=p.getY(i)*sy,az=p.getZ(i)*sz;
  const bx=p.getX(i+1)*sx,by=p.getY(i+1)*sy,bz=p.getZ(i+1)*sz;
  const cx=p.getX(i+2)*sx,cy=p.getY(i+2)*sy,cz=p.getZ(i+2)*sz;
  const ux=bx-ax,uy=by-ay,uz=bz-az;
  const vx=cx-ax,vy=cy-ay,vz=cz-az;
  const nx=Math.abs(uy*vz-uz*vy);
  const ny=Math.abs(uz*vx-ux*vz);
  const nz=Math.abs(ux*vy-uy*vx);
  const axis=nx>=ny&&nx>=nz?0:ny>=nz?1:2;
  for(let j=i;j<i+3;j++){
   const x=p.getX(j)*sx,y=p.getY(j)*sy,z=p.getZ(j)*sz;
   uv[j*2]=(axis===0?z:x)*scale;
   uv[j*2+1]=(axis===1?z:y)*scale;
  }
 }
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 geometry.setAttribute('uv2',new THREE.BufferAttribute(uv.slice(),2));
 // Original GLB tangents, if present, refer to the old UV layout.
 geometry.deleteAttribute('tangent');
 variants.set(key,geometry);
 return geometry;
}

export function applyRockSurface(group,material){
 group.traverse(node=>{
  if(!node.isMesh||node.userData.alantilNonStone)return;
  const base=node.geometry;
  let geometry=cache.get(base);
  if(!geometry){
   geometry=base.clone();
   const p=geometry.getAttribute('position');
   let n=geometry.getAttribute('normal');
   if(!n){geometry.computeVertexNormals();n=geometry.getAttribute('normal');}
   const uv=new Float32Array(p.count*2);
   const scale=3.15; // 1 repeat per approximately 32 cm of real irregular rock
   for(let i=0;i<p.count;i++){
    const a=Math.abs(n.getX(i)),b=Math.abs(n.getY(i)),c=Math.abs(n.getZ(i));
    let u,v;
    if(a>=b&&a>=c){u=p.getZ(i);v=p.getY(i);}
    else if(b>=a&&b>=c){u=p.getX(i);v=p.getZ(i);}
    else{u=p.getX(i);v=p.getY(i);}
    uv[i*2]=u*scale;uv[i*2+1]=v*scale;
   }
   geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
   // Three.js MeshStandardMaterial AO reads uv2; ORM channel R carries AO.
   geometry.setAttribute('uv2',new THREE.BufferAttribute(uv.slice(),2));
   cache.set(base,geometry);
  }
  node.geometry=geometry;
  node.material=material;
 });
 return group;
}
