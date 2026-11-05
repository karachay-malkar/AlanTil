import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';

export const BAKED_MASONRY_PILOT='manual-3x3x3-v2';
const PILOT_URL='/assets/tower/approved-library/baked/section-3x3x3-v2.glb?v=2';
let pilotGeometry;

export async function loadBakedMasonry(id){
 if(id!==BAKED_MASONRY_PILOT)return null;
 if(!pilotGeometry)pilotGeometry=new GLTFLoader().loadAsync(PILOT_URL).then(({scene})=>{
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
 }).catch(error=>{pilotGeometry=null;throw error;});
 return pilotGeometry;
}
