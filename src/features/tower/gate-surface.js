/**
 * The gate GLB carries only named PBR markers. Reuse exactly the Wood Shutter
 * and Rust Coarse 01 materials embedded in the existing, approved door GLB.
 * Stone parts share the game's Rock Face 02 renderer.
 */
import {applyRockSurface} from './rock-surface.js';
const WOOD=/Wood Shutter|hand.worked timber|aged door planks|antique oak frame/i;
const IRON=/Rust Coarse|forged iron|oxidized fasteners|blackened hand/i;
const meshes=root=>{const out=[];root.traverse(x=>{if(x.isMesh)out.push(x);});return out;};
export function findApprovedGateMaterials(reference){
 let wood=null,iron=null;
 for(const item of meshes(reference)){
  for(const m of Array.isArray(item.material)?item.material:[item.material]){
   if(!m?.map)continue;
   if(!wood&&WOOD.test(m.name))wood=m;
   if(!iron&&IRON.test(m.name))iron=m;
  }
 }
 if(!wood||!iron){
  for(const item of meshes(reference)){
   for(const m of Array.isArray(item.material)?item.material:[item.material]){
    if(!m?.map)continue;
    if(!wood&&m.metalness<.2&&!m.transparent)wood=m;
    if(!iron&&m.metalness>.4&&m.roughness>.5)iron=m;
   }
  }
 }
 if(!wood||!iron)throw new Error('Approved Wood Shutter / Rust Coarse 01 PBR absent in door-wood-v1.glb');
 return {wood,iron};
}
export function applyGateSurfaces(gate,doorReference,stoneMaterial){
 const {wood,iron}=findApprovedGateMaterials(doorReference);
 for(const mesh of meshes(gate)){
  const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
  const marker=material?.name;
  if(marker==='ALANTIL_GATE_ROCK_FACE_02'){mesh.userData.alantilNonStone=false;continue;}
  mesh.userData.alantilNonStone=true;
  if(marker==='ALANTIL_GATE_WOOD_FROM_DOOR_PBR')mesh.material=wood;
  else if(marker==='ALANTIL_GATE_IRON_FROM_DOOR_PBR')mesh.material=iron;
  else throw new TypeError('Unexpected gate material '+marker);
 }
 return applyRockSurface(gate,stoneMaterial);
}
