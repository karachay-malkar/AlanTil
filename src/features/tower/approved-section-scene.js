import * as THREE from '../../vendor/three/three.module.js';
import {approvedSectionId,APPROVED_PREFAB_VERSION} from '../../../packages/tower-game/approved-prefab.mjs';
import {PREFAB_CELL_METERS} from '../../../packages/tower-game/prefab-layout.mjs';
import {loadBakedMasonry} from './baked-masonry.js?v=4';

export function createApprovedSectionLoader(){
 async function make(sectionId,variant,material){
  const id=approvedSectionId(sectionId,variant);
  const geometry=await loadBakedMasonry(id,{cast:sectionId!=='1x1x1'});
  if(!geometry)throw new Error('Missing approved masonry model: '+id);
  const root=new THREE.Group();
  root.name='Approved '+id;
  // Baked models are bottom-anchored, while saved game blocks are centered.
  root.position.y=-Number(sectionId.split('x')[1])*PREFAB_CELL_METERS/2;
  Object.assign(root.userData,geometry.userData,{
   approvedSectionId:id,geometryVersion:APPROVED_PREFAB_VERSION
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='Approved consolidated '+id;
  root.add(mesh);
  return root;
 }
 return {make};
}
