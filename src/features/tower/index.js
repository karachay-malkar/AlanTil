/** AlanTil tower: server-authoritative approved prefab construction only. */
import {createTowerScene} from './prefab-scene.js?v=17.2.49';
import {BUILDABLE_PREFAB_TYPES,positionAgainst,validatePrefabPlacement} from '../../../packages/tower-game/prefab-layout.mjs';
import {ROOF_BEAM_VERSION,roofBeamId,roofBeamLength,isRoofBeamId,positionRoofBeamAgainst} from '../../../packages/tower-game/roof-beam.mjs';
import {roofCoverCells,checkRoofPlacement,ROOF_PRICE_PER_CELL} from '../../../packages/tower-game/roof-cover.mjs';
import {prefabBounds} from '../../../packages/tower-game/prefab-layout.mjs';
import {WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION} from '../../../packages/tower-game/window-prefab.mjs';
import {DOOR_PREFAB_ID,DOOR_PREFAB_VERSION} from '../../../packages/tower-game/door-prefab.mjs';
import {GATE_PREFAB_ID,GATE_PREFAB_VERSION} from '../../../packages/tower-game/gate-prefab.mjs';
import {BAGANA_PREFAB_ID,BAGANA_PREFAB_VERSION,BAGANA_PREFAB_VERSION_V2,BAGANA_WOOD_HEIGHT_CELLS,baganaPrefab,baganaType,nextBaganaType,isBaganaPrefab} from '../../../packages/tower-game/bagana-prefab.mjs';
import {APPROVED_PREFAB_VERSION,approvedVariantCount,isApprovedMasonryType} from '../../../packages/tower-game/approved-prefab.mjs';
import {validateSectionJoints} from '../../../packages/tower-game/prefab-joints.mjs';
import {towerUserId,loadTowerV3,mutateTowerV3,clearTowerV3,loadTowerRoofs,placeTowerRoof} from './repository.js?v=17.2-roof-cover.1';
import {uiIcon} from '../../shared/ui/icons.js?v=17.2.47';
let active=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const editable=(s)=>!s.params?.userId||s.params.userId===s.userId;
const TOWER_ICONS={confirm:'check',cancel:'x',rotate:'rotateCw',variant:'layers',remove:'eraser',hammer:'hammer',clear:'trash2'};
const icon=(name,label)=>`<button type="button" class="btn towerIconAction" data-${name} aria-label="${label}" title="${label}">${uiIcon(TOWER_ICONS[name])}</button>`;
export async function mount(context,params={}){
 const controller=new AbortController();
 const s={context,params,controller,disposed:false,userId:towerUserId(),scene:null,mode:'idle',
  sections:[],revision:0,resetAt:null,selected:null,loadFailed:false,type:BUILDABLE_PREFAB_TYPES[0].id,variant:0,rotation:0,
  preview:null,previewHit:null,locked:false,beamShift:0,busy:false,ready:false,canLeave:()=>true,
  roofs:[],roofBalance:0,roofDraft:null,roofValidity:null};
 active=s;
 context.shell.setHeaderContent?.({title:'Къала · Башня'});
 context.shell.appShell.dataset.feature='tower';
 const root=context.root;
 root.innerHTML=`<section class="view towerView"><div class="towerGame" data-mode="idle">
  <div class="towerStage"><div class="towerCanvas" role="application" aria-label="Каменная башня"></div></div>
  <div class="towerCamera" role="group" aria-label="Камера">
   <button type="button" class="btn towerIconAction towerWorldAction" data-world disabled aria-pressed="false" aria-label="Обзор Кюнлюма" title="Обзор Кюнлюма">${uiIcon('route')}</button>
  </div>
  <div class="towerQuickActions" role="group" aria-label="Экран и настройки">
   <button type="button" class="btn towerIconAction towerOrientationAction" data-orientation aria-label="Горизонтальный экран" title="Горизонтальный экран">${uiIcon('deviceLandscape')}</button>
   <button type="button" class="btn towerIconAction" data-settings aria-expanded="false" aria-controls="tower-settings-panel" aria-label="Настройки башни" title="Настройки башни">${uiIcon('settings')}</button>
  </div>
  <div class="towerSettingsMenu" id="tower-settings-panel" data-settings-panel hidden>
   <button type="button" class="btn towerIconAction" data-clear aria-label="Очистить всю башню" title="Очистить всю башню">${uiIcon('trash2')}</button><span>Очистить башню</span>
  </div>
  <div class="towerExploreControls" role="group" aria-label="Перемещение от первого лица">
   <div class="towerExploreHint">Проведи пальцем справа, чтобы осмотреться</div>
   <div class="towerJoystick" data-joystick role="application" aria-label="Джойстик движения">
    <div class="towerJoystickPuck" data-joystick-puck></div>
   </div>
   <div class="towerElevationControls" role="group" aria-label="Плавный подъём и спуск">
    <button type="button" class="btn towerIconAction" data-rise aria-label="Подняться" title="Подняться">${uiIcon('arrowUp')}</button>
    <button type="button" class="btn towerIconAction" data-fall aria-label="Спуститься" title="Спуститься">${uiIcon('arrowDown')}</button>
   </div>
  </div>
  <div class="towerBaganaHeights" data-bagana-heights hidden role="group" aria-label="Высота деревянной багъаны">
   <span>Дерево, м:</span>
   ${BAGANA_WOOD_HEIGHT_CELLS.map(c=>`<button type="button" class="btn" data-bagana-wood-cells="${c}" aria-pressed="false">${(c*.25).toFixed(2)}</button>`).join('')}
  </div>
  <div class="towerBeamControls" data-beam-controls hidden role="group" aria-label="Длина и смещение балки">
   <span>Длина <output data-beam-length>4,00 м</output></span>
   <button type="button" class="btn" data-beam-shorter aria-label="Укоротить на 25 см" title="Укоротить на 25 см">${uiIcon('arrowDown')}</button>
   <button type="button" class="btn" data-beam-longer aria-label="Удлинить на 25 см" title="Удлинить на 25 см">${uiIcon('arrowUp')}</button>
   <span>Сдвиг</span>
   <button type="button" class="btn" data-beam-back aria-label="Сдвинуть назад на 25 см" title="Сдвинуть назад на 25 см">${uiIcon('arrowLeft')}</button>
   <button type="button" class="btn" data-beam-forward aria-label="Сдвинуть вперёд на 25 см" title="Сдвинуть вперёд на 25 см">${uiIcon('route')}</button>
  </div>
  <div class="towerPlacementBar" data-placement hidden role="toolbar" aria-label="Установка секции">
   <div class="towerRoofPrice" data-roof-price hidden aria-live="polite">${uiIcon('circleDot')} <output data-roof-amount>0</output></div>
   ${icon('confirm','Установить')}${icon('cancel','Отменить')}${icon('rotate','Повернуть на 90°')}${icon('variant','Сменить вариант')}
  </div>
  <div class="towerSelectionBar" data-selection hidden role="toolbar" aria-label="Выделенная секция">
   ${icon('remove','Удалить выбранную секцию')}
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
   if(gesture&&!document.fullscreenElement&&game.requestFullscreen){
    await game.requestFullscreen();fullscreenByTower=true;
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
  return `<button type="button" class="btn towerItem" data-section-id="${spec.id}" aria-label="${title}" title="${title}"><span class="towerItemIcon" aria-hidden="true">${uiIcon(symbol)}</span><span class="towerItemName">${title}</span></button>`;
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
 let toastTimer=null,hintTimer=null;
 const hint=q('.towerExploreHint');
 try{
  if(sessionStorage.getItem('alantil:tower-hint-shown'))hint.hidden=true;
  else {
   sessionStorage.setItem('alantil:tower-hint-shown','1');
   hintTimer=setTimeout(()=>{if(!s.disposed)hint.hidden=true;},3800);
  }
 }catch{
  hintTimer=setTimeout(()=>{if(!s.disposed)hint.hidden=true;},3800);
 }
 s.cleanupHint=()=>clearTimeout(hintTimer);
 function message(text){
  if(s.disposed)return;
  const el=q('[data-toast]');el.textContent=text;el.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{if(!s.disposed)el.hidden=true;},3200);
 }
 function blocks(){return s.sections;}
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
  q('[data-roof-price]').hidden=!roofing||!s.roofDraft?.points.length;
  q('[data-rotate]').hidden=roofing;
  q('[data-selection]').hidden=next!=='selected'&&next!=='saving-remove';
  q('[data-confirm]').disabled=next!=='placing'&&next!=='roof';
  const post=baganaPrefab(s.type);
  const variantButton=q('[data-variant]');
  variantButton.hidden=!post&&approvedVariantCount(s.type)<2;
  if(isRoofBeamId(s.type)||roofing)variantButton.hidden=true;
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
  for(const name of ['cancel','rotate','variant','hammer','world','settings']){
   const button=q(`[data-${name}]`);if(button)button.disabled=s.busy||(name==='hammer'&&(!s.ready||s.loadFailed));
  }
  q('[data-clear]').disabled=s.busy||!s.ready||!s.userId||!editable(s);
  if(next==='placing'||next==='saving-place'||roofing)catalogVisible(false);
  s.scene?.setTool(roofing?'roof':next==='placing'||next==='saving-place'?'place':'select');
  if(next!=='placing'&&next!=='saving-place')void s.scene?.setPreview(null);
 }
 function markSelection(id){
  const chosen=s.sections.find(b=>b.id===id);
  s.selected=chosen?.id||null;
  s.scene?.setSelected(s.selected);
  mode(chosen&&editable(s)?'selected':'idle');
  if(chosen&&editable(s))catalogVisible(false);
 }
 function updateRoofDraft(){
  if(!s.roofDraft)return;
  const points=s.roofDraft.points,level=s.roofDraft.level;
  const cells=roofCoverCells(points);
  s.roofValidity=points.length&&Number.isInteger(level)?checkRoofPlacement(points,level,
   s.sections.map(b=>({...b,_roofBounds:prefabBounds(b)})),s.roofs):{ok:false,cells};
  s.scene?.setRoofDraft(points.length?s.roofDraft:null,cells);
  q('[data-roof-price]').hidden=!points.length;
  q('[data-roof-amount]').textContent=String(cells.length*ROOF_PRICE_PER_CELL);
  q('[data-confirm]').disabled=!s.roofValidity.ok||!s.userId||s.busy||
   cells.length*ROOF_PRICE_PER_CELL>s.roofBalance;
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
  s.type='roof-cover';s.selected=null;s.roofDraft={points:[],level:null};
  s.scene?.setSelected(null);
  mode('roof');updateRoofDraft();
 }
 async function commitRoof(){
  if(s.mode!=='roof'||s.busy||!s.userId||!s.roofValidity?.ok)return;
  const points=s.roofDraft.points.map(p=>[...p]),level=s.roofDraft.level;
  s.busy=true;mode('saving-roof');
  try{
   const saved=await placeTowerRoof({id:crypto.randomUUID(),points,level});
   if(s.disposed)return;
   s.roofs=saved.roofs;s.roofBalance=saved.balance;
   s.scene?.setRoofs(s.roofs);s.scene?.setRoofDraft(null);
   s.roofDraft=null;s.roofValidity=null;mode('idle');
  }catch(error){
   if(s.disposed)return;
   const reason=String(error?.message||error);
   try{const snapshot=await loadTowerRoofs();s.roofs=snapshot.roofs;s.roofBalance=snapshot.balance;s.scene?.setRoofs(s.roofs);}catch{}
   mode('roof');updateRoofDraft();
   message(reason.includes('INSUFFICIENT_COINS')?'Недостаточно монет':
    reason.includes('ROOF_SUPPORT')?'Не хватает опор':
    reason.includes('ROOF_COLLISION')||reason.includes('ROOF_OVERLAP')?'Крыша пересекается с постройкой':
    'Не удалось установить крышу');
  }finally{s.busy=false;if(!s.disposed&&s.mode==='roof')updateRoofDraft();}
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
  return positionAgainst(item,hit);
 }
 let previewSequence=0;
 async function preview(){
  const generation=++previewSequence;
  if(s.disposed||s.mode!=='placing'||!s.scene)return;
  const candidate=placement();s.preview=candidate;
  const placing=candidate&&validatePrefabPlacement(blocks(),candidate);
  const joints=placing?.ok?(candidate.type==='roof_beam'?{ok:true}:validateSectionJoints(s.sections.filter(b=>b.type==='masonry_section'),candidate,s.scene.manifest)):{ok:false};
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
  if(type==='roof-cover'){beginRoof();return;}
  if(s.busy||!s.ready||s.loadFailed||!editable(s)||!BUILDABLE_PREFAB_TYPES.some(spec=>spec.id===type)&&!isRoofBeamId(type))return;
  s.type=type;s.variant=0;s.rotation=0;s.selected=null;s.locked=false;s.beamShift=0;
  s.previewHit=s.scene?.getAimHit?.()||null;
  s.scene?.setSelected(null);
  mode('placing');void preview();
 }
 function cancel(){
  if(s.busy)return;
  if(s.roofDraft){s.roofDraft=null;s.roofValidity=null;s.scene?.setRoofDraft(null);}
  ++previewSequence;s.preview=null;s.previewHit=null;s.selected=null;s.locked=false;
  s.scene?.setSelected(null);mode('idle');
 }
 async function refreshServer(){
  if(!s.userId){s.sections=[];s.roofs=[];s.revision=0;s.resetAt=null;s.scene?.setRoofs([]);await redraw();return;}
  const [snapshot,roofSnapshot]=await Promise.all([loadTowerV3(params.userId||null),loadTowerRoofs(params.userId||null)]);
  s.sections=snapshot.elements;s.revision=snapshot.revision;s.resetAt=snapshot.resetAt;
  s.roofs=roofSnapshot.roofs;s.roofBalance=roofSnapshot.balance;
  s.scene?.setRoofs(s.roofs);await redraw();
 }
 async function mutate(action,section=null,sectionId=null){
  if(s.busy||!s.userId||!editable(s))return;
  s.busy=true;mode(action==='place'?'saving-place':'saving-remove');
  const operationId=crypto.randomUUID();
  try{
   const data=await mutateTowerV3({revision:s.revision,id:operationId,action,section,sectionId});
   s.sections=data.elements;s.revision=data.revision;
   s.selected=null;s.preview=null;s.previewHit=null;s.locked=false;
   // A successful place keeps the chosen type, variant and yaw for the next block.
   mode(action==='place'?'placing':'idle');
   await redraw();
   if(action==='place'&&!s.disposed&&s.scene){
    s.previewHit=s.scene.getAimHit?.()||null;
    await preview();
   }
  }catch(error){
   const reason=String(error?.message||error);
   // Network failures can occur after the server committed. Always reconcile
   // before another placement, so retries cannot duplicate sections.
   try{await refreshServer();}catch{ /* retain the original scene while offline */ }
   mode(action==='place'?'placing':'selected');
   message(reason.includes('AUTH_')?'Необходимо войти в аккаунт':
    reason.includes('SUPPORT')?'Нельзя удалить несущую секцию':
    reason.includes('REVISION_CONFLICT')?'Башня изменилась. Выберите место снова.':
    'Не удалось сохранить башню');
   if(action==='place')await preview();
  }finally{s.busy=false;if(!s.disposed){mode(s.mode);if(s.mode==='placing')await preview();}}
 }
 async function clearAll(){
  if(s.busy||!s.ready||!s.userId||!editable(s))return;
  if(!s.sections.length&&!s.roofs.length)return;
  const confirmed=await context.modal.confirm({
   message:'Удалить всю построенную башню?<div class="towerClearWarning">Все установленные элементы будут безвозвратно удалены.</div>'
  });
  if(!confirmed||s.disposed||s.busy||!editable(s))return;
  s.busy=true;mode('saving-clear');
  try{
   const result=await clearTowerV3({revision:s.revision,id:crypto.randomUUID()});
   if(s.disposed)return;
   s.sections=result.elements;s.revision=result.revision;
   s.resetAt=result.resetAt;
   s.selected=null;s.preview=null;s.previewHit=null;s.locked=false;
   s.scene?.setSelected(null);s.roofs=[];s.scene?.setRoofs([]);mode('idle');await redraw();
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
 on('[data-rotate]','click',()=>{if(s.mode!=='placing')return;s.rotation=(s.rotation+1)%4;void preview();});
 on('[data-variant]','click',()=>{if(s.mode!=='placing')return;
  if(baganaPrefab(s.type)){
   s.type=nextBaganaType(s.type);
   mode('placing');void preview();return;
  }
  const count=approvedVariantCount(s.type)||1;
  s.variant=(s.variant+1)%count;void preview();
 });
 on('[data-confirm]','click',()=>{
  if(s.mode==='roof'){void commitRoof();return;}
  if(s.mode!=='placing'||!s.preview||q('[data-confirm]').disabled)return;
  if(!s.userId){message('Для сохранения башни необходимо войти в аккаунт');return;}
  const section={...s.preview,id:crypto.randomUUID()};
  if(!validatePrefabPlacement(blocks(),section).ok||(section.type!=='roof_beam'&&!validateSectionJoints(s.sections.filter(b=>b.type==='masonry_section'),section,s.scene.manifest).ok))return;
  void mutate('place',section,null);
 });
 on('[data-remove]','click',()=>{
  if(s.mode!=='selected'||!s.selected)return;
  const id=s.selected,remaining=s.sections.filter(b=>b.id!==id);
  if(remaining.some((b,i)=>b.type!=='roof_beam'&&!validatePrefabPlacement(remaining.filter((_,j)=>j!==i),b).ok)){
   message('Нельзя удалить опору для верхних секций');return;
  }
  void mutate('remove',null,id);
 });
 let joystick={forward:0,strafe:0},altitude=0;
 function sendMotion(){s.scene?.setMotion({forward:joystick.forward,strafe:joystick.strafe,up:altitude});}
 function walkUi(active){
  game.dataset.explore=String(active);
  const b=q('button[data-explore]');b?.setAttribute('aria-pressed',String(active));
  const span=b?.querySelector('span');if(span)span.textContent=active?'К строительству':'Прогулка';
  joystick={forward:0,strafe:0};altitude=0;sendMotion();
  catalogVisible(false);closeSettings();
 }
 on('[data-world]','click',()=>{
  if(s.busy||!s.scene)return;
  if(s.mode==='placing')cancel();
  else if(s.mode==='selected')markSelection(null);
  const wide=s.scene.worldView();
  walkUi(!wide);
  const button=q('[data-world]');
  button.setAttribute('aria-pressed',String(!!wide));
  button.setAttribute('aria-label',wide?'К строительству от первого лица':'Обзор Кюнлюма');
  button.title=wide?'К строительству от первого лица':'Обзор Кюнлюма';
  button.innerHTML=uiIcon(wide?'userRound':'route');
 });
 let stickPointer=null;
 function stickMove(event){
  if(stickPointer!==event.pointerId)return;
  const b=q('[data-joystick]').getBoundingClientRect(),r=b.width*.34;
  const dx=(event.clientX-b.left-b.width/2)/r;
  const dy=(event.clientY-b.top-b.height/2)/r;
  const scale=Math.max(1,Math.hypot(dx,dy));
  joystick={strafe:dx/scale,forward:-dy/scale};
  q('[data-joystick-puck]').style.transform=`translate(${Math.round(joystick.strafe*r)}px,${Math.round(-joystick.forward*r)}px)`;
  sendMotion();
 }
 function stickEnd(event){
  if(stickPointer!==event.pointerId)return;
  stickPointer=null;joystick={strafe:0,forward:0};
  q('[data-joystick-puck]').style.transform='';
  sendMotion();
 }
 on('[data-joystick]','pointerdown',event=>{
  if(game.dataset.explore!=='true'||stickPointer!==null)return;
  stickPointer=event.pointerId;
  q('[data-joystick]').setPointerCapture(event.pointerId);stickMove(event);
 });
 for(const name of ['pointermove','pointerup','pointercancel','lostpointercapture']){
  on('[data-joystick]',name,name==='pointermove'?stickMove:stickEnd);
 }
 for(const [selector,value] of [['[data-rise]',1],['[data-fall]',-1]]){
  const button=q(selector);let pointer=null;
  on(selector,'pointerdown',event=>{
   if(game.dataset.explore!=='true')return;
   pointer=event.pointerId;button.setPointerCapture(pointer);
   altitude=value;sendMotion();
  });
  const end=event=>{if(pointer!==event.pointerId)return;pointer=null;altitude=0;sendMotion();};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])on(selector,type,end);
 }
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
  if(e.key==='Escape'){closeSettings();catalogVisible(false);cancel();return;}
  if(e.key.toLowerCase()==='r'&&s.mode==='placing'){s.rotation=(s.rotation+1)%4;void preview();}
 },{signal:controller.signal});
 try{
  s.scene=await createTowerScene(q('.towerCanvas'),{
   onPick(hit){if(s.mode==='roof'){pickRoof(hit);return;}if(s.mode!=='placing')return;s.previewHit=hit;s.locked=true;void preview();},
   onSelection(id){if(s.mode==='idle'||s.mode==='selected')markSelection(id);},
   onCameraChange(camera){if(s.mode!=='placing'||s.locked)return;
    const hit=camera.hit||{position:camera.target,normal:{x:0,y:1,z:0}};
    const last=s.previewHit;
    if(last&&last.block?.id===hit.block?.id&&last.position.every((v,i)=>Math.abs(v-hit.position[i])<.04))return;
    s.previewHit=hit;void preview();}
  });
  if(s.disposed){s.scene.dispose();return;}
  q('[data-world]').disabled=false;
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
 if(!active)return;active.disposed=true;active.controller.abort();active.cleanupOrientation?.();active.cleanupHint?.();active.scene?.dispose();
 if(active.context.shell.appShell.dataset.feature==='tower')active.context.shell.appShell.dataset.feature='practice';
 active=null;
}