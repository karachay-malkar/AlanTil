/** AlanTil tower: server-authoritative approved prefab construction only. */
import {createTowerScene} from './prefab-scene.js?v=17.2.33';
import {BUILDABLE_PREFAB_TYPES,positionAgainst,validatePrefabPlacement} from '../../../packages/tower-game/prefab-layout.mjs';
import {WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION} from '../../../packages/tower-game/window-prefab.mjs';
import {DOOR_PREFAB_ID,DOOR_PREFAB_VERSION} from '../../../packages/tower-game/door-prefab.mjs';
import {GATE_PREFAB_ID,GATE_PREFAB_VERSION} from '../../../packages/tower-game/gate-prefab.mjs';
import {APPROVED_PREFAB_VERSION,approvedVariantCount} from '../../../packages/tower-game/approved-prefab.mjs';
import {validateSectionJoints} from '../../../packages/tower-game/prefab-joints.mjs';
import {towerUserId,loadTowerV3,mutateTowerV3,clearTowerV3} from './repository.js?v=17.7-approved-only.1';
import {uiIcon} from '../../shared/ui/icons.js?v=17.2.29';
let active=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const editable=(s)=>!s.params?.userId||s.params.userId===s.userId;
const TOWER_ICONS={confirm:'check',cancel:'x',rotate:'rotateCw',variant:'layers',remove:'eraser',hammer:'hammer',clear:'trash2'};
const icon=(name,label)=>`<button type="button" class="btn towerIconAction" data-${name} aria-label="${label}" title="${label}">${uiIcon(TOWER_ICONS[name])}</button>`;
export async function mount(context,params={}){
 const controller=new AbortController();
 const s={context,params,controller,disposed:false,userId:towerUserId(),scene:null,mode:'idle',
  sections:[],revision:0,resetAt:null,selected:null,loadFailed:false,type:BUILDABLE_PREFAB_TYPES[0].id,variant:0,rotation:0,
  preview:null,previewHit:null,locked:false,busy:false,ready:false,canLeave:()=>true};
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
  <div class="towerPlacementBar" data-placement hidden role="toolbar" aria-label="Установка секции">
   ${icon('confirm','Установить')}${icon('cancel','Отменить')}${icon('rotate','Повернуть на 90°')}${icon('variant','Сменить вариант')}
  </div>
  <div class="towerSelectionBar" data-selection hidden role="toolbar" aria-label="Выделенная секция">
   ${icon('remove','Удалить выбранную секцию')}
  </div>
  <aside class="towerSide" data-side aria-label="Каталог секций">
   <div class="towerCatalogHeading">Каталог секций <button type="button" class="btn towerCatalogClose" data-catalog-close aria-label="Закрыть каталог" title="Закрыть каталог">${uiIcon('x')}</button></div>
   <div class="towerCatalogContent" data-catalog-body><div class="towerCatalog" role="group" aria-label="Каталог каменных секций"></div></div>
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
 catalog.innerHTML=BUILDABLE_PREFAB_TYPES.map(spec=>{
  const opening=spec.id===WINDOW_PREFAB_ID?'Окно':spec.id===DOOR_PREFAB_ID?'Дверь':spec.id===GATE_PREFAB_ID?'Ворота':null;
  const label=opening||spec.id.replaceAll('x','×');
  const symbol=spec.id===WINDOW_PREFAB_ID?'appWindow':spec.id===DOOR_PREFAB_ID?'doorClosed':spec.id===GATE_PREFAB_ID?'gate':'blocks';
  return `<button type="button" class="btn towerItem" data-section-id="${spec.id}" aria-label="${opening||'Секция '+label}" title="${opening||'Секция '+label}"><span class="towerItemIcon" aria-hidden="true">${uiIcon(symbol)}</span><span class="towerItemName">${label}</span></button>`;
 }).join('');
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
  q('[data-placement]').hidden=next!=='placing'&&next!=='saving-place';
  q('[data-selection]').hidden=next!=='selected'&&next!=='saving-remove';
  q('[data-confirm]').disabled=next!=='placing';
  q('[data-variant]').hidden=approvedVariantCount(s.type)<2;
  q('[data-remove]').disabled=next!=='selected'||s.busy;
  for(const name of ['cancel','rotate','variant','hammer','world','settings']){
   const button=q(`[data-${name}]`);if(button)button.disabled=s.busy||(name==='hammer'&&(!s.ready||s.loadFailed));
  }
  q('[data-clear]').disabled=s.busy||!s.ready||!s.userId||!editable(s);
  if(next==='placing'||next==='saving-place')catalogVisible(false);
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
   variant:s.variant,rotation:s.rotation,x:0,y:0,z:0,geometryVersion:s.type===WINDOW_PREFAB_ID?WINDOW_PREFAB_VERSION:s.type===DOOR_PREFAB_ID?DOOR_PREFAB_VERSION:s.type===GATE_PREFAB_ID?GATE_PREFAB_VERSION:APPROVED_PREFAB_VERSION};
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
  if(s.busy||!s.ready||s.loadFailed||!editable(s)||!BUILDABLE_PREFAB_TYPES.some(spec=>spec.id===type))return;
  s.type=type;s.variant=0;s.rotation=0;s.selected=null;s.locked=false;
  s.previewHit=s.scene?.getAimHit?.()||null;
  s.scene?.setSelected(null);
  mode('placing');void preview();
 }
 function cancel(){
  if(s.busy)return;
  ++previewSequence;s.preview=null;s.previewHit=null;s.selected=null;s.locked=false;
  s.scene?.setSelected(null);mode('idle');
 }
 async function refreshServer(){
  if(!s.userId){s.sections=[];s.revision=0;s.resetAt=null;await redraw();return;}
  const snapshot=await loadTowerV3(params.userId||null);
  s.sections=snapshot.elements;s.revision=snapshot.revision;s.resetAt=snapshot.resetAt;
  await redraw();
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
  if(!s.sections.length)return;
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
   s.scene?.setSelected(null);mode('idle');await redraw();
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
 on('.towerCatalog','click',event=>{
  const el=event.target.closest('[data-section-id]');if(el&&game.dataset.explore==='true')begin(el.dataset.sectionId);
 });
 on('[data-hammer]','click',()=>{
  if(s.busy||!s.ready||s.loadFailed)return;
  if(s.mode==='placing')cancel();
  if(s.mode==='selected'){markSelection(null);catalogVisible(true);return;}
  closeSettings();
  catalogVisible(!side.classList.contains('is-open'));
 });
 on('[data-cancel]','click',cancel);
 on('[data-rotate]','click',()=>{if(s.mode!=='placing')return;s.rotation=(s.rotation+1)%4;void preview();});
 on('[data-variant]','click',()=>{if(s.mode!=='placing')return;
  const count=approvedVariantCount(s.type)||1;
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
  if(remaining.some((b,i)=>!validatePrefabPlacement(remaining.filter((_,j)=>j!==i),b).ok)){
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
   onPick(hit){if(s.mode!=='placing')return;s.previewHit=hit;s.locked=true;void preview();},
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