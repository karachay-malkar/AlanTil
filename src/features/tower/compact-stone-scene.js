/** Assemble 17.5.5 section with shared authored geometry and instancing. */
import * as THREE from '../../vendor/three/three.module.js';
import {validateCompactStoneRecipe} from '../../../packages/tower-game/compact-stone-prefab.mjs';
const MAT=new THREE.Matrix4();
export function assembleCompactStoneSection(scene,pack,sectionId,variant,stoneMaterial){
 const recipe=validateCompactStoneRecipe(pack,sectionId,variant);
 const shapes=new Map();
 scene.traverse(node=>{if(node.isMesh&&node.geometry)shapes.set(node.name,node.geometry);});
 const batches=new Map();
 for(const placement of recipe.placement){
  const name=placement[0];
  if(!shapes.has(name))throw new TypeError('Missing compact masonry source shape: '+name);
  if(!batches.has(name))batches.set(name,[]);
  batches.get(name).push(placement);
 }
 const group=new THREE.Group();group.name=`masonry-71-${sectionId}-v${variant}`;
 for(const [name,placements] of batches){
  const mesh=new THREE.InstancedMesh(shapes.get(name),stoneMaterial,placements.length);
  mesh.name=name;mesh.userData.alantilCompactStone=true;
  for(let i=0;i<placements.length;i++){
   const m=placements[i];
   MAT.set(m[1],m[2],m[3],m[4],m[5],m[6],m[7],m[8],m[9],m[10],m[11],m[12],0,0,0,1);
   mesh.setMatrixAt(i,MAT);
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);
 }
 group.userData.compactPlacementCount=recipe.placement.length;
 return group;
}
