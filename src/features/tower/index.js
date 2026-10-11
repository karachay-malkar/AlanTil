import {CATALOG,STONE_CONFIGURATIONS,GRID_SIZE,HEIGHT_LIMIT,validatePlacement,removalDependents,worldDimensions} from '../../../packages/tower-game/core.mjs';
import {createTowerScene} from './scene.js?v=17.0.8';
import {ROCK_PACK} from '../../../assets/tower/processed-rocks.mjs';
import {towerUserId,loadTower,mutateTower} from './repository.js?v=17.0.1';
let active=null;
const STONE_KIND={stone:'small',medium:'medium',long:'long',big:'big'};
const icons={stone:'◆',medium:'▰',long:'▬',big:'⬟',beam:'╱',deck:'▤',window:'▣',door:'▥',ladder:'☷',roof:'⌂'};
const categories={stone:'Камень',wood:'Дерево',openings:'Проёмы',finish:'Завершение'};
const escape=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function mount(context,params={}){
 const controller=new AbortController(),s={controller,context,scene:null,blocks:[],balance:{silver:0,gold:0},revision:0,type:'stone',category:'stone',variant:0,configIndex:0,rotation:0,tool:'place',preview:null,selected:null,busy:false,pending:null,disposed:false,editable:false};active=s;
 context.shell.setHeaderContent?.({title:'Къала · Башня'});
 // The route remains practice.tower; the scoped feature identifies its immersive scene.
 context.shell.appShell.dataset.feature='tower';
 context.root.innerHTML=`<section class="view towerView"><div class="towerGame"><div class="towerStage"><div class="towerCanvas" role="application" aria-label="Трёхмерный редактор башни"></div><div class="towerHud"><div class="towerPill towerBalance"><span class="towerCoin"><i></i><b data-silver>0</b></span><span class="towerCoin gold"><i></i><b data-gold>0</b></span></div></div><div class="towerCamera"><button type="button" class="iconBtn" data-camera="home" aria-label="Вся башня" title="Вся башня"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/></svg></button></div><div class="towerPill towerReadOnly" hidden></div></div><aside class="towerSide"><h2>Каталог</h2><div class="towerTabs" role="tablist" aria-label="Материалы">${Object.entries(categories).map(([k,n])=>`<button type="button" class="bracketNavigation ${k==='stone'?'active':''}" role="tab" data-category="${k}" aria-selected="${k==='stone'}">[ ${n} ]</button>`).join('')}</div><div class="towerStoneKinds bracketTabsTrack" role="tablist" aria-label="Типы камней">${Object.keys(STONE_KIND).map((kind)=>`<button type="button" class="bracketNavigation" data-stone-kind="${kind}" role="tab" aria-selected="${kind==='stone'}">[ ${CATALOG[kind].name.replace(' камень','')} ]</button>`).join('')}</div><div class="towerCatalog"></div><div class="towerTool"><button type="button" class="btn actionCompact" data-tool="place" aria-pressed="true">Строить</button><button type="button" class="btn actionCompact" data-tool="select" aria-pressed="false">Выбрать</button><button type="button" class="btn actionCompact" data-vertical hidden>Столб ↥</button></div><div class="towerDimensions"></div><div class="towerPosition">${['x','y','z'].map((a,i)=>`<label>${['X','Высота','Z'][i]}<input data-position="${a}" type="number" min="0" max="${a==='y'?HEIGHT_LIMIT-1:GRID_SIZE-1}" step="1" value="0" aria-label="Положение ${a}"></label>`).join('')}</div><div class="towerCurrency segmentControl" role="group" aria-label="Способ оплаты" hidden><label class="settingsChoice"><input type="radio" name="tower-currency" value="silver" checked><span>24 серебра</span></label><label class="settingsChoice"><input type="radio" name="tower-currency" value="gold"><span>3 золота</span></label></div><div class="towerExchange"><button type="button" class="btn actionCompact" data-exchange="exchange_gold">1 золото → 8 серебра</button><button type="button" class="btn actionCompact" data-exchange="exchange_silver">8 серебра → 1 золото</button></div><div class="towerSelected" hidden></div><div class="towerActions"><button class="btn actionPrimary towerAction" data-confirm disabled>Установить · 1 серебро</button><button class="btn towerAction" data-remove hidden>Удалить и вернуть монеты</button><button class="btn towerAction towerRetry" data-retry hidden>Повторить действие</button><button class="btn actionCompact towerAction" data-refresh>Обновить сохранение</button></div><div class="towerStatus" role="status" aria-live="polite" hidden></div><span class="towerSaved"></span><label class="towerLayer">Разрез: <span data-layer-label>вся башня</span><input data-layer type="range" min="0" max="${HEIGHT_LIMIT}" value="${HEIGHT_LIMIT}"></label><p class="towerHelp">Выбери готовый размер в ячейках. Перед покупкой можно изменить форму и повернуть камень. Перемычкам нужна опора с двух сторон.</p><p class="towerHelp">Монеты за первое верное слово в завершённом тесте: начальный и тематический словари — серебро, средний и сложный — золото. 1 золотая = 8 серебряных.</p></aside></div></section>`;
 // Keep the stage unobstructed: the catalogue is a compact bottom dock,
 // while dimensions, currencies and layer tools stay available on demand.
 const dock=context.root.querySelector('.towerSide');
 const stage=context.root.querySelector('.towerStage');
 const actionBar=document.createElement('div');
 actionBar.className='towerActionBar';stage.append(actionBar);
 const quick=document.createElement('div');quick.className='towerQuickTools';
 quick.innerHTML='<button type="button" class="btn actionCompact" data-quick="cancel" aria-label="Отменить установку">Отмена</button><button type="button" class="btn actionCompact" data-quick="rotate" aria-label="Повернуть камень">Повернуть</button><button type="button" class="btn actionCompact" data-quick="variant" aria-label="Изменить форму выбранного камня" hidden>Изменить форму</button>';
 actionBar.append(quick);
 for(const selector of ['.towerSelected','.towerActions','.towerStatus','.towerSaved']){
  const el=dock.querySelector(selector);if(el)actionBar.append(el);
 }
 const payment=dock.querySelector('.towerCurrency');if(payment)actionBar.insertBefore(payment,actionBar.querySelector('.towerActions'));
 const toggle=document.createElement('button');
 toggle.type='button';toggle.className='btn actionCompact towerCatalogToggle';
 toggle.setAttribute('data-catalog-toggle','');
 toggle.setAttribute('aria-controls','tower-catalog-content');
 const catalogBody=document.createElement('div');
 catalogBody.className='towerCatalogContent';catalogBody.id='tower-catalog-content';
 for(const el of [...dock.children])catalogBody.append(el);
 dock.append(toggle,catalogBody);
 let catalogOpen=true;
 function setCatalogOpen(open){
  catalogOpen=!!open;
  dock.classList.toggle('is-collapsed',!catalogOpen);
  catalogBody.hidden=!catalogOpen;
  toggle.setAttribute('aria-expanded',String(catalogOpen));
  toggle.setAttribute('aria-label',catalogOpen?'Свернуть каталог':'Развернуть каталог');
  toggle.classList.toggle('is-open',catalogOpen);
  toggle.innerHTML='Каталог <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
 }
 setCatalogOpen(true);
 const game=context.root.querySelector('.towerGame');
 const dockObserver=new ResizeObserver(()=>game.style.setProperty('--tower-dock-height',Math.ceil(dock.getBoundingClientRect().height)+'px'));
 dockObserver.observe(dock);
 controller.signal.addEventListener('abort',()=>dockObserver.disconnect(),{once:true});
 toggle.addEventListener('click',()=>setCatalogOpen(!catalogOpen),{signal:controller.signal});

 const options=document.createElement('details');
 options.className='towerOptions';
 options.innerHTML='<summary class="btn actionCompact" aria-label="Дополнительные настройки">Ещё</summary>';
 dock.append(options);
 for(const selector of ['.towerDimensions','.towerPosition','.towerExchange','.towerLayer','.towerTool']){
  const item=dock.querySelector(selector);if(item)options.append(item);
 }
 for(const help of dock.querySelectorAll('.towerHelp'))help.remove();
 const refresh=actionBar.querySelector('[data-refresh]');if(refresh)options.append(refresh);
 s.positionTouched=false;
 const pendingKey='alantil_tower_pending_'+(towerUserId()||'guest');
 const persistPending=()=>{try{if(s.pending)localStorage.setItem(pendingKey,JSON.stringify(s.pending));else localStorage.removeItem(pendingKey);}catch{}};
 try{s.pending=JSON.parse(localStorage.getItem(pendingKey)||'null');}catch{}
 const root=context.root,q=sel=>root.querySelector(sel),on=(sel,event,fn)=>q(sel)?.addEventListener(event,fn,{signal:controller.signal});
 const coins=(unit,n)=>unit==='gold'?(n===1?'золотая':'золотых'):(n===1?'серебряная':'серебряных');
 const status=(message,error=false)=>{if(s.disposed)return;const el=q('.towerStatus');el.textContent=message;el.dataset.kind=error?'error':'info';el.hidden=!message;if(message)actionBar.classList.add('is-visible');else if(!s.positionTouched&&!s.selected)actionBar.classList.remove('is-visible');};s.status=status;
 function currency(){return q('[name="tower-currency"]:checked')?.value||'silver';}
 function chosen(){const dims=[...q('.towerDimensions').querySelectorAll('input')].map(i=>Number(i.value));const pos=['x','y','z'].map(a=>Number(q(`[data-position="${a}"]`).value));return{id:s.preview?.id||crypto.randomUUID(),type:s.type,x:pos[0],y:pos[1],z:pos[2],sx:dims[0],sy:dims[1],sz:dims[2],rotation:s.rotation,variant:s.variant};}
 function updatePreview(){if(s.disposed)return;
  const positionReady=s.tool==='place'&&s.positionTouched;
  if(!positionReady){s.scene?.setPreview(null,false);q('[data-confirm]').hidden=true;quick.hidden=true;actionBar.classList.toggle('is-visible',Boolean(s.selected&&s.tool==='select')||Boolean(s.pending)||Boolean(q('.towerStatus').textContent));if(s.tool!=='place')return;}
  else {q('[data-confirm]').hidden=false;quick.hidden=false;actionBar.classList.add('is-visible');}
  const shapeButton=q('[data-quick="variant"]');
  const shapeCount=ROCK_PACK[STONE_KIND[s.type]]?.length||0;
  shapeButton.hidden=!positionReady||!shapeCount;
  if(shapeCount)shapeButton.textContent=`Форма ${s.variant+1}/${shapeCount} · сменить`;
  s.preview=chosen();
  const v=validatePlacement(s.blocks,s.preview),price=CATALOG[s.type].price;
  const goldAllowed=(s.type==='big'||!STONE_KIND[s.type]&&price%8===0);
  q('[name="tower-currency"][value="gold"]').disabled=!goldAllowed;
  if(!goldAllowed)q('[name="tower-currency"][value="silver"]').checked=true;
  q('.towerCurrency').hidden=!positionReady||!goldAllowed;
  const choices=q('.towerCurrency').querySelectorAll('label span');
  choices[0].textContent=price+' серебра';choices[1].textContent=(price/8)+' золота';
  const cur=currency(),amount=cur==='gold'?price/8:price;
  const payable=Number.isInteger(amount)&&(!STONE_KIND[s.type]||s.type==='big'||cur==='silver');
  q('[data-confirm]').disabled=s.busy||!!s.pending||!s.editable||!v.ok||!payable||s.balance[cur]<amount;
  q('[data-confirm]').textContent='Установить · '+(payable?amount:'—')+' '+coins(cur,amount);
  root.querySelectorAll('[data-exchange]').forEach(b=>b.disabled=s.busy||!!s.pending||!s.editable||(b.dataset.exchange==='exchange_gold'?s.balance.gold<1:s.balance.silver<8));
  s.scene?.setPreview(positionReady?s.preview:null,v.ok);
  if(s.busy)return;
  const message=!s.editable?'':!v.ok&&s.positionTouched?v.reason:!payable?'Оплата только серебром':s.balance[cur]<amount?'Недостаточно монет':'';
  status(message,Boolean(message));
 }

 let thumbnailObserver=null;
 controller.signal.addEventListener('abort',()=>thumbnailObserver?.disconnect(),{once:true});
 quick.addEventListener('click',e=>{
  const button=e.target.closest('[data-quick]');if(!button||s.busy||s.pending)return;
  if(button.dataset.quick==='cancel'){
   s.positionTouched=false;s.preview=null;status('');updatePreview();
  }else if(button.dataset.quick==='rotate'){
   s.rotation=(s.rotation+1)%4;updatePreview();
  }else if(button.dataset.quick==='variant'&&STONE_KIND[s.type]&&s.positionTouched){
   s.variant=(s.variant+1)%ROCK_PACK[STONE_KIND[s.type]].length;
   updatePreview();
  }
 },{signal:controller.signal});
 function renderCatalog(){
  const catalog=q('.towerCatalog'),stone=Boolean(STONE_KIND[s.type]);
  q('.towerStoneKinds').hidden=s.category!=='stone';
  root.querySelectorAll('[data-stone-kind]').forEach(b=>{
   const active=s.type===b.dataset.stoneKind&&s.category==='stone';
   b.setAttribute('aria-selected',String(active));b.classList.toggle('active',active);
  });
  const configurations=stone
   ?STONE_CONFIGURATIONS[s.type].map((dimensions,index)=>({type:s.type,configIndex:index,dimensions}))
   :Object.entries(CATALOG).filter(([,c])=>c.category===s.category)
     .map(([type])=>({type,configIndex:0,dimensions:CATALOG[type].defaults}));
  catalog.innerHTML=configurations.map(({type,configIndex,dimensions})=>{
   const selected=s.type===type&&s.configIndex===configIndex;
   const dimensionsText=dimensions.join('×');
   return `<button class="btn towerItem" type="button" data-item="${type}" data-config="${configIndex}" aria-pressed="${selected}" aria-label="${escape(stone?dimensionsText+' ячеек':CATALOG[type].name)}"><span class="towerItemIcon"><img class="towerItemImage" alt="" draggable="false"><span aria-hidden="true">${icons[type]}</span></span><span class="towerItemName">${stone?dimensionsText:escape(CATALOG[type].name)}</span>${stone?'':`<span class="towerPrice">${CATALOG[type].price} серебра</span>`}</button>`;
  }).join('');
  thumbnailObserver?.disconnect();
  if(!s.scene)return;
  const loadCard=card=>{
   try{
    const type=card.dataset.item,index=Number(card.dataset.config||0);
    const dimensions=STONE_CONFIGURATIONS[type]?.[index]||null;
    const image=card.querySelector('img');
    image.onload=()=>{if(card.isConnected)card.classList.add('has-thumbnail');};
    image.src=s.scene.thumbnail(type,0,dimensions);
   }catch(e){console.warn('Tower thumbnail:',e);}
  };
  if(typeof IntersectionObserver==='undefined'){
   catalog.querySelectorAll('[data-item]').forEach(loadCard);
  }else{
   thumbnailObserver=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){
     thumbnailObserver?.unobserve(entry.target);loadCard(entry.target);
    }
   },{root:catalog,rootMargin:'0px 150px',threshold:0});
   catalog.querySelectorAll('[data-item]').forEach(card=>thumbnailObserver.observe(card));
  }
 }
 function renderDimensions(){
  const c=CATALOG[s.type];
  const silver=q('[name="tower-currency"][value="silver"]');if(silver)silver.checked=true;
  const fixed=STONE_CONFIGURATIONS[s.type]?.[s.configIndex];
  q('.towerDimensions').innerHTML=fixed
   ?fixed.map((value,index)=>`<input type="hidden" data-dimension="${index}" value="${value}">`).join('')+
     `<span class="towerFixedDimensions" aria-label="Размер в ячейках">${fixed.join('×')} яч.</span>`
   :c.defaults.map((value,index)=>`<label>${['Длина','Высота','Глубина'][index]}<input type="number" data-dimension="${index}" min="${c.min[index]}" max="${c.max[index]}" step="1" value="${value}" ${c.min[index]===c.max[index]?'readonly':''}></label>`).join('');
  q('[data-vertical]').hidden=s.type!=='beam';
  renderCatalog();updatePreview();
 }
 function setTool(tool){s.tool=tool;if(tool!=='place')s.positionTouched=false;s.scene?.setTool(tool);root.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));q('[data-confirm]').hidden=tool!=='place'||!s.positionTouched;q('[data-remove]').hidden=tool!=='select'||!s.selected;q('.towerDimensions').hidden=tool!=='place';q('.towerPosition').hidden=tool!=='place';q('.towerSelected').hidden=tool!=='select'||!s.selected;updatePreview();actionBar.classList.toggle('is-visible',!!s.selected||s.positionTouched);}
 function apply(data){s.blocks=data.elements;s.revision=data.revision;s.balance={silver:data.silver,gold:data.gold};q('[data-silver]').textContent=data.silver;q('[data-gold]').textContent=data.gold;s.scene?.setBlocks(s.blocks);q('.towerSaved').textContent='';s.positionTouched=false;s.selected=null;q('[data-remove]').hidden=true;q('.towerSelected').hidden=true;updatePreview();}
 async function reload(){if(s.busy)return;if(!towerUserId()){s.editable=false;q('.towerReadOnly').hidden=false;q('.towerReadOnly').textContent='Войди в аккаунт, чтобы строить за освоенные слова.';updatePreview();return;}status('Загрузка сохранения…');try{const data=await loadTower(params.userId||null);if(s.disposed)return;s.editable=!!towerUserId()&&(!params.userId||params.userId===towerUserId());apply(data);status('');q('.towerReadOnly').hidden=s.editable;if(!s.editable)q('.towerReadOnly').textContent=params.userId?'Башня игрока · только просмотр':'Войди в аккаунт, чтобы строить башню за освоенные слова.';}catch(e){s.editable=false;status('Не удалось загрузить башню. '+friendlyError(e),true);q('.towerSaved').textContent='Сохранение недоступно';updateButtons();}}
 function updateButtons(){updatePreview();q('[data-remove]').disabled=s.busy||!!s.pending||!s.editable;}
 async function submit(operation){if(s.busy||!s.editable)return;s.busy=true;s.pending=operation;persistPending();updateButtons();q('[data-retry]').hidden=true;status('Сохраняем…');try{const data=await mutateTower(operation);if(s.disposed)return;s.pending=null;persistPending();s.preview=null;s.busy=false;apply(data);status('');updatePreview();}catch(e){if(s.disposed)return;s.busy=false;const rejected=e?.code==='P0001'||/REVISION_CONFLICT|INSUFFICIENT|INVALID|OUT_OF_BOUNDS|OVERLAP|UNSUPPORTED|DEPENDENT|AUTH_REQUIRED|OPERATION_ID_REUSED/i.test(String(e?.message||''));if(rejected){s.pending=null;persistPending();}q('[data-retry]').hidden=!s.pending;updateButtons();status(friendlyError(e),true);}finally{if(!s.disposed)s.busy=false;}}
 s.canLeave=()=>!s.busy;
 on('.towerTabs','click',e=>{
  const b=e.target.closest('[data-category]');if(!b)return;
  const category=b.dataset.category;
  const first=Object.keys(CATALOG).find(type=>CATALOG[type].category===category);
  if(first)chooseItem(first,0);
 });
 on('.towerStoneKinds','click',e=>{const b=e.target.closest('[data-stone-kind]');if(b)chooseItem(b.dataset.stoneKind,0);});
 function chooseItem(type,configIndex=0){
  if(!CATALOG[type]||s.busy||s.pending)return;
  s.positionTouched=false;
  s.type=type;s.configIndex=STONE_CONFIGURATIONS[type]?Math.max(0,Math.min(configIndex,STONE_CONFIGURATIONS[type].length-1)):0;s.variant=0;s.category=CATALOG[type].category;s.rotation=0;s.preview=null;s.selected=null;
  root.querySelectorAll('[data-category]').forEach(b=>{const active=b.dataset.category===s.category;b.setAttribute('aria-selected',String(active));b.classList.toggle('active',active);});
  setTool('place');renderDimensions();
 }
 on('.towerCatalog','click',e=>{const b=e.target.closest('[data-item]');if(b)chooseItem(b.dataset.item,Number(b.dataset.config||0));});
 // Desktop: drag any catalogue card. Touch: drag its icon, swipe the name to scroll.
 let dragging=null;
 on('.towerCatalog','pointerdown',e=>{
  const item=e.target.closest('[data-item]');
  if(!item||s.busy||s.pending||!s.editable||e.button!==0)return;
  if(e.pointerType==='touch'&&!e.target.closest('.towerItemIcon'))return;
  chooseItem(item.dataset.item,Number(item.dataset.config||0));
  dragging={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};
  if(e.target.closest('.towerItemIcon'))e.preventDefault();
 });
 function stopDragging(e){if(dragging?.id===e.pointerId)dragging=null;}
 function locateHit(hit){
  if(!hit||s.disposed||s.busy||s.pending||s.tool!=='place')return;
  const dims=worldDimensions(chosen()),n=hit.normal||{x:0,y:1,z:0};
  const p={x:hit.x,y:hit.y,z:hit.z};
  if(hit.blockId){if(n.x<0)p.x-=dims[0]-1;if(n.y<0)p.y-=dims[1]-1;if(n.z<0)p.z-=dims[2]-1;}
  for(const a of ['x','y','z'])q(`[data-position="${a}"]`).value=Math.max(0,Math.floor(p[a]));
  s.positionTouched=true;updatePreview();
 }
 window.addEventListener('pointermove',e=>{
  if(!dragging||dragging.id!==e.pointerId||s.disposed||!s.scene)return;
  if(!dragging.moved&&Math.hypot(e.clientX-dragging.x,e.clientY-dragging.y)<7)return;
  dragging.moved=true;
  const hit=s.scene.pickAt(e.clientX,e.pointerType==='touch'?e.clientY-65:e.clientY);
  if(hit){locateHit(hit);if(e.cancelable)e.preventDefault();}
 },{signal:controller.signal,passive:false});
 window.addEventListener('pointerup',stopDragging,{signal:controller.signal});
 window.addEventListener('pointercancel',stopDragging,{signal:controller.signal});
 window.addEventListener('keydown',e=>{
  if(s.disposed||s.busy||s.pending||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.target?.closest?.('input,textarea,select,[contenteditable]'))return;
  if(e.key==='Escape'&&s.positionTouched){e.preventDefault();q('[data-quick="cancel"]')?.click();}
  else if(['q','e'].includes(e.key.toLowerCase())&&s.tool==='place'&&s.positionTouched){
   e.preventDefault();s.rotation=(s.rotation+(e.key.toLowerCase()==='q'?3:1))%4;updatePreview();
  }else if(e.key==='Enter'&&s.tool==='place'&&s.positionTouched&&!q('[data-confirm]').disabled){e.preventDefault();q('[data-confirm]').click();}
  else if(['Delete','Backspace'].includes(e.key)&&s.tool==='select'&&s.selected&&!q('[data-remove]').disabled){e.preventDefault();q('[data-remove]').click();}
 },{signal:controller.signal});
 on('.towerDimensions','input',()=>{if(!s.busy&&!s.pending)updatePreview();});on('.towerPosition','input',()=>{if(!s.busy&&!s.pending){s.positionTouched=true;updatePreview();}});on('.towerCurrency','change',updatePreview);
 root.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{if(!s.busy&&!s.pending)setTool(b.dataset.tool);},{signal:controller.signal}));
 on('[data-vertical]','click',()=>{if(s.busy||s.pending)return;s.rotation=s.rotation===4?0:4;updatePreview();});
 on('[data-confirm]','click',()=>{if(!s.preview||s.busy||s.pending||!validatePlacement(s.blocks,s.preview).ok)return;void submit({id:crypto.randomUUID(),revision:s.revision,action:'place',element:{...s.preview},currency:currency()});});
 on('[data-remove]','click',()=>{if(!s.selected||s.busy||s.pending)return;const dependent=removalDependents(s.blocks,s.selected);if(dependent.length){status(`Сначала убери элементы, которые опираются на этот: ${dependent.length}.`,true);return;}void submit({id:crypto.randomUUID(),revision:s.revision,action:'remove',elementId:s.selected});});
 root.querySelectorAll('[data-exchange]').forEach(b=>b.addEventListener('click',()=>{if(s.busy||s.pending||!s.editable)return;void submit({id:crypto.randomUUID(),revision:s.revision,action:b.dataset.exchange});},{signal:controller.signal}));
 on('[data-retry]','click',()=>{if(s.pending)void submit(s.pending);});on('[data-refresh]','click',()=>{if(s.busy)return;if(s.pending){void submit(s.pending);return;}q('[data-retry]').hidden=true;void reload();});
 on('[data-layer]','input',e=>{const y=Number(e.target.value);q('[data-layer-label]').textContent=y===HEIGHT_LIMIT?'вся башня':`до слоя ${y}`;s.scene?.setLayer(y===HEIGHT_LIMIT?null:y);});
 root.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.camera;if(a==='home')s.scene?.home();else if(a==='left'||a==='right')s.scene?.rotateView(a==='left'?-Math.PI/8:Math.PI/8);else s.scene?.zoom(a==='in'?.85:1.18);},{signal:controller.signal}));
 renderDimensions();
 try{s.scene=await createTowerScene(q('.towerCanvas'),{onPick(hit){locateHit(hit);},onSelection(id){if(s.disposed)return;if(id)setTool('select');s.selected=id;const b=s.blocks.find(a=>a.id===id);q('[data-remove]').hidden=!b;q('.towerSelected').hidden=!b;actionBar.classList.toggle('is-visible',!!b);if(b){q('.towerSelected').textContent=`${CATALOG[b.type].name} · возврат ${b.paidAmount} ${coins(b.paidCurrency,b.paidAmount)}`;q('[data-remove]').disabled=!s.editable||s.busy;}}});if(s.disposed){s.scene.dispose();return;}renderCatalog();await reload();if(s.pending&&s.editable){q('[data-retry]').hidden=false;status('Осталось неподтверждённое действие. Повтори его, чтобы проверить сохранение.');updateButtons();}}catch(e){status('Не удалось запустить 3D: '+friendlyError(e),true);}
}
function friendlyError(e){const m=String(e?.message||e||'Ошибка соединения');if(/ELEMENT_LIMIT/.test(m))return'Достигнут предел: 10 000 элементов.';if(/ELEMENT_NOT_FOUND/.test(m))return'Элемент уже удалён. Обнови сохранение.';if(/USE_SILVER/.test(m))return'Этот элемент оплачивается серебром.';if(/INVALID/.test(m))return'Проверь размеры, положение и опоры элемента.';if(/revision|conflict/i.test(m))return'Башня изменена на другом устройстве. Обнови сохранение.';if(/insufficient|balance/i.test(m))return'Недостаточно монет.';if(/support|depend/i.test(m))return'Нельзя оставить элементы без опоры.';if(/auth|login|permission/i.test(m))return'Для строительства войди в аккаунт.';if(/function.*not|PGRST202/i.test(m))return'Сервер игры ещё не подключён.';return m;}
export function canLeave(){return active?.canLeave?.()??true;}
export function unmount(){if(!active)return;active.disposed=true;active.controller.abort();active.scene?.dispose();if(active.context.shell.appShell.dataset.feature==='tower')active.context.shell.appShell.dataset.feature='practice';active=null;}
