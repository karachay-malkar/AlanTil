/** AlanTil tower: server-authoritative approved prefab construction only. */
import {createTowerScene} from './prefab-scene.js?v=17.2.82';
import {mayOpenTower} from './access.mjs';
import {subscribeToAuth} from '../../shared/auth/auth-service.js?v=16.8.0.16';
import {toggleBatchSelection,retainBatchSelection} from './batch-delete-selection.mjs?v=17.2.71';
import {nudgePrefabOnFace} from '../../../packages/tower-game/prefab-placement-face.mjs';
import {BUILDABLE_PREFAB_TYPES,positionAgainst,validatePrefabPlacement} from '../../../packages/tower-game/prefab-layout.mjs';
import {ROOF_BEAM_VERSION,roofBeamId,roofBeamLength,isRoofBeamId,positionRoofBeamAgainst} from '../../../packages/tower-game/roof-beam.mjs';
import {roofCoverCells,checkRoofPlacement} from '../../../packages/tower-game/roof-cover.mjs';
import {tekmetSectionCost,tekmetRoofCost,tekmetIcon} from '../../../packages/tower-game/tekmet-economy.mjs';
import {prefabBounds} from '../../../packages/tower-game/prefab-layout.mjs';
import {WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION} from '../../../packages/tower-game/window-prefab.mjs';
import {DOOR_PREFAB_ID,DOOR_PREFAB_VERSION} from '../../../packages/tower-game/door-prefab.mjs';
import {GATE_PREFAB_ID,GATE_PREFAB_VERSION} from '../../../packages/tower-game/gate-prefab.mjs';
import {BAGANA_PREFAB_ID,BAGANA_PREFAB_VERSION,BAGANA_PREFAB_VERSION_V2,BAGANA_WOOD_HEIGHT_CELLS,baganaPrefab,baganaType,nextBaganaType,isBaganaPrefab} from '../../../packages/tower-game/bagana-prefab.mjs';
import {APPROVED_PREFAB_VERSION,approvedVariantCount,isApprovedMasonryType} from '../../../packages/tower-game/approved-prefab.mjs';
import {validateSectionJoints,resolvePrefabJoints} from '../../../packages/tower-game/prefab-joints.mjs';
import {planMasonryLine,checkMasonryLine,editMasonryEndpoint,undoMasonryEndpoint} from '../../../packages/tower-game/masonry-line.mjs?v=17.2.82';
import {towerUserId,loadTowerV3,mutateTowerV3,placeTowerLine,removeTowerV3Sections,clearTowerV3,loadTowerRoofs,placeTowerRoof,removeTowerRoof} from './repository.js?v=17.2.71';
import {uiIcon} from '../../shared/ui/icons.js?v=17.2.82';
let active=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const editable=(s)=>!s.params?.userId||s.params.userId===s.userId;
const TOWER_ICONS={confirm:'check',cancel:'x',rotate:'rotateCw',variant:'layers',undo:'undo2',remove:'trash2','batch-confirm':'trash2','batch-cancel':'x',hammer:'hammer',clear:'trash2'};
const icon=(name,label)=>`<button type="button" class="btn towerIconAction" data-${name} aria-label="${label}" title="${label}">${uiIcon(TOWER_ICONS[name])}</button>`;
export async function mount(context,params={}){
 if(!mayOpenTower(towerUserId())){
  context.root.innerHTML='<section class="view"><div class="panel">Раздел временно недоступен</div></section>';
  return;
 }
 const controller=new AbortController();
 const s={context,params,controller,disposed:false,userId:towerUserId(),scene:null,mode:'idle',
  sections:[],revision:0,resetAt:null,selected:null,deleteIds:new Set(),deleteOperation:null,loadFailed:false,type:BUILDABLE_PREFAB_TYPES[0].id,variant:0,rotation:0,
  preview:null,previewSections:[],previewHit:null,locked:false,nudge:{x:0,y:0,z:0},lineStart:null,lineEnd:null,lineTipShown:false,beamShift:0,busy:false,ready:false,canLeave:()=>true,
  roofs:[],tekmetBalance:null,roofBalance:null,roofDraft:null,roofValidity:null,selectedRoofId:null};
 active=s;
 const stopTowerAuth=subscribeToAuth(auth=>{
  if(!auth?.ready||s.disposed||mayOpenTower(auth.user?.id))return;
  queueMicrotask(()=>{if(!s.disposed)void context.router?.replace('practice.home',{}, {reason:'session_changed',force:true});});
 });
 controller.signal.addEventListener('abort',stopTowerAuth,{once:true});
 context.shell.setHeaderContent?.({title:'Къала · Башня'});
 context.shell.appShell.dataset.feature='tower';
 const root=context.root;
 root.innerHTML=`<section class="view towerView"><div class="towerGame" data-mode="idle">
  <div class="towerTekmetWallet" data-tekmet-wallet hidden aria-label="Баланс текметов">${tekmetIcon("towerTekmetIcon")}<output data-tekmet-balance>0</output></div>
  <div class="towerStage"><div class="towerCanvas" role="application" aria-label="Каменная башня"></div></div>
  <div class="towerCamera" role="group" aria-label="Камера">
   <button type="button" class="btn towerIconAction" data-home aria-label="К участку" title="К участку">${uiIcon('house')}</button>
   <button type="button" class="btn towerIconAction" data-delete-mode aria-pressed="false" aria-label="Выбрать блоки для удаления" title="Выбрать блоки для удаления" disabled>${uiIcon('trash2')}</button>
  </div>
  <div class="towerQuickActions" role="group" aria-label="Экран и настройки">
   <button type="button" class="btn towerIconAction towerOrientationAction" data-orientation aria-label="Горизонтальный экран" title="Горизонтальный экран">${uiIcon('deviceLandscape')}</button>
   <button type="button" class="btn towerIconAction" data-settings aria-expanded="false" aria-controls="tower-settings-panel" aria-label="Настройки башни" title="Настройки башни">${uiIcon('settings')}</button>
  </div>
  <div class="towerSettingsMenu" id="tower-settings-panel" data-settings-panel hidden>
   <button type="button" class="btn towerIconAction" data-clear aria-label="Очистить всю башню" title="Очистить всю башню">${uiIcon('trash2')}</button><span>Очистить башню</span><span data-clear-note class="towerSettingsHint" hidden></span>
  </div>
  <div class="towerBaganaHeights" data-bagana-heights hidden role="group" aria-label="Высота деревянной багъаны">
   <span>Дерево, м:</span>
   ${BAGANA_WOOD_HEIGHT_CELLS.map(c=>`<button type="button" class="btn" data-bagana-wood-cells="${c}" aria-pressed="false">${(c*.25).toFixed(2)}</button>`).join('')}
  </div>
  <div class="towerBeamControls" data-beam-controls hidden role="group" aria-label="Длина и смещение балки">
   <div class="towerBeamRow"><span class="towerBeamLabel">Длина</span>
    <button type="button" class="btn" data-beam-shorter aria-label="Укоротить на 25 см" title="Укоротить на 25 см">${uiIcon('arrowDown')}</button>
    <output data-beam-length>4,00 м</output>
    <button type="button" class="btn" data-beam-longer aria-label="Удлинить на 25 см" title="Удлинить на 25 см">${uiIcon('arrowUp')}</button>
   </div>
   <div class="towerBeamRow"><span class="towerBeamLabel">Смещение</span>
    <button type="button" class="btn" data-beam-back aria-label="Сдвинуть влево на 25 см" title="Сдвинуть влево на 25 см">${uiIcon('arrowLeft')}</button>
    <button type="button" class="btn" data-beam-forward aria-label="Сдвинуть вправо на 25 см" title="Сдвинуть вправо на 25 см">${uiIcon('arrowRight')}</button>
   </div>
  </div>
  <div class="towerPlacementBar" data-placement hidden role="toolbar" aria-label="Установка секции">
   <span class="towerLineCount" data-line-count hidden></span>
   <div class="towerTekmetQuote" data-tekmet-quote hidden aria-label="Стоимость строительства">${tekmetIcon("towerTekmetIcon")}<output data-tekmet-price>0</output></div>
   ${icon('confirm','Установить')}${icon('cancel','Отменить')}${icon('rotate','Повернуть на 90°')}${icon('variant','Сменить вариант')}${icon('undo','Убрать последнюю точку')}
  </div>
  <div class="towerNudge" data-nudge hidden role="group" aria-label="Сдвиг секции по сетке 25 см">
   <button type="button" data-nudge-direction="up" aria-label="Сдвинуть вверх по плоскости на 25 см">${uiIcon("arrowUp")}</button>
   <div><button type="button" data-nudge-direction="left" aria-label="Сдвинуть влево на 25 см">${uiIcon("arrowLeft")}</button><button type="button" data-nudge-direction="right" aria-label="Сдвинуть вправо на 25 см">${uiIcon("arrowRight")}</button></div>
   <button type="button" data-nudge-direction="down" aria-label="Сдвинуть вниз по плоскости на 25 см">${uiIcon("arrowDown")}</button>
  </div>
  <div class="towerSelectionBar" data-selection hidden role="toolbar" aria-label="Выделенная секция">
   ${icon('remove','Выбрать для удаления')}
  </div>
  <div class="towerBatchRemoveBar" data-batch-remove hidden role="toolbar" aria-label="Множественное удаление">
   <span class="towerBatchCount">Выбрано: <output data-batch-count>0</output></span>
   ${icon('batch-confirm','Удалить выбранные блоки')}${icon('batch-cancel','Отмена выделения')}
  </div>
  <aside class="towerSide" data-side aria-label="Каталог секций">
   <button type="button" class="btn towerCatalogClose" data-catalog-close aria-label="Закрыть каталог" title="Закрыть каталог">${uiIcon('x')}</button>
   <div class="towerCatalogContent" data-catalog-body><div class="towerCatalog" role="group" aria-label="Каталог строительных элементов"></div></div>
  </aside>
  ${icon('hammer','Каталог секций')}
  <div class="towerToast" data-toast role="status" aria-live="polite" hidden></div>
  <div class="towerLoadStatus" data-load-status role="status" aria-live="polite">
   <span data-load-text>Запуск строительства…</span>
   <button type="button" class="btn towerLoadRetry" data-retry hidden>Повторить загрузку</button>
  </div>
 </div></section>`;
 const q=sel=>root.querySelector(sel);
 const on=(sel,type,cb)=>q(sel)?.addEventListener(type,cb,{signal:controller.signal});
 const game=q('.towerGame'),side=q('[data-side]');
 let fullscreenByTower=false,orientationLocked=false;
 const isPortrait=()=>matchMedia('(orientation:portrait)').matches;
 function syncOrientationButton(){
  const portrait=isPortrait(),button=q('[data-orientation]');
  const target=portrait?'Горизонтальный экран':'Вертикальный экран';
  button.setAttribute('aria-label',target);button.title=target;
  button.innerHTML=uiIcon(portrait?'deviceLandscape':'devicePortrait');
  button.dataset.target=portrait?'landscape':'portrait';
 }
 async function requestTowerOrientation(target,{gesture=false}={}){
  if(s.disposed)return false;
  try{
   // Android often requires fullscreen entered from a real button press.
   if(gesture&&!document.fullscreenElement&&document.documentElement.requestFullscreen){
    // Back navigation and the global confirmation modal must be visible in fullscreen.
    await document.documentElement.requestFullscreen();fullscreenByTower=true;
   }
   if(!screen.orientation?.lock)throw Error('Screen Orientation API unavailable');
   await screen.orientation.lock(target);orientationLocked=true;
   syncOrientationButton();return true;
  }catch(error){
   console.info('Screen orientation lock was denied:',error?.message||error);
   if(gesture)message('Браузер не разрешил поворот. Включи автоповорот экрана в настройках телефона.');
   syncOrientationButton();return false;
  }
 }
 on('[data-orientation]','click',()=>{void requestTowerOrientation(isPortrait()?'landscape':'portrait',{gesture:true});});
 window.addEventListener('orientationchange',syncOrientationButton,{signal:controller.signal});
 window.addEventListener('resize',syncOrientationButton,{signal:controller.signal});
 s.cleanupOrientation=()=>{
  if(orientationLocked)try{screen.orientation.unlock?.();}catch{}
  if(fullscreenByTower&&document.fullscreenElement)void document.exitFullscreen?.().catch(()=>{});
 };
 syncOrientationButton();
 void requestTowerOrientation('landscape');
 const catalog=q('.towerCatalog');
 const catalogItem=spec=>{
  const title=spec.id==='roof-cover'?'Покрытие':isRoofBeamId(spec.id)?'Балка':spec.id===WINDOW_PREFAB_ID?'Терезе':spec.id===DOOR_PREFAB_ID?'эшик':spec.id===GATE_PREFAB_ID?'къабакъла':isBaganaPrefab(spec.id)?'Багъана':spec.id.replaceAll('x','×');
  const symbol=spec.id==='roof-cover'?'layers':isRoofBeamId(spec.id)?'layers':spec.id===WINDOW_PREFAB_ID?'appWindow':spec.id===DOOR_PREFAB_ID?'doorClosed':spec.id===GATE_PREFAB_ID?'gate':isBaganaPrefab(spec.id)?'bagana':'blocks';
  const cost=spec.id==='roof-cover'?1:tekmetSectionCost(spec.id);
  return `<button type="button" class="btn towerItem" data-section-id="${spec.id}" aria-label="${title}, ${cost} текметов" title="${title}"><span class="towerItemIcon" aria-hidden="true">${uiIcon(symbol)}</span><span class="towerItemName">${title}</span><span class="towerItemPrice">${tekmetIcon('towerTekmetIcon')}<span>${cost}${spec.id==='roof-cover'?'/яч':''}</span></span></button>`;
 };
 const walls=BUILDABLE_PREFAB_TYPES.filter(spec=>isApprovedMasonryType(spec.id));
 const openings=BUILDABLE_PREFAB_TYPES.filter(spec=>[WINDOW_PREFAB_ID,DOOR_PREFAB_ID,GATE_PREFAB_ID].includes(spec.id));
 // One catalog entry, not 15 internal prefab IDs. The existing type action cycles the fork forms.
 const baganaCatalogItem={id:baganaType(1,10)};
 const groups=[
  {id:'walls',label:'Къабыргъа',items:walls},
  {id:'openings',label:'Тешик толтуруу',items:openings},
  {id:'bagana',label:'Багъана',items:[baganaCatalogItem]},
  {id:'roof',label:'Крыша',items:[{id:roofBeamId(16)},{id:'roof-cover'}]}
 ];
 catalog.innerHTML=`<div class="towerCatalogTabs" role="tablist" aria-label="Разделы каталога">${groups.map((group,i)=>
  `<button type="button" class="bracketNavigation towerCatalogTab" role="tab" id="tower-tab-${group.id}" data-catalog-category="${group.id}" aria-controls="tower-panel-${group.id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">[${group.label}]</button>`).join('')}</div>`+
  groups.map((group,i)=>`<div class="towerCatalogPanel" role="tabpanel" id="tower-panel-${group.id}" aria-labelledby="tower-tab-${group.id}" data-catalog-panel="${group.id}" ${i===0?'':'hidden'}>${group.items.map(catalogItem).join('')}</div>`).join('');
 const setCatalogCategory=category=>{
  if(!groups.some(group=>group.id===category))return;
  catalog.querySelectorAll('[data-catalog-category]').forEach(tab=>{
   const selected=tab.dataset.catalogCategory===category;
   tab.setAttribute('aria-selected',String(selected));tab.classList.toggle('active',selected);
   tab.tabIndex=selected?0:-1;
  });
  catalog.querySelectorAll('[data-catalog-panel]').forEach(panel=>{panel.hidden=panel.dataset.catalogPanel!==category;});
 };
 let toastTimer=null;
 function message(text){
  if(s.disposed)return;
  const el=q('[data-toast]');el.textContent=text;el.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{if(!s.disposed)el.hidden=true;},3200);
 }
 function blocks(){return s.sections;}
 function balanceUpdate(next){
  s.tekmetBalance=next==null?null:Number(next);
  const wallet=q('[data-tekmet-wallet]');wallet.hidden=s.tekmetBalance==null||!editable(s);
  if(s.tekmetBalance!=null)q('[data-tekmet-balance]').textContent=String(s.tekmetBalance);
 }
 function quoteUpdate(amount){
  const quote=q('[data-tekmet-quote]');
  quote.hidden=!Number.isInteger(amount)||amount<1;
  if(amount>=1){
   q('[data-tekmet-price]').textContent=String(amount);
   quote.dataset.insufficient=String(s.tekmetBalance!=null&&amount>s.tekmetBalance);
  }
 }
 function catalogVisible(show){
  side.classList.toggle('is-open',!!show);
  side.inert=!show;
  game.dataset.catalogOpen=String(!!show);
  q('[data-hammer]').setAttribute('aria-expanded',String(!!show));
  side.setAttribute('aria-hidden',String(!show));
  if(!show&&side.contains(document.activeElement))q('[data-hammer]').focus();
 }
 function mode(next){
  s.mode=next;game.dataset.mode=next;
  const roofing=next==='roof'||next==='saving-roof';
  q('[data-placement]').hidden=next!=='placing'&&next!=='saving-place'&&!roofing;
  q('[data-nudge]').hidden=next!=='placing'||isRoofBeamId(s.type)||!editable(s);
  const drawingLine=next==='placing'&&s.previewSections.length>1;
  q('[data-rotate]').hidden=roofing||drawingLine;
  q('[data-undo]').hidden=next!=='placing'||!s.lineStart;
  q('[data-line-count]').hidden=next!=='placing'||s.previewSections.length<2;
  q('[data-tekmet-wallet]').hidden=s.tekmetBalance==null||!editable(s);
  quoteUpdate(roofing?tekmetRoofCost(s.roofValidity?.cells?.length||0):next==='placing'?tekmetSectionCost(s.type):null);
  q('[data-selection]').hidden=next!=='selected'&&next!=='saving-remove';
  const batchMode=next==='multi-remove'||next==='saving-batch-remove';
  q('[data-batch-remove]').hidden=!batchMode;
  q('[data-batch-count]').textContent=String(s.deleteIds.size);
  q('[data-batch-confirm]').disabled=next!=='multi-remove'||s.busy||!s.deleteIds.size;
  q('[data-batch-cancel]').disabled=s.busy;
  q('[data-delete-mode]').disabled=s.busy||!s.ready||s.loadFailed||!s.userId||!editable(s)||!s.sections.length;
  q('[data-delete-mode]').setAttribute('aria-pressed',String(batchMode));
  q('[data-confirm]').disabled=next!=='placing'&&next!=='roof';
  const post=baganaPrefab(s.type);
  const variantButton=q('[data-variant]');
  variantButton.hidden=!post&&approvedVariantCount(s.type)<2;
  if(isRoofBeamId(s.type)||roofing||drawingLine)variantButton.hidden=true;
  const variantLabel=post?'Сменить тип багъаны':'Сменить вариант';
  variantButton.setAttribute('aria-label',variantLabel);variantButton.title=variantLabel;
  const heightControl=q('[data-bagana-heights]');
  heightControl.hidden=!(next==='placing'||next==='saving-place')||!baganaPrefab(s.type);
  const chosen=post?.woodCells;
  heightControl.querySelector('span').textContent=post?'Багъана '+post.form+' · дерево, м:':'Дерево, м:';
  heightControl.querySelectorAll('[data-bagana-wood-cells]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.baganaWoodCells)===chosen)));
  const beamMode=isRoofBeamId(s.type)&&(next==='placing'||next==='saving-place');
  q('[data-beam-controls]').hidden=!beamMode;
  if(beamMode){
   q('[data-beam-length]').textContent=(roofBeamLength(s.type)*.25).toFixed(2).replace('.',',')+' м';
   q('[data-beam-shorter]').disabled=s.busy||roofBeamLength(s.type)<=1;
   q('[data-beam-longer]').disabled=s.busy||roofBeamLength(s.type)>=40;
  }
  q('[data-remove]').disabled=next!=='selected'||s.busy;
  for(const name of ['cancel','rotate','variant','hammer','settings']){
   const button=q(`[data-${name}]`);if(button)button.disabled=s.busy||(name==='hammer'&&(!s.ready||s.loadFailed||batchMode));
  }
  q('[data-clear]').disabled=s.busy||!s.ready||!s.userId||!editable(s)||(!s.sections.length&&!s.roofs.length);
  const note=q('[data-clear-note]');
  const reason=!s.userId?'Войдите в аккаунт':!editable(s)?'Чужую башню нельзя очищать':
   !s.ready?'Загрузка данных':!s.sections.length&&!s.roofs.length?'Построек пока нет':'';
  note.hidden=!reason;note.textContent=reason;
  if(next==='placing'||next==='saving-place'||roofing){catalogVisible(false);closeSettings();}
  s.scene?.setTool(roofing?'roof':next==='placing'||next==='saving-place'?'place':batchMode?'delete':'select');
  if(next!=='placing'&&next!=='saving-place'){
   s.scene?.setLineDraft(null,null);
   void s.scene?.setPreview(null);
  }
 }
 function beginBatchDelete(initialId=null){
  if(s.busy||!s.ready||s.loadFailed||!s.userId||!editable(s)||!s.sections.length)return;
  if(s.mode==='placing'||s.mode==='roof')cancel();
  s.selected=null;s.selectedRoofId=null;s.deleteOperation=null;
  s.deleteIds=initialId&&s.sections.some(b=>b.id===initialId)?new Set([initialId]):new Set();
  s.scene?.setSelected(null);s.scene?.setSelectedMany([...s.deleteIds]);
  catalogVisible(false);closeSettings();mode('multi-remove');
 }
 function cancelBatchDelete(){
  if(s.busy)return;
  s.deleteIds=new Set();s.deleteOperation=null;
  s.scene?.setSelectedMany([]);mode('idle');
 }
 function toggleBatchDelete(id){
  if(s.mode!=='multi-remove'||s.busy)return;
  s.deleteIds=toggleBatchSelection(s.deleteIds,id,s.sections);
  s.deleteOperation=null;
  s.scene?.setSelectedMany([...s.deleteIds]);mode('multi-remove');
 }
 async function confirmBatchDelete(){
  if(s.mode!=='multi-remove'||s.busy||!s.userId||!editable(s)||!s.deleteIds.size)return;
  const ids=[...s.deleteIds];
  const confirmed=await context.modal.confirm({
   message:'Удалить '+ids.length+' выбранных блоков?<div class="towerClearWarning">Блоки над ними останутся на месте. Уплаченные текметы вернутся.</div>',
   cancelText:'Отмена',confirmText:'Удалить ('+ids.length+')'
  });
  if(!confirmed||s.disposed||s.busy||s.mode!=='multi-remove'||!editable(s))return;
  const same=s.deleteOperation&&s.deleteOperation.revision===s.revision&&
   s.deleteOperation.ids.length===ids.length&&s.deleteOperation.ids.every((id,i)=>id===ids[i]);
  const operation=same?s.deleteOperation:{id:crypto.randomUUID(),revision:s.revision,ids};
  s.deleteOperation=operation;s.busy=true;mode('saving-batch-remove');
  try{
   const saved=await removeTowerV3Sections({revision:operation.revision,id:operation.id,sectionIds:operation.ids});
   if(s.disposed)return;
   s.sections=saved.elements;s.revision=saved.revision;balanceUpdate(saved.tekmetBalance);
   s.deleteIds=new Set();s.deleteOperation=null;s.selected=null;
   s.scene?.setSelectedMany([]);mode('idle');await redraw();
  }catch(error){
   if(s.disposed)return;
   let reconciled=false;
   try{await refreshServer();reconciled=true;}catch{}
   s.deleteIds=retainBatchSelection(new Set(ids),s.sections);
   if(reconciled)s.deleteOperation=null;
   if(reconciled&&!s.deleteIds.size){mode('idle');message('Удаление сохранено');}
   else{
    s.scene?.setSelectedMany([...s.deleteIds]);mode('multi-remove');
    message(String(error?.message||error).includes('REVISION_CONFLICT')?
     'Башня изменилась. Проверьте выделенные блоки.':'Не удалось удалить блоки. Повторите попытку.');
   }
  }finally{s.busy=false;if(!s.disposed)mode(s.mode);}
 }
 function markSelection(id){
  const chosen=s.sections.find(b=>b.id===id);
  s.selectedRoofId=null;
  s.selected=chosen?.id||null;
  s.scene?.setSelected(s.selected);
  mode(chosen&&editable(s)?'selected':'idle');
  if(chosen&&editable(s))catalogVisible(false);
 }
 function markRoofSelection(id){
  const roof=s.roofs.find(r=>r.id===id);
  s.selected=null;s.selectedRoofId=roof?.id||null;
  s.scene?.setSelected(null);
  mode(roof&&editable(s)?'selected':'idle');
  if(roof&&editable(s))catalogVisible(false);
 }
 function updateRoofDraft(){
  if(!s.roofDraft)return;
  const points=s.roofDraft.points,level=s.roofDraft.level;
  const cells=roofCoverCells(points);
  s.roofValidity=points.length&&Number.isInteger(level)?checkRoofPlacement(points,level,
   s.sections.map(b=>({...b,_roofBounds:prefabBounds(b)})),s.roofs):{ok:false,cells};
  s.scene?.setRoofDraft(points.length?s.roofDraft:null,cells);
  const price=tekmetRoofCost(cells.length);
  quoteUpdate(price);
  // Keep the confirm button actionable so invalid contours and supports can be explained.
  q('[data-confirm]').disabled=!points.length||!s.userId||s.busy;
 }
 function pickRoof(hit){
  if(!s.roofDraft||s.busy)return;
  if(Number.isInteger(hit.remove)){
   s.roofDraft.points.splice(hit.remove,1);
   if(!s.roofDraft.points.length)s.roofDraft.level=null;
  }else if(Array.isArray(hit.cell)){
   const [x,z]=hit.cell;
   const index=s.roofDraft.points.findIndex(p=>p[0]===x&&p[1]===z);
   if(index!==-1)s.roofDraft.points.splice(index,1);
   else if(s.roofDraft.points.length<64){
    if(!s.roofDraft.points.length)s.roofDraft.level=hit.level;
    s.roofDraft.points.push([x,z]);
   }
   if(!s.roofDraft.points.length)s.roofDraft.level=null;
  }
  updateRoofDraft();
 }
 function beginRoof(){
  if(s.busy||!s.ready||s.loadFailed||!editable(s))return;
  s.type='roof-cover';s.selected=null;s.selectedRoofId=null;s.roofDraft={points:[],level:null};
  s.scene?.setSelected(null);
  mode('roof');updateRoofDraft();
 }
 async function commitRoof(){
  if(s.mode!=='roof'||s.busy||!s.userId||!s.roofDraft?.points?.length)return;
  if(!s.roofValidity?.ok){
   const reason=s.roofValidity?.reason;
   message(reason==='ROOF_SUPPORT_REQUIRED'?'Выше земли для крыши необходимы опоры':
    reason==='ROOF_COLLISION'||reason==='ROOF_OVERLAP'?'Место для крыши занято':
    'Неверный контур крыши');return;
  }
  if(s.tekmetBalance==null||tekmetRoofCost(s.roofValidity.cells.length)>s.tekmetBalance){
   message('Недостаточно текметов');return;
  }
  const points=s.roofDraft.points.map(p=>[...p]),level=s.roofDraft.level;
  s.busy=true;mode('saving-roof');
  try{
   const saved=await placeTowerRoof({id:crypto.randomUUID(),points,level});
   if(s.disposed)return;
   s.roofs=saved.roofs;balanceUpdate(saved.balance);
   s.scene?.setRoofs(s.roofs);s.scene?.setRoofDraft(null);
   s.roofDraft=null;s.roofValidity=null;mode('idle');
  }catch(error){
   if(s.disposed)return;
   const reason=String(error?.message||error);
   try{const snapshot=await loadTowerRoofs();s.roofs=snapshot.roofs;balanceUpdate(snapshot.balance);s.scene?.setRoofs(s.roofs);}catch{}
   mode('roof');updateRoofDraft();
   message(reason.includes('INSUFFICIENT_TEKMET')?'Недостаточно текметов':
    reason.includes('ROOF_SUPPORT')?'Не хватает опор':
    reason.includes('ROOF_COLLISION')||reason.includes('ROOF_OVERLAP')?'Крыша пересекается с постройкой':
    'Не удалось установить крышу');
  }finally{s.busy=false;if(!s.disposed&&s.mode==='roof')updateRoofDraft();}
 }
 async function deleteRoof(){
  const id=s.selectedRoofId;
  if(!id||s.busy||!s.userId||!editable(s))return;
  s.busy=true;mode('saving-remove');
  try{
   const data=await removeTowerRoof({id:crypto.randomUUID(),roofId:id});
   if(s.disposed)return;
   s.roofs=data.roofs;balanceUpdate(data.balance);s.selectedRoofId=null;
   s.scene?.setRoofs(s.roofs);mode('idle');
  }catch(error){
   if(s.disposed)return;
   try{await refreshServer();}catch{}
   mode('idle');message('Не удалось удалить крышу');
  }finally{
   s.busy=false;if(!s.disposed)mode(s.mode);
  }
 }
 function placement(){
  if(s.mode!=='placing'&&s.mode!=='saving-place')return null;
  const hit=s.previewHit||s.scene?.getAimHit?.();
  if(!hit)return null;
  if(isRoofBeamId(s.type)){
   const item={id:'00000000-0000-4000-8000-000000000001',type:'roof_beam',sectionId:s.type,
    variant:0,rotation:s.rotation,x:0,y:0,z:0,geometryVersion:ROOF_BEAM_VERSION};
   if(!hit.block||hit.block.type!=='masonry_section')return null;
   const supportTop=prefabBounds(hit.block).max[1];
   return positionRoofBeamAgainst(item,{...hit,supportTop},s.beamShift);
  }
  const item={id:'00000000-0000-4000-8000-000000000001',type:'masonry_section',sectionId:s.type,
   variant:s.variant,rotation:s.rotation,x:0,y:0,z:0,geometryVersion:s.type===WINDOW_PREFAB_ID?WINDOW_PREFAB_VERSION:s.type===DOOR_PREFAB_ID?DOOR_PREFAB_VERSION:s.type===GATE_PREFAB_ID?GATE_PREFAB_VERSION:s.type===BAGANA_PREFAB_ID?BAGANA_PREFAB_VERSION:baganaPrefab(s.type)?BAGANA_PREFAB_VERSION_V2:APPROVED_PREFAB_VERSION};
  const candidate=positionAgainst(item,hit);
  return {...candidate,x:candidate.x+s.nudge.x,y:candidate.y+s.nudge.y,z:candidate.z+s.nudge.z};
 }
 let previewSequence=0;
 async function preview(){
  const generation=++previewSequence;
  if(s.disposed||s.mode!=='placing'||!s.scene)return;
  let candidate=placement(),sections=candidate?[candidate]:[];
  let failure=null;
  if(isApprovedMasonryType(s.type)&&s.lineStart){
   const line=planMasonryLine({first:s.lineStart,last:s.lineEnd});
   if(line.ok)sections=line.sections;
   else{sections=[];failure=line.reason;}
   candidate=sections[0]||null;
  }
  s.preview=candidate;s.previewSections=sections;
  const checked=sections.length>1?
   checkMasonryLine(s.sections,sections,s.scene.manifest,(all,manifest)=>resolvePrefabJoints(all,manifest)):
   candidate?(()=>{
    const valid=validatePrefabPlacement(blocks(),candidate);
    return !valid.ok?valid:candidate.type==='roof_beam'?{ok:true}:
     validateSectionJoints(s.sections.filter(b=>b.type==='masonry_section'),candidate,s.scene.manifest);
   })():{ok:false,reason:failure||'NO_PLACEMENT'};
  const valid=!!checked.ok;
  const unit=tekmetSectionCost(s.type);
  const price=unit==null?null:unit*sections.length;
  quoteUpdate(price);
  const count=q('[data-line-count]');
  count.hidden=sections.length<2;
  if(sections.length>1)count.textContent=sections.length+' шт.';
  const drawingLine=sections.length>1;
  q('[data-rotate]').hidden=drawingLine;
  q('[data-variant]').hidden=drawingLine||isRoofBeamId(s.type)||approvedVariantCount(s.type)<2;
  q('[data-undo]').hidden=!s.lineStart;
  // Endpoint markers follow the fully snapped line, not the raw finger position.
  s.scene?.setLineDraft(s.lineStart,s.lineEnd&&drawingLine?sections[sections.length-1]:null);
  q('[data-confirm]').disabled=!valid||!editable(s)||s.busy||
   s.tekmetBalance==null||price==null||price>s.tekmetBalance;
  q('[data-confirm]').dataset.valid=String(valid);
  await s.scene.setPreview(sections.length>1?sections:candidate,valid);
  if(generation!==previewSequence||s.disposed)return;
 }
 async function redraw(){
  if(s.disposed||!s.scene)return;
  await s.scene.setBlocks(blocks());
  s.scene.setSelected(s.selected);
  s.scene.setSelectedMany([...s.deleteIds]);
  if(s.mode==='placing')await preview();
 }
 function begin(type){
  if(type==='roof-cover'){beginRoof();return;}
  if(s.busy||!s.ready||s.loadFailed||!editable(s)||!BUILDABLE_PREFAB_TYPES.some(spec=>spec.id===type)&&!isRoofBeamId(type))return;
  s.type=type;s.variant=0;s.rotation=0;s.selected=null;s.selectedRoofId=null;s.locked=false;s.nudge={x:0,y:0,z:0};
  s.lineStart=null;s.lineEnd=null;
  s.previewSections=[];s.scene?.setLineDraft(null,null);s.beamShift=0;
  s.previewHit=s.scene?.getAimHit?.()||null;
  s.scene?.setSelected(null);
  mode('placing');void preview();
 }
 function cancel(){
  if(s.busy)return;
  if(s.roofDraft){s.roofDraft=null;s.roofValidity=null;s.scene?.setRoofDraft(null);}
  ++previewSequence;s.preview=null;s.previewSections=[];s.previewHit=null;s.selected=null;s.selectedRoofId=null;s.locked=false;s.nudge={x:0,y:0,z:0};
  s.lineStart=null;s.lineEnd=null;s.scene?.setLineDraft(null,null);
  s.scene?.setSelected(null);mode('idle');
 }
 async function refreshServer(){
  if(!s.userId){s.sections=[];s.deleteIds=new Set();s.roofs=[];s.revision=0;s.resetAt=null;balanceUpdate(null);s.scene?.setRoofs([]);await redraw();return;}
  const [snapshot,roofSnapshot]=await Promise.all([loadTowerV3(params.userId||null),loadTowerRoofs(params.userId||null)]);
  s.sections=snapshot.elements;s.deleteIds=retainBatchSelection(s.deleteIds,s.sections);s.revision=snapshot.revision;s.resetAt=snapshot.resetAt;
  s.roofs=roofSnapshot.roofs;balanceUpdate(roofSnapshot.balance);
  s.scene?.setRoofs(s.roofs);await redraw();
 }
 async function mutate(action,section=null,sectionId=null){
  if(s.busy||!s.userId||!editable(s))return;
  const placing=action==='place'||action==='place_line';
  s.busy=true;mode(placing?'saving-place':'saving-remove');
  const operationId=crypto.randomUUID();
  try{
   const data=action==='place_line'?await placeTowerLine({revision:s.revision,id:operationId,sections:section}):
    await mutateTowerV3({revision:s.revision,id:operationId,action,section,sectionId});
   s.sections=data.elements;s.revision=data.revision;balanceUpdate(data.tekmetBalance);
   s.selected=null;s.preview=null;s.previewSections=[];s.previewHit=null;s.locked=false;
   s.lineStart=null;s.lineEnd=null;
   // A successful place keeps the chosen type, variant and yaw for the next block.
   mode(placing?'placing':'idle');
   await redraw();
   if(placing&&!s.disposed&&s.scene){
    s.previewHit=s.scene.getAimHit?.()||null;
    await preview();
   }
  }catch(error){
   const reason=String(error?.message||error);
   // Network failures can occur after the server committed. Always reconcile
   // before another placement, so retries cannot duplicate sections.
   try{await refreshServer();}catch{ /* retain the original scene while offline */ }
   mode(placing?'placing':'selected');
   message(reason.includes('AUTH_')?'Необходимо войти в аккаунт':
    reason.includes('SUPPORT')?'Нельзя удалить несущую секцию':
    reason.includes('INSUFFICIENT_TEKMET')?'Недостаточно текметов':
    reason.includes('REVISION_CONFLICT')?'Башня изменилась. Выберите место снова.':
    'Не удалось сохранить башню');
   if(placing)await preview();
  }finally{s.busy=false;if(!s.disposed){mode(s.mode);if(s.mode==='placing')await preview();}}
 }
 async function clearAll(){
  if(s.busy||!s.ready||!s.userId||!editable(s))return;
  if(!s.sections.length&&!s.roofs.length)return;
  // #modalRoot stays visible because fullscreen now applies to the document.
   const confirmed=await context.modal.confirm({
    message:'Удалить всю построенную башню?<div class="towerClearWarning">Уплаченные текметы вернутся на баланс.</div>',
    cancelText:'Отмена',confirmText:'Удалить всё'
   });
  if(!confirmed||s.disposed||s.busy||!editable(s))return;
  s.busy=true;mode('saving-clear');
  try{
   const result=await clearTowerV3({revision:s.revision,id:crypto.randomUUID()});
   if(s.disposed)return;
   s.sections=result.elements;s.revision=result.revision;balanceUpdate(result.tekmetBalance);
   s.resetAt=result.resetAt;
   s.selected=null;s.preview=null;s.previewHit=null;s.locked=false;
   s.scene?.setSelected(null);s.selectedRoofId=null;s.roofs=[];s.scene?.setRoofs([]);mode('idle');await redraw();
  }catch(error){
   if(s.disposed)return;
   try{await refreshServer();}catch{}
   cancelAfterClear();
   message(String(error?.message||error).includes('REVISION_CONFLICT')
    ?'Башня изменилась. Повторите очистку.':'Не удалось очистить башню');
  }finally{ s.busy=false;if(!s.disposed)mode(s.mode); }
 }
 function cancelAfterClear(){
  ++previewSequence;s.preview=null;s.previewHit=null;s.locked=false;
  s.selected=null;s.scene?.setSelected(null);mode('idle');
 }
 on('[data-settings]','click',()=>{
  const panel=q('[data-settings-panel]'),open=panel.hidden;
  panel.hidden=!open;q('[data-settings]').setAttribute('aria-expanded',String(open));
  if(open)catalogVisible(false);
 });
 function closeSettings(){
  q('[data-settings-panel]').hidden=true;
  q('[data-settings]').setAttribute('aria-expanded','false');
 }
 on('[data-clear]','click',()=>{closeSettings();void clearAll();});
 on('[data-delete-mode]','click',()=>{if(s.mode==='multi-remove')cancelBatchDelete();else beginBatchDelete();});
 on('[data-batch-cancel]','click',cancelBatchDelete);
 on('[data-batch-confirm]','click',()=>{void confirmBatchDelete();});
 on('[data-catalog-close]','click',()=>catalogVisible(false));
 on('[data-bagana-heights]','click',event=>{
  if(s.mode!=='placing'||s.busy)return;
  const btn=event.target.closest('[data-bagana-wood-cells]');
  const current=baganaPrefab(s.type);if(!btn||!current)return;
  const cells=Number(btn.dataset.baganaWoodCells);
  if(!BAGANA_WOOD_HEIGHT_CELLS.includes(cells))return;
  s.type=baganaType(current.form,cells);mode('placing');void preview();
 });
 on('.towerCatalog','click',event=>{
  const tab=event.target.closest('[data-catalog-category]');
  if(tab){setCatalogCategory(tab.dataset.catalogCategory);return;}
  const el=event.target.closest('[data-section-id]');
  if(el&&game.dataset.explore==='true')begin(el.dataset.sectionId);
 });
 on('.towerCatalogTabs','keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=[...catalog.querySelectorAll('[data-catalog-category]')];
  const current=tabs.indexOf(event.target.closest('[data-catalog-category]'));if(current<0)return;
  event.preventDefault();
  const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:
   (current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  setCatalogCategory(tabs[next].dataset.catalogCategory);tabs[next].focus();
 });
 on('[data-hammer]','click',()=>{
  if(s.busy||!s.ready||s.loadFailed)return;
  if(s.mode==='placing')cancel();
  if(s.mode==='selected'){markSelection(null);catalogVisible(true);return;}
  closeSettings();
  catalogVisible(!side.classList.contains('is-open'));
 });
 on('[data-cancel]','click',cancel);
 on('[data-nudge]','click',event=>{
  const direction=event.target.closest('[data-nudge-direction]')?.dataset.nudgeDirection;
  if(!direction||s.mode!=='placing'||s.busy||isRoofBeamId(s.type))return;
  const normal=s.previewHit?.normal||{x:0,y:1,z:0};
  const next=nudgePrefabOnFace(s.nudge,normal,direction);
  const delta={x:next.x-s.nudge.x,y:next.y-s.nudge.y,z:next.z-s.nudge.z};
  s.nudge=next;s.locked=true;
  if(s.lineStart)s.lineStart={...s.lineStart,x:s.lineStart.x+delta.x,y:s.lineStart.y+delta.y,z:s.lineStart.z+delta.z};
  if(s.lineEnd)s.lineEnd={...s.lineEnd,x:s.lineEnd.x+delta.x,y:s.lineEnd.y+delta.y,z:s.lineEnd.z+delta.z};
  void preview();
 });
 for(const [name,delta] of [['shorter',-1],['longer',1]]){
  on('[data-beam-'+name+']','click',()=>{
   if(s.mode!=='placing'||!isRoofBeamId(s.type)||s.busy)return;
   const cells=roofBeamLength(s.type)+delta;if(cells<1||cells>40)return;
   s.type=roofBeamId(cells);mode('placing');void preview();
  });
 }
 for(const [name,delta] of [['back',-1],['forward',1]]){
  on('[data-beam-'+name+']','click',()=>{
   if(s.mode!=='placing'||!isRoofBeamId(s.type)||s.busy)return;
   s.beamShift+=delta;void preview();
  });
 }
 on('[data-rotate]','click',()=>{if(s.mode!=='placing'||s.lineEnd)return;
  s.rotation=(s.rotation+1)%4;
  if(s.lineStart)s.lineStart={...s.lineStart,rotation:s.rotation};void preview();});
 on('[data-variant]','click',()=>{if(s.mode!=='placing'||s.lineEnd)return;
  if(baganaPrefab(s.type)){
   s.type=nextBaganaType(s.type);
   mode('placing');void preview();return;
  }
  const count=approvedVariantCount(s.type)||1;
  s.variant=(s.variant+1)%count;if(s.lineStart)s.lineStart={...s.lineStart,variant:s.variant};void preview();
 });
 on('[data-undo]','click',()=>{
  if(s.mode!=='placing'||s.busy||!s.lineStart)return;
  const releasingFirst=!s.lineEnd;
  const next=undoMasonryEndpoint(s.lineStart,s.lineEnd);
  s.lineStart=next.first;s.lineEnd=next.last;
  if(releasingFirst){s.locked=false;s.previewHit=s.scene?.getAimHit?.()||null;}
  void preview();
 });
 on('[data-confirm]','click',()=>{
  if(s.mode==='roof'){void commitRoof();return;}
  if(s.mode!=='placing'||!s.preview||q('[data-confirm]').disabled)return;
  if(!s.userId){message('Для сохранения башни необходимо войти в аккаунт');return;}
  const sections=s.previewSections.map(item=>({...item,id:crypto.randomUUID()}));
  if(sections.length>1){
   const checked=checkMasonryLine(s.sections,sections,s.scene.manifest,(all,manifest)=>resolvePrefabJoints(all,manifest));
   if(!checked.ok){message(checked.reason||'Линию нельзя установить');return;}
   void mutate('place_line',sections,null);return;
  }
  const section=sections[0];
  if(!section||!validatePrefabPlacement(blocks(),section).ok||(section.type!=='roof_beam'&&!validateSectionJoints(s.sections.filter(b=>b.type==='masonry_section'),section,s.scene.manifest).ok))return;
  void mutate('place',section,null);
 });
 on('[data-remove]','click',()=>{
  if(s.mode!=='selected')return;
  if(s.selectedRoofId){void deleteRoof();return;}
  if(s.selected)beginBatchDelete(s.selected);
 });
 function walkUi(active){
  game.dataset.explore=String(active);
  catalogVisible(false);closeSettings();
 }
 on('[data-home]','click',()=>{
  if(!s.scene||s.busy)return;
  if(s.mode==='placing'||s.mode==='roof')cancel();
  if(s.mode==='multi-remove')cancelBatchDelete();
  s.scene.home();walkUi(true);
 });
 on('[data-retry]','click',async()=>{
  if(s.disposed||!s.scene||s.busy)return;
  q('[data-retry]').hidden=true;
  q('[data-load-status]').dataset.error='false';
  q('[data-load-text]').textContent='Повторная загрузка построек…';
  try{
   await refreshServer();
   s.loadFailed=false;
   q('[data-load-status]').hidden=true;
  }catch(error){
   s.loadFailed=true;
   q('[data-load-status]').dataset.error='true';
   q('[data-load-text]').textContent='Не удалось загрузить сохранённую башню';
   q('[data-retry]').hidden=false;
   console.warn('Saved tower retry failed:',error);
  }finally{if(!s.disposed)mode(s.mode);}
 });
 window.addEventListener('keydown',e=>{
  if(s.disposed||s.busy||document.body.classList.contains('modal-open')||e.target?.closest?.('input,textarea,select,[contenteditable]')||e.ctrlKey||e.metaKey)return;
  if(e.key==='Escape'){closeSettings();catalogVisible(false);if(s.mode==='multi-remove')cancelBatchDelete();else cancel();return;}
  if(e.key.toLowerCase()==='r'&&s.mode==='placing'){s.rotation=(s.rotation+1)%4;void preview();}
 },{signal:controller.signal});
 try{
  s.scene=await createTowerScene(q('.towerCanvas'),{
   onPrefabError(){message('Не удалось загрузить модель. Повтори попытку.');},
   onPick(hit){
    if(s.mode==='roof'){pickRoof(hit);return;}
    if(s.mode!=='placing')return;
    s.previewHit=hit;s.locked=true;s.nudge={x:0,y:0,z:0};
    if(isApprovedMasonryType(s.type)){
     const picked=placement();
     if(!s.lineStart){
      s.lineStart=picked;s.lineEnd=null;
      if(picked&&!s.lineTipShown){message('Перетащи зелёную точку, чтобы изменить начало линии');s.lineTipShown=true;}
     }
     else if(picked)s.lineEnd=(picked.x===s.lineStart.x&&picked.z===s.lineStart.z)?null:picked;
    }
    void preview();
   },
   onEndpointMove(index,position){
    if(s.mode!=='placing'||s.busy||!isApprovedMasonryType(s.type))return;
    if(index===1&&!s.lineEnd)return;
    const next=editMasonryEndpoint(s.lineStart,s.lineEnd,index,position);
    s.lineStart=next.first;s.lineEnd=next.last;
    void preview();
   },
   onSelection(id){if(s.mode==='multi-remove')toggleBatchDelete(id);else if(s.mode==='idle'||s.mode==='selected')markSelection(id);},
   onRoofSelection(id){if(s.mode==='idle'||s.mode==='selected')markRoofSelection(id);},
   onCameraChange(camera){if(s.mode!=='placing'||s.locked)return;
    const hit=camera.hit||{position:camera.target,normal:{x:0,y:1,z:0}};
    const last=s.previewHit;
    if(last&&last.block?.id===hit.block?.id&&last.position.every((v,i)=>Math.abs(v-hit.position[i])<.04))return;
    s.previewHit=hit;void preview();}
  });
  if(s.disposed){s.scene.dispose();return;}
  mode('idle');
  walkUi(true);
  q('[data-load-text]').textContent='Загрузка сохранённых построек…';
  try{
   await refreshServer();
   q('[data-load-status]').hidden=true;
  }catch(error){
   s.loadFailed=true;
   q('[data-load-status]').dataset.error='true';
   q('[data-load-text]').textContent='Не удалось загрузить сохранённую башню';
   q('[data-retry]').hidden=false;
   message('Проверь соединение и повтори загрузку');
   console.warn('Saved tower unavailable; preventing edits:',error);
  }
  if(params.userId&&!editable(s))catalogVisible(false);
  s.ready=true;mode(s.mode);
 }catch(error){
  q('[data-load-status]').dataset.error='true';
  q('[data-load-text]').textContent='Не удалось запустить 3D-сцену. Перезагрузи игру.';
  message('Не удалось загрузить 3D-сцену');console.error(error);
 }
}
export function canLeave(){return active?.canLeave?.()??true;}
export function unmount(){
 if(!active)return;active.disposed=true;active.controller.abort();active.cleanupOrientation?.();active.scene?.dispose();
 if(active.context.shell.appShell.dataset.feature==='tower')active.context.shell.appShell.dataset.feature='practice';
 active=null;
}