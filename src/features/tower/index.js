/** AlanTil tower: server-authoritative approved prefab construction only. */
import {createTowerScene} from './prefab-scene.js?v=17.2.15';
import {BUILDABLE_PREFAB_TYPES,positionAgainst,validatePrefabPlacement} from '../../../packages/tower-game/prefab-layout.mjs';
import {WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION} from '../../../packages/tower-game/window-prefab.mjs';
import {DOOR_PREFAB_ID,DOOR_PREFAB_VERSION} from '../../../packages/tower-game/door-prefab.mjs';
import {GATE_PREFAB_ID,GATE_PREFAB_VERSION} from '../../../packages/tower-game/gate-prefab.mjs';
import {APPROVED_PREFAB_VERSION,approvedVariantCount} from '../../../packages/tower-game/approved-prefab.mjs';
import {validateSectionJoints} from '../../../packages/tower-game/prefab-joints.mjs';
import {towerUserId,loadTowerV3,mutateTowerV3,clearTowerV3} from './repository.js?v=17.7-approved-only.1';
import {uiIcon} from '../../shared/ui/icons.js?v=17.5.6-tower-controls.1';
let active=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const editable=(s)=>!s.params?.userId||s.params.userId===s.userId;
const TOWER_ICONS={confirm:'check',cancel:'x',rotate:'rotateCw',variant:'layers',remove:'eraser',hammer:'hammer',clear:'trash2'};
const icon=(name,label)=>`<button type="button" class="btn towerIconAction" data-${name} aria-label="${label}" title="${label}">${uiIcon(TOWER_ICONS[name])}</button>`;
export async function mount(context,params={}){
 const controller=new AbortController();
 const s={context,params,controller,disposed:false,userId:towerUserId(),scene:null,mode:'idle',
  sections:[],revision:0,resetAt:null,selected:null,type:BUILDABLE_PREFAB_TYPES[0].id,variant:0,rotation:0,
  preview:null,previewHit:null,locked:false,busy:false,ready:false,canLeave:()=>true};
 active=s;
 context.shell.setHeaderContent?.({title:'Къала · Башня'});
 context.shell.appShell.dataset.feature='tower';
 const root=context.root;
 root.innerHTML=`<section class="view towerView"><div class="towerGame" data-mode="idle">
  <div class="towerStage"><div class="towerCanvas" role="application" aria-label="Каменная башня"></div>
   <div class="towerCamera"><button type="button" class="btn towerIconAction" data-camera="home" aria-label="Показать всю башню" title="Показать всю башню">${uiIcon('house')}</button>
   <button type="button" class="btn towerWorldAction" data-world disabled aria-pressed="false" aria-label="Обзор Кюнлюма" title="Обзор Кюнлюма">${uiIcon('route')}<span>Обзор Кюнлюма</span></button>
   <button type="button" class="btn towerWorldAction" data-explore disabled aria-pressed="false" aria-label="Прогулка от первого лица" title="Прогулка от первого лица">${uiIcon('userRound')}<span>Прогулка</span></button>
   ${icon('clear','Очистить всю башню')}</div>
  </div>
  <div class="towerExploreControls" role="group" aria-label="Перемещение от первого лица">
   <div class="towerExploreHint">Проведи пальцем справа, чтобы осмотреться</div>
   <div class="towerJoystick" data-joystick role="application" aria-label="Джойстик движения">
    <div class="towerJoystickPuck" data-joystick-puck></div>
   </div>
   <div class="towerFlightPanel">
    <button type="button" class="btn towerFlySwitch" data-fly aria-pressed="false">Полёт</button>
    <div class="towerAltitude">
     <button type="button" class="btn" data-rise aria-label="Подняться">↑</button>
     <button type="button" class="btn" data-fall aria-label="Спуститься">↓</button>
    </div>
    <button type="button" class="btn towerGround" data-ground>На землю</button>
   </div>
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
 catalog.innerHTML=BUILDABLE_PREFAB_TYPES.map(spec=>`<button type="button" class="btn towerItem" data-section-id="${spec.id}" aria-label="Секция ${spec.id.replaceAll('x',' на ')}"><span class="towerItemIcon" aria-hidden="true">${uiIcon('blocks')}</span><span class="towerItemName">[ ${spec.id===WINDOW_PREFAB_ID?'Окно 0,5×1 м':spec.id===DOOR_PREFAB_ID?'Дверь 0,75×2 м':spec.id===GATE_PREFAB_ID?'Ворота 2×2 м':spec.id.replaceAll('x','×')} ]</span></button>`).join('');
 let toastTimer=null;
 function message(text){
  if(s.disposed)return;
  const el=q('[data-toast]');el.textContent=text;el.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{if(!s.disposed)el.hidden=true;},3200);
 }
 function blocks(){return s.sections;}
 function catalogVisible(show){
  side.classList.toggle('is-open',!!show);
  q('[data-hammer]').setAttribute('aria-expanded',String(!!show));
 }
 function mode(next){
  s.mode=next;game.dataset.mode=next;
  q('[data-placement]').hidden=next!=='placing'&&next!=='saving-place';
  q('[data-selection]').hidden=next!=='selected'&&next!=='saving-remove';
  q('[data-confirm]').disabled=next!=='placing';
  q('[data-variant]').hidden=approvedVariantCount(s.type)<2;
  q('[data-remove]').disabled=next!=='selected'||s.busy;
  for(const name of ['cancel','rotate','variant','hammer','camera','explore','world']){
   const button=q(name==='explore'?'button[data-explore]':`[data-${name}]`);if(button)button.disabled=s.busy;
  }
  q('[data-clear]').disabled=s.busy||!s.ready||!s.userId||!editable(s);
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
  if(s.busy||!editable(s)||!BUILDABLE_PREFAB_TYPES.some(spec=>spec.id===type))return;
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
 on('[data-clear]','click',()=>{void clearAll();});
 on('.towerCatalog','click',event=>{
  const el=event.target.closest('[data-section-id]');if(el)begin(el.dataset.sectionId);
 });
 on('[data-hammer]','click',()=>{
  if(s.busy)return;
  if(s.mode==='placing')cancel();
  if(s.mode==='selected'){markSelection(null);catalogVisible(true);return;}
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
  game.dataset.flying='false';q('[data-fly]')?.setAttribute('aria-pressed','false');
  q('[data-fly]').textContent='Полёт';
  joystick={forward:0,strafe:0};altitude=0;sendMotion();
  if(active)catalogVisible(false);else if(s.mode==='idle')catalogVisible(true);
 }
 on('[data-camera]','click',()=>{
  s.scene?.home();walkUi(false);
  q('[data-world]')?.setAttribute('aria-pressed','false');
  q('[data-world] span').textContent='Обзор Кюнлюма';
 });
 on('[data-world]','click',()=>{
  if(game.dataset.explore==='true')walkUi(false);
  const wide=s.scene?.worldView();
  q('[data-world]')?.setAttribute('aria-pressed',String(!!wide));
  const span=q('[data-world] span');if(span)span.textContent=wide?'К строительству':'Обзор Кюнлюма';
 });
 on('button[data-explore]','click',()=>{
  if(s.busy||!s.scene)return;
  if(game.dataset.explore==='true'){
   s.scene.exitExplore();walkUi(false);return;
  }
  if(s.mode==='placing')cancel();
  else if(s.mode==='selected')markSelection(null);
  const active=s.scene.enterExplore();
  walkUi(active);
  q('[data-world]')?.setAttribute('aria-pressed','false');
  q('[data-world] span').textContent='Обзор Кюнлюма';
 });
 on('[data-fly]','click',()=>{
  if(game.dataset.explore!=='true')return;
  const active=s.scene?.setFly(q('[data-fly]').getAttribute('aria-pressed')!=='true');
  q('[data-fly]').setAttribute('aria-pressed',String(!!active));
  q('[data-fly]').textContent=active?'Полёт: вкл.':'Полёт';
  game.dataset.flying=String(!!active);
 });
 on('[data-ground]','click',()=>{
  if(game.dataset.explore!=='true')return;
  const stillFlying=s.scene?.setFly(false);
  altitude=0;sendMotion();
  q('[data-fly]').setAttribute('aria-pressed',String(!!stillFlying));
  q('[data-fly]').textContent=stillFlying?'Полёт: вкл.':'Полёт';
  game.dataset.flying=String(!!stillFlying);
  if(stillFlying)message('Освободи место под собой, чтобы приземлиться');
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
 window.addEventListener('keydown',e=>{
  if(s.disposed||s.busy||document.body.classList.contains('modal-open')||e.target?.closest?.('input,textarea,select,[contenteditable]')||e.ctrlKey||e.metaKey)return;
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
  q('[data-world]').disabled=false;
  q('button[data-explore]').disabled=false;
  mode('idle');
  try{await refreshServer();}catch{message('Не удалось загрузить сохранённую башню');await redraw();}
  if(params.userId&&!editable(s))catalogVisible(false);
  s.ready=true;mode(s.mode);
 }catch(error){message('Не удалось загрузить 3D-сцену');console.error(error);}
}
export function canLeave(){return active?.canLeave?.()??true;}
export function unmount(){
 if(!active)return;active.disposed=true;active.controller.abort();active.scene?.dispose();
 if(active.context.shell.appShell.dataset.feature==='tower')active.context.shell.appShell.dataset.feature='practice';
 active=null;
}