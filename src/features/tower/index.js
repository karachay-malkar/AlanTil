/** AlanTil 17.5.2 — free, permanent prefabricated masonry, server-authoritative V3.
 * Old purchased V1/V2 elements remain read only. No local construction drafts.
 */
import {createTowerScene} from './prefab-scene.js?v=17.5.4-gatestones.1';
import {PREFAB_TYPES,positionAgainst,validatePrefabPlacement} from '../../../packages/tower-game/prefab-layout.mjs';
import {WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION} from '../../../packages/tower-game/window-prefab.mjs';
import {DOOR_PREFAB_ID,DOOR_PREFAB_VERSION} from '../../../packages/tower-game/door-prefab.mjs';
import {GATE_PREFAB_ID,GATE_PREFAB_VERSION} from '../../../packages/tower-game/gate-prefab.mjs';
import {WILD_PREFAB_VERSION,WILD_VARIANTS_PER_SIZE,isWildPrefab} from '../../../packages/tower-game/wild-prefab.mjs';
import {GATE_STONE_VERSION,GATE_STONE_VARIANTS,isGateStone} from '../../../packages/tower-game/gate-stone-prefab.mjs';
import {validateSectionJoints} from '../../../packages/tower-game/prefab-joints.mjs';
import {towerUserId,loadTower,loadTowerV2,loadTowerV3,mutateTowerV3} from './repository.js?v=17.5.2';
let active=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const historicDraftKey=id=>'alantil_tower_prefab_draft_17_4_'+(id||'guest');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function historicDrafts(id){
 try{
  const data=JSON.parse(localStorage.getItem(historicDraftKey(id))||'null');
  return data?.format===3&&Array.isArray(data.sections)?data.sections.slice(0,250):[];
 }catch{return[];}
}
const editable=(s)=>!s.params?.userId||s.params.userId===s.userId;
const icon=(name,body)=>`<button type="button" class="btn towerIconAction" data-${name} aria-label="${body}" title="${body}">${{
 confirm:'✓',cancel:'×',rotate:'⟳',variant:'◇',remove:'⌫',hammer:'⚒'}[name]}</button>`;
export async function mount(context,params={}){
 const controller=new AbortController();
 const s={context,params,controller,disposed:false,userId:towerUserId(),scene:null,mode:'idle',
  sections:[],legacy:[],revision:0,selected:null,type:PREFAB_TYPES[1].id,variant:0,rotation:0,
  preview:null,previewHit:null,locked:false,busy:false,ready:false,canLeave:()=>true};
 active=s;
 context.shell.setHeaderContent?.({title:'Къала · Башня'});
 context.shell.appShell.dataset.feature='tower';
 const root=context.root;
 root.innerHTML=`<section class="view towerView"><div class="towerGame" data-mode="idle">
  <div class="towerStage"><div class="towerCanvas" role="application" aria-label="Каменная башня"></div>
   <div class="towerCamera"><button type="button" class="iconBtn" data-camera="home" aria-label="Показать всю башню" title="Показать всю башню">⌂</button></div>
  </div>
  <div class="towerPlacementBar" data-placement hidden role="toolbar" aria-label="Установка секции">
   ${icon('confirm','Установить')}${icon('cancel','Отменить')}${icon('rotate','Повернуть на 90°')}${icon('variant','Сменить вариант')}
  </div>
  <div class="towerSelectionBar" data-selection hidden role="toolbar" aria-label="Выделенная секция">
   ${icon('remove','Удалить выбранную секцию')}
  </div>
  <aside class="towerSide is-open" data-side>
   <div class="towerCatalogContent" data-catalog-body><div class="towerCatalog" role="group" aria-label="Каталог каменных секций"></div></div>
  </aside>
  ${icon('hammer','Каталог секций')}
  <div class="towerToast" data-toast role="status" aria-live="polite" hidden></div>
 </div></section>`;
 const q=sel=>root.querySelector(sel);
 const on=(sel,type,cb)=>q(sel)?.addEventListener(type,cb,{signal:controller.signal});
 const game=q('.towerGame'),side=q('[data-side]');
 const catalog=q('.towerCatalog');
 catalog.innerHTML=PREFAB_TYPES.map(spec=>`<button type="button" class="btn towerItem" data-section-id="${spec.id}" aria-label="Секция ${spec.id.replaceAll('x',' на ')}"><span class="towerItemIcon" aria-hidden="true">◈</span><span class="towerItemName">[ ${spec.id===WINDOW_PREFAB_ID?'Окно 0,5×1 м':spec.id===DOOR_PREFAB_ID?'Дверь 0,75×2 м':spec.id===GATE_PREFAB_ID?'Ворота 2×2 м':spec.id.replaceAll('x','×')} ]</span></button>`).join('');
 let toastTimer=null;
 function message(text){
  if(s.disposed)return;
  const el=q('[data-toast]');el.textContent=text;el.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{if(!s.disposed)el.hidden=true;},3200);
 }
 function blocks(){return[...s.legacy,...s.sections];}
 function catalogVisible(show){
  side.classList.toggle('is-open',!!show);
  q('[data-hammer]').setAttribute('aria-expanded',String(!!show));
 }
 function mode(next){
  s.mode=next;game.dataset.mode=next;
  q('[data-placement]').hidden=next!=='placing'&&next!=='saving-place';
  q('[data-selection]').hidden=next!=='selected'&&next!=='saving-remove';
  q('[data-confirm]').disabled=next!=='placing';
  q('[data-variant]').hidden=s.type===WINDOW_PREFAB_ID||s.type===DOOR_PREFAB_ID||s.type===GATE_PREFAB_ID;
  q('[data-remove]').disabled=next!=='selected';
  if(next==='placing'||next==='saving-place')catalogVisible(false);
  else if(next==='idle')catalogVisible(true);
  s.scene?.setTool(next==='placing'||next==='saving-place'?'place':'select');
  if(next!=='placing'&&next!=='saving-place')void s.scene?.setPreview(null);
 }
 function markSelection(id){
  const chosen=s.sections.find(b=>b.id===id);
  s.selected=chosen?.id||null;
  s.scene?.setSelected(s.selected);
  mode(chosen&&editable(s)?'selected':'idle');
  if(chosen&&editable(s))catalogVisible(false);
 }
 function placement(){
  if(s.mode!=='placing'&&s.mode!=='saving-place')return null;
  const hit=s.previewHit||s.scene?.getAimHit?.();
  if(!hit)return null;
  const item={id:'00000000-0000-4000-8000-000000000001',type:'masonry_section',sectionId:s.type,
   variant:s.variant,rotation:s.rotation,x:0,y:0,z:0,geometryVersion:s.type===WINDOW_PREFAB_ID?WINDOW_PREFAB_VERSION:s.type===DOOR_PREFAB_ID?DOOR_PREFAB_VERSION:s.type===GATE_PREFAB_ID?GATE_PREFAB_VERSION:isGateStone(s.type)?GATE_STONE_VERSION:isWildPrefab(s.type)?WILD_PREFAB_VERSION:'17.5.2'};
  return positionAgainst(item,hit);
 }
 let previewSequence=0;
 async function preview(){
  const generation=++previewSequence;
  if(s.disposed||s.mode!=='placing'||!s.scene)return;
  const candidate=placement();s.preview=candidate;
  const placing=candidate&&validatePrefabPlacement(blocks(),candidate);
  const joints=placing?.ok?validateSectionJoints(s.sections,candidate,s.scene.manifest):{ok:false};
  const valid=!!placing?.ok&&joints.ok;
  q('[data-confirm]').disabled=!valid||!editable(s)||s.busy;
  await s.scene.setPreview(candidate,valid);
  if(generation!==previewSequence||s.disposed)return;
  q('[data-confirm]').dataset.valid=String(valid);
 }
 async function redraw(){
  if(s.disposed||!s.scene)return;
  await s.scene.setBlocks(blocks());
  s.scene.setSelected(s.selected);
  if(s.mode==='placing')await preview();
 }
 function begin(type){
  if(!editable(s))return;
  s.type=type;s.variant=0;s.rotation=0;s.selected=null;s.locked=false;
  s.previewHit=s.scene?.getAimHit?.()||null;
  s.scene?.setSelected(null);
  mode('placing');void preview();
 }
 function cancel(){
  ++previewSequence;s.preview=null;s.previewHit=null;s.selected=null;s.locked=false;
  s.scene?.setSelected(null);mode('idle');
 }
 async function loadHistoric(){
  if(!s.userId)return;
  const target=params.userId||null;
  const [v2,v1]=await Promise.allSettled([loadTowerV2(target),loadTower(target)]);
  const next=[];
  if(v2.status==='fulfilled')next.push(...v2.value.elements.map(b=>({...b,id:'historic-v2-'+b.id,legacy:true})));
  if(v1.status==='fulfilled')next.push(...v1.value.elements.map(b=>({...b,id:'historic-v1-'+b.id,legacy:true})));
  s.legacy=next;
  if(v2.status==='rejected'&&v1.status==='rejected')message('Не удалось загрузить ранее приобретённые элементы');
 }
 async function refreshServer(){
  if(!s.userId){s.sections=[];s.revision=0;await redraw();return;}
  const snapshot=await loadTowerV3(params.userId||null);
  s.sections=snapshot.elements;s.revision=snapshot.revision;
  await redraw();
 }
 async function importHistoricDrafts(){
  // One-time recovery only; never write new constructions into localStorage.
  if(!s.userId||!editable(s))return;
  const key=historicDraftKey(s.userId),old=historicDrafts(s.userId);
  if(!old.length)return;
  const remains=[];
  const sorted=[...old].sort((a,b)=>(a.y??0)-(b.y??0));
  for(const original of sorted){
   const section={id:original.id,type:'masonry_section',sectionId:original.sectionId,
    variant:original.variant,rotation:original.rotation,x:original.x,y:original.y,z:original.z,
    geometryVersion:original.geometryVersion||'17.4.1'};
   if(s.sections.some(b=>b.id===section.id))continue;
   if(!['17.5.0','17.5.1','17.5.2'].includes(section.geometryVersion)||!uuid.test(section.id)||
      !validatePrefabPlacement(blocks(),section).ok||
      !validateSectionJoints(s.sections,section,s.scene.manifest).ok){remains.push(original);continue;}
   try{
    // Stable operation ID makes a retry idempotent even after connection loss.
    const result=await mutateTowerV3({revision:s.revision,id:section.id,action:'place',section});
    s.sections=result.elements;s.revision=result.revision;
   }catch{remains.push(original);await refreshServer();}
  }
  if(remains.length!==old.length){
   if(remains.length)localStorage.setItem(key,JSON.stringify({format:3,localDraft:true,assetVersion:'17.5.2',sections:remains}));
   else localStorage.removeItem(key);
   await redraw();
  }
 }
 async function mutate(action,section=null,sectionId=null){
  if(s.busy||!s.userId||!editable(s))return;
  s.busy=true;mode(action==='place'?'saving-place':'saving-remove');
  const operationId=crypto.randomUUID();
  try{
   const data=await mutateTowerV3({revision:s.revision,id:operationId,action,section,sectionId});
   s.sections=data.elements;s.revision=data.revision;
   s.selected=null;s.preview=null;s.previewHit=null;s.locked=false;
   mode('idle');await redraw();
  }catch(error){
   const reason=String(error?.message||error);
   if(reason.includes('REVISION_CONFLICT')){
    try{await refreshServer();}catch{ /* server returned a conflict; keep original scene */ }
   }
   mode(action==='place'?'placing':'selected');
   message(reason.includes('AUTH_')?'Необходимо войти в аккаунт':
    reason.includes('SUPPORT')?'Нельзя удалить несущую секцию':
    reason.includes('REVISION_CONFLICT')?'Башня изменилась. Выберите место снова.':
    'Не удалось сохранить башню');
   if(action==='place')await preview();
  }finally{s.busy=false;if(s.mode==='placing')await preview();}
 }
 on('.towerCatalog','click',event=>{
  const el=event.target.closest('[data-section-id]');if(el)begin(el.dataset.sectionId);
 });
 on('[data-hammer]','click',()=>{
  if(s.mode==='saving-place'||s.mode==='saving-remove')return;
  if(s.mode==='placing')cancel();
  if(s.mode==='selected'){markSelection(null);catalogVisible(true);return;}
  catalogVisible(!side.classList.contains('is-open'));
 });
 on('[data-cancel]','click',cancel);
 on('[data-rotate]','click',()=>{if(s.mode!=='placing')return;s.rotation=(s.rotation+1)%4;void preview();});
 on('[data-variant]','click',()=>{if(s.mode!=='placing')return;
  const count=s.type===WINDOW_PREFAB_ID||s.type===DOOR_PREFAB_ID||s.type===GATE_PREFAB_ID?1:isGateStone(s.type)?GATE_STONE_VARIANTS:isWildPrefab(s.type)?WILD_VARIANTS_PER_SIZE:(s.scene?.manifest?.types?.find(t=>t.id===s.type)?.variants?.length||3);
  s.variant=(s.variant+1)%count;void preview();
 });
 on('[data-confirm]','click',()=>{
  if(s.mode!=='placing'||!s.preview||q('[data-confirm]').disabled)return;
  if(!s.userId){message('Для сохранения башни необходимо войти в аккаунт');return;}
  const section={...s.preview,id:crypto.randomUUID()};
  if(!validatePrefabPlacement(blocks(),section).ok||!validateSectionJoints(s.sections,section,s.scene.manifest).ok)return;
  void mutate('place',section,null);
 });
 on('[data-remove]','click',()=>{
  if(s.mode!=='selected'||!s.selected)return;
  const id=s.selected,remaining=s.sections.filter(b=>b.id!==id);
  if(remaining.some((b,i)=>!validatePrefabPlacement([...s.legacy,...remaining.filter((_,j)=>j!==i)],b).ok)){
   message('Нельзя удалить опору для верхних секций');return;
  }
  void mutate('remove',null,id);
 });
 on('[data-camera]','click',()=>s.scene?.home());
 window.addEventListener('keydown',e=>{
  if(s.disposed||e.target?.closest?.('input,textarea,select,[contenteditable]')||e.ctrlKey||e.metaKey)return;
  if(e.key==='Escape'){cancel();return;}
  if(e.key.toLowerCase()==='r'&&s.mode==='placing'){s.rotation=(s.rotation+1)%4;void preview();}
 },{signal:controller.signal});
 try{
  s.scene=await createTowerScene(q('.towerCanvas'),{
   onPick(hit){if(s.mode!=='placing')return;s.previewHit=hit;s.locked=true;void preview();},
   onSelection(id){if(s.mode==='idle'||s.mode==='selected')markSelection(id);},
   onCameraChange(camera){if(s.mode!=='placing'||s.locked)return;
    const hit=camera.hit||{position:camera.target,normal:{x:0,y:1,z:0}};
    const last=s.previewHit;
    if(last&&last.block?.id===hit.block?.id&&last.position.every((v,i)=>Math.abs(v-hit.position[i])<.04))return;
    s.previewHit=hit;void preview();}
  });
  if(s.disposed){s.scene.dispose();return;}
  mode('idle');
  await loadHistoric();
  try{await refreshServer();}catch{message('Не удалось загрузить сохранённую башню');await redraw();}
  await importHistoricDrafts();
  if(params.userId&&!editable(s))catalogVisible(false);
  s.ready=true;
 }catch(error){message('Не удалось загрузить 3D-сцену');console.error(error);}
}
export function canLeave(){return active?.canLeave?.()??true;}
export function unmount(){
 if(!active)return;active.disposed=true;active.controller.abort();active.scene?.dispose();
 if(active.context.shell.appShell.dataset.feature==='tower')active.context.shell.appShell.dataset.feature='practice';
 active=null;
}