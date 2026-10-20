/** Original architectural GLBs for the separate manual masonry editor. */
import * as THREE from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';
import {getRockSurface,applyRockSurface} from '../tower/rock-surface.js';
import {applyGateSurfaces} from '../tower/gate-surface.js';

export const ARCHITECTURE=Object.freeze([
 {id:'gate',title:'Ворота v7 · исходные',file:'/assets/tower/prefabs/architectural/gate-18x10x2-v7.glb',cells:[18,10,2]},
 {id:'gate-v9',title:'Ворота v9 · игровая модель',file:'/assets/tower/prefabs/architectural/gate-18x10x2-v9.glb',cells:[18,10,2]},
 {id:'door',title:'Дверь с кладкой',file:'/assets/tower/prefabs/architectural/door-7x9x2-stone-v1.glb',cells:[7,9,2]},
 {id:'window',title:'Окно с кладкой',file:'/assets/tower/prefabs/architectural/window-4x5x2-v2.glb',cells:[4,5,2]},
 {id:'timber',title:'Деревянные балки и столбы',file:'/assets/tower/modular_wooden_pier/timber-parts.glb',cells:[8,8,8]}
]);
export const ARCHITECTURE_IDS=new Set(ARCHITECTURE.map(a=>a.id));
const DOOR_WOOD='/assets/tower/prefabs/architectural/door-wood-v1.glb';
const WINDOW_WOOD='/assets/tower/prefabs/architectural/window-wood-v3.glb';
const VERSION='17.2-architectural-editor.3';
export const architectureById=id=>ARCHITECTURE.find(item=>item.id===id)||null;

/** Preserve original materials and mesh hierarchy; flatten only the addressing of editable parts. */
export function createArchitectureLoader(renderer){
 const loader=new GLTFLoader(),glbs=new Map(),assets=new Map(),ready=new Map();
 function glb(path){
  if(!glbs.has(path))glbs.set(path,loader.loadAsync(path+'?v='+VERSION).catch(e=>{glbs.delete(path);throw e;}));
  return glbs.get(path);
 }
 async function load(id){
  if(!architectureById(id))throw new TypeError('Неизвестный архитектурный элемент '+id);
  if(!assets.has(id))assets.set(id,(async()=>{
   const spec=architectureById(id);
   const root=new THREE.Group();root.name='Architecture '+id;
   if(id==='gate'||id==='gate-v9'){
    const [gate,door,rock]=await Promise.all([glb(spec.file),glb(DOOR_WOOD),getRockSurface(renderer)]);
    const scene=gate.scene.clone(true);
    applyGateSurfaces(scene,door.scene,rock);
    root.add(scene);
   }else if(id==='door'||id==='window'){
    const timber=id==='door'?DOOR_WOOD:WINDOW_WOOD;
    const [stone,wood,rock]=await Promise.all([glb(spec.file),glb(timber),getRockSurface(renderer)]);
    const stoneRoot=stone.scene.clone(true);
    applyRockSurface(stoneRoot,rock);
    const woodRoot=wood.scene.clone(true);
    if(id==='door'){
     // The original door models are seated 12.5 cm below their authored center.
     stoneRoot.position.y-=.125;woodRoot.position.y-=.125;
    }
    root.add(stoneRoot,woodRoot);
   }else{
    root.add((await glb(spec.file)).scene.clone(true));
   }
   root.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(root);
   if(bounds.isEmpty())throw new Error('Пустой архитектурный GLB '+id);
   const center=bounds.getCenter(new THREE.Vector3());
   // Editor objects use a ground-centered, stable local pivot.
   const anchored=new THREE.Group();
   root.position.x-=center.x;root.position.y-=bounds.min.y;root.position.z-=center.z;
   anchored.add(root);anchored.updateMatrixWorld(true);
   const parts=[];
   anchored.traverse(node=>{if(node.isMesh){
    node.userData.masonryPartIndex=parts.length;
    parts.push({index:parts.length,name:node.name||node.parent?.name||'Деталь'});
   }});
   const size=new THREE.Box3().setFromObject(anchored).getSize(new THREE.Vector3()).toArray();
   const asset={id,root:anchored,parts,size};ready.set(id,asset);return asset;
  })().catch(e=>{assets.delete(id);throw e}));
  return assets.get(id);
 }
 function cached(id){return ready.get(id)||null;}
 return {load,cached};
}
