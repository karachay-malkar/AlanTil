/** Offline-baked AlanTil stone casts: each geometry uses its own colour atlas. */
import * as THREE from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from '../../vendor/three/addons/loaders/KTX2Loader.js';

const cache=new Map();
const root='/assets/tower/approved-library/lod-baked/';
export function kunlumBakedAssetURL(id,level,ext){
 if(!Number.isInteger(level)||level<1||level>3)throw Error('Unknown Kunlum LOD '+level);
 if(id!=='abay-kala'&&!/^manual-(?:2x2x2-v3|3x3x3-v2)$/.test(id))throw Error('Unapproved Kunlum LOD '+id);
 if(!['glb','ktx2','png'].includes(ext))throw Error('Invalid Kunlum asset format');
 return root+'lod'+level+'/'+id.replace('manual-','section-')+'.'+ext;
}
async function geometryFor(id,level){
 const url=kunlumBakedAssetURL(id,level,'glb')+'?v=1';
 const {scene}=await new GLTFLoader().loadAsync(url);
 const mesh=scene.children[0];
 if(scene.children.length!==1||!mesh?.isMesh||!mesh.geometry.getAttribute('uv'))
  throw Error('Invalid Kunlum prebaked GLB: '+url);
 mesh.material?.dispose?.();
 const geometry=mesh.geometry;
 geometry.computeBoundingBox();
 return geometry;
}
async function atlasFor(id,level,renderer){
 const png=kunlumBakedAssetURL(id,level,'png')+'?v=1';
 const ktx=kunlumBakedAssetURL(id,level,'ktx2')+'?v=1';
 let texture;
 if(renderer){
  let loader;
  try{
   loader=new KTX2Loader().setTranscoderPath('/src/vendor/three/addons/libs/basis/')
     .setWorkerLimit(2).detectSupport(renderer);
   texture=await loader.loadAsync(ktx);
  }catch(error){
   console.warn('Kunlum prebaked KTX2 unavailable; using matching PNG atlas',error);
  }finally{loader?.dispose();}
 }
 if(!texture){
  texture=await new THREE.TextureLoader().loadAsync(png);
  texture.flipY=false; // GLTF UVs and KTX2 source both use top-left origin.
  texture.generateMipmaps=true;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
 }
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.ClampToEdgeWrapping;
 texture.wrapT=THREE.ClampToEdgeWrapping;
 texture.anisotropy=4;
 texture.needsUpdate=true;
 return new THREE.MeshStandardMaterial({
  name:'Kunlum offline stone atlas LOD '+level,
  map:texture,roughness:1,metalness:0,side:THREE.DoubleSide
 });
}
export async function loadKunlumPrebakedLOD(id,level,{renderer=null}={}){
 const key=id+':'+level;
 if(!cache.has(key))cache.set(key,Promise.all([
  geometryFor(id,level),atlasFor(id,level,renderer)
 ]).then(([geometry,material])=>({geometry,material}))
  .catch(error=>{cache.delete(key);throw error;}));
 return cache.get(key);
}
