import {APPROVED_MASONRY_VARIANTS} from '../../../packages/tower-game/approved-prefab.mjs';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';

export const BAKED_MASONRY_PILOT='manual-3x3x3-v2';
const approvedIds=new Set(Object.values(APPROVED_MASONRY_VARIANTS).flat());
const geometries=new Map();

export async function loadBakedMasonry(id){
 if(!approvedIds.has(id))return null;
 const url='/assets/tower/approved-library/baked/'+id.replace('manual-','section-')+'.glb?v=2';
 if(!geometries.has(id))geometries.set(id,new GLTFLoader().loadAsync(url).then(({scene})=>{
  const [mesh]=scene.children;
  if(scene.children.length!==1||!mesh?.isMesh||!mesh.geometry.getAttribute('uv'))
   throw Error('Invalid baked masonry GLB: '+id);
  const {sourceStoneCount,optimization}=mesh.userData;
  if(!Number.isInteger(sourceStoneCount)||optimization?.sourceMeshes!==sourceStoneCount)
   throw Error('Missing baked masonry source statistics: '+id);
  mesh.material.dispose();
  mesh.geometry.userData={sourceStoneCount,optimization};
  mesh.geometry.computeBoundingBox();
  return mesh.geometry;
 }).catch(error=>{geometries.delete(id);throw error;}));
 return geometries.get(id);
}
