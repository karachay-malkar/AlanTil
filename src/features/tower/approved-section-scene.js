/** Runtime assembly of the exact approved user-authored Common100 JSON recipes. */
import * as THREE from '../../vendor/three/three.module.js';
import {loadCommon100} from '../masonry/library.js?v=17.7-approved-masonry.1';
import {loadManualSection} from '../masonry/manual-sections/registry.mjs?v=approved-manual.1';
import {approvedSectionId,APPROVED_PREFAB_VERSION} from '../../../packages/tower-game/approved-prefab.mjs';
import {PREFAB_CELL_METERS} from '../../../packages/tower-game/prefab-layout.mjs';
import {getApprovedStoneSurfaceGeometry} from './rock-surface.js?v=balkaria-stone-v2.1-light-ochre.2';
import {loadBakedMasonry} from './baked-masonry.js?v=3';
import {mergeApprovedStoneMeshes} from './approved-section-geometry.js?v=17.2.69';

/**
 * Each stone is a real authored GLB mesh, centered using the exact same
 * loadCommon100 geometry routine as the editor. Its source transform is
 * never replaced by a cube, rounded, or grid-snapped.
 */
export function createApprovedSectionLoader({loadBaked=loadBakedMasonry}={}){
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
  const root=new THREE.Group();root.name='Approved '+id;
  // Editor and baked meshes are bottom-anchored; game blocks are centered.
  root.position.y=-Number(sectionId.split('x')[1])*PREFAB_CELL_METERS/2;
  let geometry=await loadBaked(id).catch(error=>{
   console.warn('Baked masonry unavailable; assembling the approved recipe:',error);
   return null;
  });
  if(geometry)Object.assign(root.userData,geometry.userData);
  else{
   const [{geometries},{recipe}]=await Promise.all([library(),source(id)]);
   if(recipe.cells.join('x')!==sectionId)throw new Error('Approved prefab footprint mismatch: '+id);
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
   // Keep the original recipe intact and cull only provably buried triangles.
   const result=mergeApprovedStoneMeshes(root);
   root.clear();
   geometry=result.geometry;
   root.userData.optimization=result.stats;
   root.userData.sourceStoneCount=recipe.stones.length;
  }
  const optimized=new THREE.Mesh(geometry,material);
  optimized.name='Approved consolidated '+id;
  root.add(optimized);
  root.userData.approvedSectionId=id;
  root.userData.geometryVersion=APPROVED_PREFAB_VERSION;
  return root;
 }
 return {make};
}
