/** Shared BalkariaStone v2.1 PBR material for every authored natural-rock mesh.
 * UASTC KTX2 is preferred; identical UV PNG maps are kept as a reliable fallback.
 * Stone geometry and the prefab V3 persisted format are never mutated.
 */
import * as THREE from '../../vendor/three/three.module.js';
import {KTX2Loader} from '../../vendor/three/addons/loaders/KTX2Loader.js';

export const ROCK_SURFACE_VERSION='balkaria-stone-v2.1-ktx2.2';
const root='/assets/tower/materials/balkaria-stone-v2.1/';
const cache=new WeakMap();
const names=['BaseColor','Normal_OpenGL','ORM'];
let materialPromise=null;
const url=(name,extension)=>root+'BalkariaStone_'+name+'_2K.'+extension+'?v='+ROCK_SURFACE_VERSION;

async function loadRockMaps(renderer){
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
