/**
 * Independent registry of human-authored Common 100 sections.
 * Do not add these to the legacy prefab manifest or the tower placement RPC.
 * Only references source GLB meshes; never generates substitute stone geometry.
 */
export const MANUAL_SECTION_ROOT='/assets/tower/approved-library/sections';
export const MANUAL_SECTION_SCHEMA='alantil.manual-common100.catalog.1';
export const MANUAL_SECTION_CATALOG_URL='/assets/tower/approved-library/index.json?v=17.7-approved-masonry.1';

const validId=/^[a-z][a-z0-9-]*$/;
const validFile=/^section-[a-z0-9-]+\.json$/;
const isFiniteArray=(value,size)=>Array.isArray(value)&&value.length===size&&value.every(Number.isFinite);
const isCellSize=cells=>isFiniteArray(cells,3)&&cells.every(x=>Number.isInteger(x)&&x>=1&&x<=32);
const hex64=/^[0-9a-f]{64}$/;

function assert(condition,message){
 if(!condition)throw new Error('Ручная секция Common 100: '+message);
}
function matchesCells(a,b){return isCellSize(a)&&isCellSize(b)&&a.every((x,i)=>x===b[i]);}

/** Pure checks so future sections cannot silently change the source library. */
export function validateManualCatalog(catalog,manifest=null){
 assert(catalog?.schema===MANUAL_SECTION_SCHEMA,'неподдерживаемая версия каталога');
 assert(catalog.library?.cellMeters===0.25,'неверный шаг ячейки');
 assert(typeof catalog.library?.version==='string'&&hex64.test(catalog.library?.sha256||''),'нет отпечатка библиотеки');
 if(manifest){
  assert(catalog.library.version===manifest.version,'версия Common 100 отличается');
  assert(catalog.library.sha256===manifest.glbSHA256,'SHA-256 Common 100 отличается');
 }
 assert(Array.isArray(catalog.sections)&&catalog.sections.length>0&&catalog.sections.length<=100,'пустой либо неверный каталог');
 const ids=new Set(),files=new Set();
 for(const section of catalog.sections){
  assert(validId.test(section.id||'')&&!ids.has(section.id),'дублируется ID секции');
  assert(validFile.test(section.file||'')&&!files.has(section.file),'небезопасное имя файла секции');
  assert(typeof section.title==='string'&&section.title.length>0&&section.title.length<=120,'некорректное название секции');
  assert(isCellSize(section.cells),'некорректные размеры секции');
  assert(Number.isInteger(section.stoneCount)&&section.stoneCount>=1&&section.stoneCount<=1500,'некорректное число камней');
  assert(hex64.test(section.sha256||''),'нет контрольной суммы секции');
  assert(section.status==='source'&&section.origin==='manual-authoring','некорректный тип источника');
  assert(['large','main','chinking','lintel'].every(k=>Number.isInteger(section.counts?.[k])&&section.counts[k]>=0),'некорректный состав камней');
  assert(Object.values(section.counts).reduce((a,b)=>a+b,0)===section.stoneCount,'число камней в каталоге не совпадает');
  ids.add(section.id);files.add(section.file);
 }
 return catalog;
}

/**
 * Checks the unmodified user export against its authoritative Common 100 GLB manifest.
 * Does not clip coordinates to the logical section box or alter stone transforms.
 */
export function validateManualSection(document,entry,manifest){
 assert(document&&typeof document==='object','не удалось прочитать экспорт');
 const recipe=document.recipe;
 assert(document.title===entry.title,'название экспорта отличается от каталога');
 assert(['common100-manual-1','common100-mixed-2'].includes(recipe?.version),'неподдерживаемый формат расстановки');
 if(recipe.version==='common100-mixed-2')assert(Array.isArray(recipe.architectures)&&recipe.architectures.length===0,'ручные секции не должны включать архитектурные объекты');
 assert(recipe.libraryVersion===manifest.version&&recipe.librarySha256===manifest.glbSHA256,'расстановка ссылается на другую библиотеку');
 assert(recipe.cellMeters===0.25&&matchesCells(recipe.cells,entry.cells),'размеры расстановки отличаются');
 assert(Array.isArray(recipe.stones)&&recipe.stones.length===entry.stoneCount,'количество камней изменилось');
 assert(Array.isArray(manifest.models)&&manifest.models.length===100,'не загружена полная библиотека Common 100');
 const byName=new Map(manifest.models.map(m=>[m.name,m.category]));
 const ids=new Set();
 const counts={large:0,main:0,chinking:0,lintel:0};
 for(const stone of recipe.stones){
  assert(typeof stone?.id==='string'&&stone.id.length>0&&!ids.has(stone.id),'повтор ID камня');
  assert(byName.has(stone.name),'неизвестная 3D-модель '+stone.name);
  assert(isFiniteArray(stone.position,3)&&stone.position.every(n=>Math.abs(n)<=200),'некорректные координаты камня');
  assert(isFiniteArray(stone.quaternion,4),'некорректный поворот камня');
  const qLength=stone.quaternion.reduce((sum,n)=>sum+n*n,0);
  assert(qLength>0.998&&qLength<1.002,'ненормализованный кватернион камня');
  assert(isFiniteArray(stone.scale,3)&&stone.scale.every(n=>n>0.01&&n<=20),'некорректный масштаб камня');
  ids.add(stone.id);
  counts[byName.get(stone.name)]+=1;
 }
 assert(['large','main','chinking','lintel'].every(k=>counts[k]===entry.counts[k]),'состав камней не совпадает');
 return document;
}
async function fetchJson(url,signal){
 const response=await fetch(url,{signal,cache:'no-store'});
 if(!response.ok)throw new Error('Источник секций недоступен: HTTP '+response.status);
 return response.json();
}
async function fetchCatalog({signal}={}){
 return validateManualCatalog(await fetchJson(MANUAL_SECTION_CATALOG_URL,signal));
}
/** List of source-controlled manual recipes, separate from server-saved drafts. */
export async function listManualSections({signal}={}){
 const catalog=await fetchCatalog({signal});
 return catalog.sections.map(x=>({...x,cells:[...x.cells],counts:{...x.counts}}));
}
async function sha256(text){
 if(!globalThis.crypto?.subtle?.digest)return null;
 const hash=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
 return Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
}
/** Returns a new editable copy without changing the immutable source recipe. */
export async function loadManualSection(id,manifest,{signal}={}){
 const catalog=await fetchCatalog({signal});
 validateManualCatalog(catalog,manifest);
 const entry=catalog.sections.find(x=>x.id===id);
 assert(entry,'секция '+String(id)+' отсутствует в каталоге');
 const response=await fetch(MANUAL_SECTION_ROOT+'/'+entry.file,{signal,cache:'no-store'});
 if(!response.ok)throw new Error('Исходный JSON секции недоступен: HTTP '+response.status);
 const original=await response.text();
 const digest=await sha256(original);
 if(digest)assert(digest===entry.sha256,'контрольная сумма исходного JSON не совпадает');
 const document=validateManualSection(JSON.parse(original),entry,manifest);
 return {id:entry.id,title:document.title,recipe:structuredClone(document.recipe),sourceStatus:entry.status};
}
