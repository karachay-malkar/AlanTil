/** Runtime assembly of the exact approved user-authored Common100 JSON recipes. */
import * as THREE from '../../vendor/three/three.module.js';
import {loadCommon100} from '../masonry/library.js?v=17.7-approved-masonry.1';
import {loadManualSection} from '../masonry/manual-sections/registry.mjs?v=approved-manual.1';
import {approvedSectionId,APPROVED_PREFAB_VERSION} from '../../../packages/tower-game/approved-prefab.mjs';
import {PREFAB_CELL_METERS} from '../../../packages/tower-game/prefab-layout.mjs';
import {getApprovedStoneSurfaceGeometry} from './rock-surface.js?v=balkaria-stone-v2.1-light-ochre.2';

/**
 * Each stone is a real authored GLB mesh, centered using the exact same
 * loadCommon100 geometry routine as the editor. Its source transform is
 * never replaced by a cube, rounded, or grid-snapped.
 */
export function createApprovedSectionLoader(){
 let libraryPromise=null;
 const recipes=new Map();
 const library=()=>{
  if(!libraryPromise)libraryPromise=loadCommon100().catch(e=>{libraryPromise=null;throw e;});
  return libraryPromise;
 };
 const source=async id=>{
  if(!recipes.has(id))recipes.set(id,library().then(({manifest})=>loadManualSection(id,manifest))
    .catch(e=>{recipes.delete(id);throw e;}));
  return recipes.get(id);
 };
 async function make(sectionId,variant,material){
  const id=approvedSectionId(sectionId,variant);
  const [{geometries},document]=await Promise.all([library(),source(id)]);
  const {recipe}=document;
  const parts=recipe.cells.join('x');
  if(parts!==sectionId)throw new Error('Approved prefab footprint mismatch: '+id);
  const root=new THREE.Group();root.name='Approved '+id;
  // Editor recipes are bottom-anchored and centered in X/Z; tower
  // blocks are centered around their logical 25 cm grid volume.
  root.position.y=-recipe.cells[1]*PREFAB_CELL_METERS/2;
  for(const entry of recipe.stones){
   const original=geometries.get(entry.name);
   if(!original)throw new Error('Missing authored mesh '+entry.name);
   const mesh=new THREE.Mesh(getApprovedStoneSurfaceGeometry(original,entry.scale),material);
   mesh.name=entry.name;
   mesh.position.fromArray(entry.position);
   mesh.quaternion.fromArray(entry.quaternion);
   mesh.scale.fromArray(entry.scale);
   mesh.userData.approvedSourceId=entry.id;
   root.add(mesh);
  }
  root.userData.approvedSectionId=id;
  root.userData.geometryVersion=APPROVED_PREFAB_VERSION;
  root.userData.sourceStoneCount=recipe.stones.length;
  return root;
 }
 return {make};
}
