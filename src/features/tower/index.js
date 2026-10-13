/** AlanTil 17.4: one prefab section editor. Legacy paid masonry is read-only.
 * Until section prices and transactional V3 RPC are approved, the sole editing
 * surface is an explicitly labelled local construction draft. No currency RPC.
 */
import {createTowerScene} from './prefab-scene.js?v=17.4.1';
import {PREFAB_TYPES,prefabSize,positionAgainst,validatePrefabPlacement} from '../../../packages/tower-game/prefab-layout.mjs';
import {towerUserId,loadTower,loadTowerV2} from './repository.js?v=17.1.5';
let active=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const memoryKey=id=>'alantil_tower_prefab_draft_17_4_'+(id||'guest');
function restoreDraft(key){
 try{
  const decoded=JSON.parse(localStorage.getItem(key)||'{}');
  if(decoded?.format!==3||!Array.isArray(decoded.sections)||decoded.sections.length>250)return[];
  const accepted=[];
  for(const s of decoded.sections){
   const section={id:s.id,type:'masonry_section',sectionId:s.sectionId,variant:s.variant,rotation:s.rotation,x:s.x,y:s.y,z:s.z};
   if(typeof section.id!=='string'||section.id.length>100||!section.id||accepted.some(b=>b.id===section.id)||!validatePrefabPlacement(accepted,section).ok)return[];
   accepted.push(section);
  }
  return accepted;
 }catch{return[];}
}
function saveDraft(key,sections){
 const payload={format:3,localDraft:true,sections,assetVersion:'17.4.1'};
 localStorage.setItem(key,JSON.stringify(payload));
}
const isEditable=(params)=>!params?.userId||params.userId===towerUserId();
export async function mount(context,params={}){
 const controller=new AbortController();
 const s={controller,context,disposed:false,scene:null,blocks:[],draft:[],legacy:[],variant:0,type:PREFAB_TYPES[1].id,rotation:0,tool:'place',selected:null,preview:null,previewHit:null,locked:false,busy:false,userId:towerUserId(),draftKey:'',revision:0,canLeave:()=>true};active=s;
 s.draftKey=memoryKey(s.userId);
 s.draft=restoreDraft(s.draftKey);
 context.shell.setHeaderContent?.({title:'Къала · Башня'});
 context.shell.appShell.dataset.feature='tower';
 const root=context.root;
 root.innerHTML=`<section class="view towerView"><div class="towerGame">
  <div class="towerStage"><div class="towerCanvas" role="application" aria-label="Строительство готовыми каменными секциями"></div>
   <div class="towerHud"><div class="towerPill towerBalance"><span class="towerCoin"><i></i><b data-silver>—</b></span><span class="towerCoin gold"><i></i><b data-gold>—</b></span></div></div>
   <div class="towerCamera"><button type="button" class="iconBtn" data-camera="home" title="Вся башня" aria-label="Вся башня">⌂</button></div>
   <div class="towerPill towerReadOnly" data-draft-notice>Готовые секции · локальный черновик без покупки</div>
  </div>
  <div class="towerActionBar is-visible">
   <div class="towerQuickTools"><button type="button" class="btn actionCompact" data-rotate>Повернуть</button><button type="button" class="btn actionCompact" data-variant>Вариант 1/4</button><button type="button" class="btn actionCompact" data-cancel>Отмена</button></div>
   <div class="towerSelected" data-selected hidden></div>
   <div class="towerActions"><button type="button" class="btn actionPrimary towerAction" data-confirm disabled>Добавить в черновик</button><button type="button" class="btn towerAction" data-remove hidden>Убрать из черновика</button></div>
   <div class="towerStatus" role="status" aria-live="polite" data-status hidden></div>
  </div>
  <aside class="towerSide"><button type="button" class="btn actionCompact towerCatalogToggle is-open" data-catalog-toggle aria-expanded="true">Каталог⌄</button>
   <div class="towerCatalogContent" data-catalog-body>
    <div class="towerCatalog" role="group" aria-label="Пять размеров готовых каменных секций"></div>
    <div class="towerTool"><button type="button" class="btn actionCompact" data-tool="place" aria-pressed="true">Строить</button><button type="button" class="btn actionCompact" data-tool="select" aria-pressed="false">Выбрать</button></div>
    <div class="towerDimensions" data-sizing></div>
    <details class="towerPrefabMore"><summary class="btn actionCompact">Ещё</summary>
      <p class="towerPrefabHelp">Постройка в черновике хранится только на этом устройстве. Покупки будут доступны после утверждения стоимости секций и подключения серверного V3.</p>
      <div class="towerPosition">${['x','y','z'].map(a=>`<label>${a.toUpperCase()}<input type="number" data-coordinate="${a}" step="0.25" min="0" max="80" value="0"></label>`).join('')}</div>
      <button type="button" class="btn actionCompact" data-refresh>Обновить старую башню</button>
      <button type="button" class="btn actionCompact" data-clear>Очистить локальный черновик</button>
      <p class="towerPrefabHelp" data-legacy-status>Ранее приобретённые элементы отображаются без изменений и списаний.</p>
    </details>
   </div>
  </aside>
 </div></section>`;
 const q=x=>root.querySelector(x);
 const on=(sel,event,cb)=>q(sel)?.addEventListener(event,cb,{signal:controller.signal});
 const qStatus=q('[data-status]');
 function status(message='',error=false){if(s.disposed)return;qStatus.textContent=message;qStatus.hidden=!message;qStatus.dataset.kind=error?'error':'info';}
 function all(){return[...s.legacy,...s.draft];}
 function updateCatalog(){
  q('.towerCatalog').innerHTML=PREFAB_TYPES.map(spec=>`<button type="button" class="btn towerItem" data-section-id="${spec.id}" aria-pressed="${String(spec.id===s.type)}"><span class="towerItemIcon" aria-hidden="true">◆</span><span class="towerItemName">${spec.id.replaceAll('x','×')}</span><span class="towerPrice">Готовая секция</span></button>`).join('');
  q('[data-sizing]').textContent=`${s.type.replaceAll('x',' × ')} · ${prefabSize(s.type).map(v=>Math.round(v*25)).join(' × ')} см`;
  q('[data-variant]').textContent=`Вариант ${s.variant+1}/4`;
 }
 function coordinates(){for(const a of ['x','y','z'])q(`[data-coordinate="${a}"]`).value=s.preview?.[a]?.toFixed(3)||'0';}
 function candidate(){
  if(s.manualPreview)return {...s.manualPreview,type:'masonry_section',sectionId:s.type,variant:s.variant,rotation:s.rotation,id:'__preview__'};
  if(!s.previewHit)return null;
  const current={id:'__preview__',type:'masonry_section',sectionId:s.type,variant:s.variant,rotation:s.rotation,x:0,y:0,z:0};
  const next=positionAgainst(current,s.previewHit);
  // The authoritative old blocks are never changed by preview or placement.
  return {...next,id:'__preview__'};
 }
 async function renderPreview(){
  if(s.disposed||!s.scene)return;
  if(s.tool!=='place'||!s.previewHit){s.preview=null;q('[data-confirm]').disabled=true;await s.scene.setPreview(null);return;}
  s.preview=candidate();const valid=validatePrefabPlacement(all(),s.preview);
  q('[data-confirm]').disabled=!valid.ok||!isEditable(params);
  coordinates();await s.scene.setPreview(s.preview,valid.ok);
  if(!valid.ok)status(valid.reason,true);else status('Подготовленная секция · можно добавить в локальный черновик');
 }
 async function redraw(){if(s.disposed||!s.scene)return;await s.scene.setBlocks(all());await renderPreview();}
 async function choose(type){if(!PREFAB_TYPES.some(t=>t.id===type))return;s.type=type;s.manualPreview=null;updateCatalog();await renderPreview();}
 function selectTool(tool){s.tool=tool;s.scene?.setTool(tool);for(const b of root.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',String(b.dataset.tool===tool));
  q('[data-confirm]').hidden=tool!=='place';q('[data-remove]').hidden=tool!=='select'||!s.selected||!s.draft.some(b=>b.id===s.selected);
  q('[data-selected]').hidden=tool!=='select'||!s.selected;
  void renderPreview();}
 function selectBlock(id){s.selected=id;const found=all().find(b=>b.id===id);
  q('[data-selected]').hidden=!found;
  q('[data-selected]').textContent=found?(found.type==='masonry_section'?`Секция ${found.sectionId} · локальный черновик`:'Ранее оплаченный элемент · только просмотр'):'';
  q('[data-remove]').hidden=!found||found.type!=='masonry_section'||!s.draft.some(b=>b.id===id)||!isEditable(params);
 }
 async function loadHistoric(){
  if(!s.userId)return;
  const target=params.userId||null;
  const [oldV2,oldV1]=await Promise.allSettled([loadTowerV2(target),loadTower(target)]);
  const values=[];
  if(oldV2.status==='fulfilled'){
   values.push(...oldV2.value.elements.map(x=>({...x,id:'historic-v2-'+x.id,legacy:true})));
   s.revision=oldV2.value.revision;
   q('[data-silver]').textContent=oldV2.value.silver;
   q('[data-gold]').textContent=oldV2.value.gold;
  }
  if(oldV1.status==='fulfilled')values.push(...oldV1.value.elements.map(x=>({...x,id:'historic-v1-'+x.id,legacy:true})));
  s.legacy=values;
  q('[data-legacy-status]').textContent=`Ранее приобретённые элементы: ${values.length}. Данные V1/V2 не изменяются.`;
  if(oldV1.status==='rejected'&&oldV2.status==='rejected')status('Не удалось получить старые сохранения; они не удалены.',true);
  await redraw();
 }
 on('.towerCatalog','click',e=>{const el=e.target.closest('[data-section-id]');if(el)void choose(el.dataset.sectionId);});
 on('[data-catalog-toggle]','click',()=>{const body=q('[data-catalog-body]');body.hidden=!body.hidden;q('[data-catalog-toggle]').setAttribute('aria-expanded',String(!body.hidden));});
 on('[data-tool="place"]','click',()=>{s.selected=null;selectTool('place');});
 on('[data-tool="select"]','click',()=>{s.previewHit=null;selectTool('select');});
 on('[data-rotate]','click',()=>{s.rotation=(s.rotation+1)%4;void renderPreview();});
 on('[data-variant]','click',()=>{s.variant=(s.variant+1)%4;updateCatalog();void renderPreview();});
 on('[data-cancel]','click',()=>{s.previewHit=null;s.manualPreview=null;s.locked=false;status('');void renderPreview();});
 for(const axis of ['x','y','z'])on(`[data-coordinate="${axis}"]`,'change',()=>{
  const p=s.preview||candidate();if(!p)return;
  const el=q(`[data-coordinate="${axis}"]`),value=Number(el.value);if(!Number.isFinite(value))return;
  const next={...p,[axis]:value};s.previewHit={position:[(next.x+prefabSize(s.type)[0]/2)*.25,0,(next.z+prefabSize(s.type)[2]/2)*.25],normal:{x:0,y:1,z:0}};
  // Manual editing uses explicitly entered axes without snapping or hiding a grid.
  s.preview={...next};s.manualPreview={...next};s.locked=true;
  void s.scene.setPreview(next,validatePrefabPlacement(all(),next).ok);
  q('[data-confirm]').disabled=!validatePrefabPlacement(all(),next).ok;
 });
 on('[data-confirm]','click',async()=>{
  if(s.busy||!isEditable(params)||!s.preview)return;
  const section={...s.preview,id:crypto.randomUUID()};
  const checked=validatePrefabPlacement(all(),section);if(!checked.ok){status(checked.reason,true);return;}
  s.busy=true;try{
   const newDraft=[...s.draft,section];saveDraft(s.draftKey,newDraft);s.draft=newDraft;
   s.locked=false;s.manualPreview=null;await redraw();status('Секция добавлена в локальный черновик. Монеты не списаны.');
  }catch(error){status('Невозможно сохранить черновик: '+String(error?.message||error),true);}finally{s.busy=false;}
 });
 on('[data-remove]','click',async()=>{
  if(s.busy||!s.selected||!isEditable(params))return;
  const updated=s.draft.filter(b=>b.id!==s.selected);
  // Do not silently strand any upper sections.
  if(updated.some((b,i)=>!validatePrefabPlacement([...s.legacy,...updated.filter((_,j)=>j!==i)],b).ok)){
   status('Нельзя удалить опору: сначала уберите верхние секции.',true);return;
  }
  saveDraft(s.draftKey,updated);s.draft=updated;s.selected=null;selectBlock(null);await redraw();
 });
 on('[data-clear]','click',async()=>{if(!isEditable(params))return;saveDraft(s.draftKey,[]);s.draft=[];s.selected=null;selectBlock(null);await redraw();status('Локальный черновик очищен; купленные элементы сохранены.');});
 on('[data-refresh]','click',()=>{void loadHistoric();});
 on('[data-camera]','click',()=>s.scene?.home());
 window.addEventListener('keydown',e=>{
  if(s.disposed||e.target?.closest?.('input,textarea,select,[contenteditable]')||e.ctrlKey||e.metaKey)return;
  if(e.key==='Escape'){s.previewHit=null;void renderPreview();}if(e.key.toLowerCase()==='r'){s.rotation=(s.rotation+1)%4;void renderPreview();}
 },{signal:controller.signal});
 const game=q('.towerGame'),dock=q('.towerSide');const observeDock=new ResizeObserver(()=>game.style.setProperty('--tower-dock-height',Math.ceil(dock.getBoundingClientRect().height)+'px'));observeDock.observe(dock);controller.signal.addEventListener('abort',()=>observeDock.disconnect(),{once:true});
 try{
  s.scene=await createTowerScene(q('.towerCanvas'),{
   onPick(hit){s.previewHit=hit;s.manualPreview=null;s.locked=true;selectTool('place');void renderPreview();},
   onSelection(id){selectBlock(id);},
   onCameraChange(camera){if(s.disposed||s.locked||s.tool!=='place')return;
    const nextHit=camera.hit||{position:camera.target,normal:{x:0,y:1,z:0}};
    const last=s.previewHit;
    if(last&&last.block?.id===nextHit.block?.id&&last.position.every((v,i)=>Math.abs(v-nextHit.position[i])<.04))return;
    s.previewHit=nextHit;void renderPreview();}
  });
  if(s.disposed){s.scene.dispose();return;}
  updateCatalog();await redraw();await loadHistoric();
  if(params.userId&&!isEditable(params)){q('[data-draft-notice]').textContent='Башня другого игрока · только просмотр';q('[data-confirm]').disabled=true;}
 }catch(error){status('Не удалось загрузить библиотеку секций: '+String(error?.message||error),true);}
}
export function canLeave(){return active?.canLeave?.()??true;}
export function unmount(){if(!active)return;active.disposed=true;active.controller.abort();active.scene?.dispose();if(active.context.shell.appShell.dataset.feature==='tower')active.context.shell.appShell.dataset.feature='practice';active=null;}