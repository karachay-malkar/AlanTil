/** AlanTil manual masonry editor: exactly the 100 authored meshes, no generated substitutes. */
import * as THREE from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';

export const LIBRARY_URL='/assets/tower/approved-library/common100/common-100.glb';
export const MANIFEST_URL='/assets/tower/approved-library/common100/common-100.json';
export const CELL_METERS=.25;
export const RECIPE_VERSION='common100-mixed-2';
export const LEGACY_RECIPE_VERSION='common100-manual-1';
export const ARCHITECTURE_IDS=Object.freeze(['gate','gate-v9','door','window']);
export const CATEGORIES=Object.freeze([
 {key:'large',label:'Крупные',count:10},
 {key:'main',label:'Основные',count:72},
 {key:'chinking',label:'Забутовка',count:12},
 {key:'lintel',label:'Перемычки',count:6},
]);
const finite=(v)=>typeof v==='number'&&Number.isFinite(v);
const validVec=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(finite);
export const defaultCells=()=>[3,3,3];
export function makeRecipe(cells=defaultCells()){
 return {version:RECIPE_VERSION,libraryVersion:'17.7-common100.10',librarySha256:'',cellMeters:CELL_METERS,cells:[...cells],stones:[],architectures:[]};
}
export function validateRecipe(recipe,manifest){
 if(!recipe||![RECIPE_VERSION,LEGACY_RECIPE_VERSION].includes(recipe.version)||recipe.cellMeters!==CELL_METERS)throw new Error('Несовместимый формат рецепта');
 if(!validVec(recipe.cells,3)||recipe.cells.some(v=>!Number.isInteger(v)||v<1||v>32))throw new Error('Неверные габариты секции');
 if(recipe.libraryVersion!==manifest.version||recipe.librarySha256!==manifest.glbSHA256)throw new Error('Версия библиотеки Common 100 не совпадает');
 if(!Array.isArray(recipe.stones)||recipe.stones.length>1500)throw new Error('Недопустимое количество камней');
 const allowed=new Set(manifest.models.map(m=>m.name));
 const ids=new Set();
 const validTransform=(item)=>validVec(item.position,3)&&item.position.every(v=>Math.abs(v)<=200)&&
  validVec(item.quaternion,4)&&item.quaternion.reduce((s,v)=>s+v*v,0)>.001&&
  validVec(item.scale,3)&&item.scale.every(v=>v>.01&&v<=20);
 for(const stone of recipe.stones){
  if(!stone||!allowed.has(stone.name)||typeof stone.id!=='string'||!stone.id||ids.has(stone.id))throw new Error('Неизвестная модель либо повтор ID');
  ids.add(stone.id);
  if(!validVec(stone.position,3)||stone.position.some(x=>Math.abs(x)>200))throw new Error('Неверные координаты камня');
  if(!validVec(stone.quaternion,4)||stone.quaternion.reduce((s,x)=>s+x*x,0)<.001)throw new Error('Неверный поворот камня');
  if(!validVec(stone.scale,3)||stone.scale.some(x=>x<=.01||x>20))throw new Error('Неверный масштаб камня');
 }
 if(recipe.version===LEGACY_RECIPE_VERSION){
  if(recipe.architectures?.length)throw new Error('Старый формат не поддерживает архитектурные детали');
  return recipe;
 }
 if(!Array.isArray(recipe.architectures)||recipe.architectures.length>40)throw new Error('Недопустимое количество архитектурных элементов');
 for(const item of recipe.architectures){
  if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id)||!ARCHITECTURE_IDS.includes(item.asset))throw new Error('Неизвестный архитектурный элемент или повтор ID');
  ids.add(item.id);
  if(!validTransform(item))throw new Error('Неверная трансформация архитектурного элемента');
  if(item.component!==undefined&&item.component!==null&&(!Number.isInteger(item.component)||item.component<0||item.component>2000))throw new Error('Неверная деталь GLB');
  if(item.hiddenParts!==undefined){
   if(!Array.isArray(item.hiddenParts)||item.hiddenParts.length>2000||item.hiddenParts.some(v=>!Number.isInteger(v)||v<0||v>2000)||new Set(item.hiddenParts).size!==item.hiddenParts.length)throw new Error('Некорректный список скрытых деталей');
  }
  if(item.parts!==undefined){
   if(!item.parts||typeof item.parts!=='object'||Array.isArray(item.parts)||Object.keys(item.parts).length>2000)throw new Error('Неверный набор изменений деталей');
   for(const [key,part] of Object.entries(item.parts)){
    if(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>2000||!validTransform(part))throw new Error('Некорректная трансформация детали '+key);
   }
  }
 }
 return recipe;
}
let common100Promise=null;

async function readCommon100(){
 const [response,model]=await Promise.all([
  fetch(MANIFEST_URL,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Не удалось загрузить описание библиотеки');return r.json();}),
  new GLTFLoader().loadAsync(LIBRARY_URL+'?v=17.7-common100.10'),
 ]);
 if(response.count!==100||!Array.isArray(response.models)||response.models.length!==100)throw new Error('Библиотека должна содержать ровно 100 моделей');
 const names=new Set(response.models.map(m=>m.name));
 const geometries=new Map();
 model.scene.updateMatrixWorld(true);
 model.scene.traverse(obj=>{
  if(!obj.isMesh)return;
  const name=names.has(obj.name)?obj.name:(names.has(obj.parent?.name)?obj.parent.name:null);
  if(!name||geometries.has(name))return;
  const geometry=obj.geometry.clone();
  geometry.applyMatrix4(obj.matrixWorld);
  geometry.computeBoundingBox();
  const center=geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-center.x,-center.y,-center.z);
  if(!geometry.attributes.normal)geometry.computeVertexNormals();
  geometries.set(name,geometry);
 });
 const missing=response.models.filter(m=>!geometries.has(m.name)).map(m=>m.name);
 if(missing.length)throw new Error('Нет оригинальных мешей GLB: '+missing.join(', '));
 return {manifest:response,geometries};
}

export function loadCommon100({signal}={}){
 if(signal?.aborted)return Promise.reject(signal.reason||new DOMException('Aborted','AbortError'));
 if(!common100Promise)common100Promise=readCommon100().catch(error=>{common100Promise=null;throw error;});
 if(!signal)return common100Promise;
 return new Promise((resolve,reject)=>{
  const finish=(value,error)=>{
   signal.removeEventListener('abort',onAbort);
   if(signal.aborted)reject(signal.reason||new DOMException('Aborted','AbortError'));
   else if(error)reject(error);
   else resolve(value);
  };
  const onAbort=()=>finish(null,signal.reason||new DOMException('Aborted','AbortError'));
  signal.addEventListener('abort',onAbort,{once:true});
  common100Promise.then(value=>finish(value,null),error=>finish(null,error));
 });
}

export function stoneColor(model){
 const categories={large:'#b4a48d',main:'#b6a58c',chinking:'#c0b397',lintel:'#a89b88'};
 const hash=[...model.name].reduce((h,c)=>(Math.imul(h^c.charCodeAt(0),16777619)>>>0),2166136261);
 const c=new THREE.Color(categories[model.category]||'#b0a18e');
 c.offsetHSL(((hash%17)-8)/1000,0,((hash%11)-5)/100);
 return c;
}
export function serializeTransform(object){
 return {position:object.position.toArray().map(x=>+x.toFixed(6)),
  quaternion:object.quaternion.toArray().map(x=>+x.toFixed(8)),
  scale:object.scale.toArray().map(x=>+x.toFixed(6))};
}
