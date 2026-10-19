/** Practice > Masonry. Admin-only, exact freeform transforms over original Common 100 meshes. */
import * as THREE from '../../vendor/three/three.module.js';
import {hasActivityAccess} from '../../shared/admin/admin-access.js?v=13.15.9';
import {getCurrentAuthState,subscribeToAuth} from '../../shared/auth/auth-service.js?v=16.7.1';
import {CELL_METERS,CATEGORIES,loadCommon100,makeRecipe,validateRecipe,serializeTransform} from './library.js';
import {createMasonryScene} from './scene.js?v=17.2-manual-masonry.2';
import {listSections,loadSection,saveSection,readLocalScratch,saveLocalScratch,clearLocalScratch,downloadRecipe} from './store.js';

let active=null;
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const copy=v=>JSON.parse(JSON.stringify(v));
const num=v=>+Number(v).toFixed(6);
const fmt=x=>Number(x||0).toFixed(3);
const PRESETS=[[1,1,1],[2,2,2],[2,2,3],[2,3,4],[3,3,3],[4,4,4]];
const uuid=()=>crypto.randomUUID();
const titleFor=cells=>`Секция ${cells.join('×')}`;

export async function mount(context){
 const controller=new AbortController(),signal=controller.signal;
 const state={context,controller,scene:null,library:null,recipe:makeRecipe(),id:null,title:titleFor([3,3,3]),
  status:'draft',selected:null,category:'large',search:'',page:0,dirty:false,busy:false,history:[],future:[],mutationRevision:0,disposed:false,timer:0};
 active=state;
 if(!hasActivityAccess()||!getCurrentAuthState()?.user?.id){
  context.router.replace('practice.home');return;
 }
 context.shell.appShell.dataset.feature='masonry';
 context.shell.setHeaderContent?.({title:'Редактор кладки'});
 const root=context.root;
 root.innerHTML=`<section class="view masonryView"><div class="masonryEditor">
 <div class="masonryStage">
  <div class="masonryCanvas" data-canvas aria-label="Трёхмерный редактор камней"></div>
  <div class="masonryLoading" data-loading>Загрузка оригинальной библиотеки Common 100…</div>
  <div class="masonryTop">
   <div class="masonryTopRow"><select data-sections aria-label="Мои сохранённые секции"><option value="">Новая секция</option></select>
    <button type="button" data-action="new" title="Создать новую секцию">＋</button>
    <button type="button" data-action="camera" title="Сброс камеры">◎</button>
   </div>
   <div class="masonryTopRow">
    <input data-title maxlength="120" aria-label="Название секции" value="${escapeHTML(state.title)}">
    <select data-preset aria-label="Размер секции">
     ${PRESETS.map(c=>`<option value="${c.join(',')}" ${c.join(',')==='3,3,3'?'selected':''}>${c.join('×')}</option>`).join('')}
     <option value="custom">Свой размер</option>
    </select>
    <button type="button" data-action="bounds" aria-pressed="true" title="Показать или скрыть контур секции">▧</button>
   </div>
   <div class="masonryTopRow masonrySizes" data-custom hidden>
    ${['X','Y','Z'].map((a,i)=>`<label>${a}<input data-cell="${i}" type="number" min="1" max="32" step="1" value="3"></label>`).join('')}
    <button type="button" data-action="apply-size">OK</button>
   </div>
  </div>
  <div class="masonryFloating">
   <div data-status role="status">Загрузка…</div>
   <div data-count>0 камней · без автоматической привязки</div>
  </div>
 </div>
 <div class="masonryEditorPanel">
  <div class="masonrySelected" data-selected>
   <span class="masonryNoSelection">Коснитесь камня или выберите его из каталога</span>
  </div>
  <div class="masonryActions">
   <button type="button" data-action="undo" title="Отменить">↶</button>
   <button type="button" data-action="redo" title="Повторить">↷</button>
   <button type="button" data-action="duplicate" title="Дублировать">⧉</button>
   <button type="button" data-action="delete" title="Удалить">⌫</button>
   <button type="button" data-action="catalog">Каталог ▾</button>
   <button type="button" data-action="export" title="Скачать JSON координат">JSON ↓</button>
   <button type="button" class="masonrySave" data-action="save">Сохранить</button>
   <button type="button" class="masonryReady" data-action="ready">OK · Готова</button>
  </div>
  <div class="masonryCatalog" data-catalog>
   <div class="masonryCategories" data-categories></div>
   <div class="masonryCatalogTools"><input data-search aria-label="Поиск модели" placeholder="Поиск по ID, например LARGE_001">
    <span data-page-count></span></div>
   <div class="masonryStoneList" data-stones></div>
   <div class="masonryCatalogPaging"><button type="button" data-action="prev">‹ Назад</button>
    <span data-pages>1 / 1</span><button type="button" data-action="next">Вперёд ›</button></div>
  </div>
 </div></div></section>`;
 const $=sel=>root.querySelector(sel);
 const toast=(value,isError=false)=>{const el=$('[data-status]');if(el){el.textContent=value;el.dataset.error=String(isError);}};
 const refreshCount=()=>{const el=$('[data-count]');if(el)el.textContent=`${state.recipe.stones.length} камней · ${state.recipe.cells.join('×')} ячеек · ${state.dirty?'Черновик изменён':'Сохранено'}`;};
 const commitBefore=()=>{
  state.history.push(copy(state.recipe));if(state.history.length>80)state.history.shift();
  state.future=[];
 };
 const scheduleScratch=()=>{
  state.dirty=true;state.mutationRevision+=1;refreshCount();
  clearTimeout(state.timer);
  state.timer=setTimeout(()=>saveLocalScratch({id:state.id,title:state.title,status:state.status,recipe:state.recipe}),650);
 };
 const syncScene=()=>{state.scene?.sync(state.recipe.stones);state.scene?.select(state.selected);refreshCount();renderSelected();};
 const updateStone=(id,transform,final=false)=>{
  const stone=state.recipe.stones.find(x=>x.id===id);if(!stone)return;
  stone.position=[...transform.position];stone.quaternion=[...transform.quaternion];stone.scale=[...transform.scale];
  scheduleScratch();if(final)renderSelected();else renderInputs();
 };
 const putStone=(stone)=>{
  commitBefore();state.recipe.stones.push(stone);state.selected=stone.id;syncScene();scheduleScratch();
 };
 function addStone(name){
  const model=state.library?.manifest.models.find(m=>m.name===name);if(!model)return;
  const i=state.recipe.stones.length;
  const size=model.sizeMeters||[.25,.2,.25];
  putStone({id:uuid(),name,position:[num(((i%5)-2)*.045),num((size[1]||.2)/2+Math.floor(i/5)*.05),num((Math.floor(i/5)%5-2)*.045)],
   quaternion:[0,0,0,1],scale:[1,1,1]});
  toast(name+' добавлен — переместите камень по осям X, Y, Z');
 }
 function renderInputs(){
  const stone=state.recipe.stones.find(x=>x.id===state.selected);if(!stone)return;
  for(let i=0;i<3;i++){
   const p=$(`[data-pos="${i}"]`);if(p&&document.activeElement!==p)p.value=fmt(stone.position[i]);
   const s=$(`[data-scale="${i}"]`);if(s&&document.activeElement!==s)s.value=fmt(stone.scale[i]);
  }
 }
 function renderSelected(){
  const area=$('[data-selected]');if(!area)return;
  const stone=state.recipe.stones.find(x=>x.id===state.selected);
  if(!stone){area.innerHTML='<span class="masonryNoSelection">Коснитесь камня или выберите его из каталога</span>';return;}
  const model=state.library?.manifest.models.find(m=>m.name===stone.name);
  area.innerHTML=`<div class="masonrySelectionRow"><b>${escapeHTML(stone.name)}</b><small>${escapeHTML(model?.category||'')}</small>
   <label>Шаг <select data-step><option value=".005">5 мм</option><option value=".01" selected>1 см</option>
     <option value=".025">2,5 см</option><option value=".05">5 см</option></select></label></div>
   <div class="masonryAxisRow"><label>Ось перемещения <select data-axis><option value="free">Свободно</option>
    <option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
    <span>Тяните выбранный камень пальцем или задайте координаты</span></div>
   <div class="masonryXYZ">${['X','Y','Z'].map((a,i)=>`<label>${a}, м<input data-pos="${i}" type="number" step=".005" value="${fmt(stone.position[i])}"></label>`).join('')}</div>
   <div class="masonryNudges">${['X','Y','Z'].map(a=>`<span>${a} <button type="button" data-nudge="${a.toLowerCase()}:-1">−</button><button type="button" data-nudge="${a.toLowerCase()}:1">＋</button></span>`).join('')}</div>
   <div class="masonryRotate"><span>Поворот 15°</span>${['X','Y','Z'].map(a=>`<span>${a} <button type="button" data-rotate="${a.toLowerCase()}:-1">↶</button><button type="button" data-rotate="${a.toLowerCase()}:1">↷</button></span>`).join('')}</div>
   <div class="masonryXYZ masonryScale">${['X','Y','Z'].map((a,i)=>`<label>Масштаб ${a}<input data-scale="${i}" type="number" min=".011" max="20" step=".05" value="${fmt(stone.scale[i])}"></label>`).join('')}</div>`;
 }
 function editSelected(type,index,value){
  const stone=state.recipe.stones.find(x=>x.id===state.selected);
  if(!stone||!Number.isFinite(value))return false;
  if(type==='position'&&Math.abs(value)>200)return false;
  if(type==='scale'&&(value<=.01||value>20))return false;
  commitBefore();stone[type][index]=num(value);syncScene();scheduleScratch();return true;
 }
 function nudge(axis,direction){
  const idx={x:0,y:1,z:2}[axis];const stone=state.recipe.stones.find(x=>x.id===state.selected);if(!stone)return;
  const step=Number($('[data-step]')?.value)||.01;
  editSelected('position',idx,stone.position[idx]+direction*step);
 }
 function rotate(axis,direction){
  const stone=state.recipe.stones.find(x=>x.id===state.selected);if(!stone)return;
  commitBefore();
  const v=new THREE.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0);
  const q=new THREE.Quaternion().fromArray(stone.quaternion);
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(v,direction*Math.PI/12));
  stone.quaternion=q.normalize().toArray().map(x=>+x.toFixed(8));
  syncScene();scheduleScratch();
 }
 const presetControl=$('[data-preset]');
 function updateSize(cells){
  if(!Array.isArray(cells)||cells.length!==3||cells.some(x=>!Number.isInteger(x)||x<1||x>32))return toast('Размеры: от 1 до 32 ячеек по каждой оси',true);
  commitBefore();state.recipe.cells=[...cells];state.scene?.setBounds(cells);state.scene?.resetCamera(cells);
  if(!state.id)state.title=titleFor(cells);
  $('[data-title]').value=state.title;
  const key=cells.join(',');presetControl.value=PRESETS.some(p=>p.join(',')===key)?key:'custom';
  const controls=$('[data-custom]');controls.hidden=presetControl.value!=='custom';
  cells.forEach((v,i)=>{const input=$(`[data-cell="${i}"]`);if(input)input.value=v;});
  scheduleScratch();toast('Габариты изменены; камни остались на своих местах');
 }
 function setRecipe(recipe,{id=null,title=null,status='draft',dirty=false}={}){
  if(!state.library)return;
  validateRecipe(recipe,state.library.manifest);
  state.recipe=copy(recipe);state.id=id;state.title=title||titleFor(recipe.cells);state.status=status;
  state.selected=null;state.history=[];state.future=[];state.dirty=dirty;state.mutationRevision+=1;
  $('[data-title]').value=state.title;
  const key=recipe.cells.join(',');
  presetControl.value=PRESETS.some(c=>c.join(',')===key)?key:'custom';$('[data-custom]').hidden=presetControl.value!=='custom';
  recipe.cells.forEach((v,i)=>{$(`[data-cell="${i}"]`).value=v;});
  state.scene?.setBounds(recipe.cells);state.scene?.sync(recipe.stones);state.scene?.resetCamera(recipe.cells);
  renderSelected();refreshCount();
 }
 function confirmDiscard(){return !state.dirty||window.confirm('Есть изменения без серверного сохранения. Продолжить? Авточерновик останется в этом браузере.');}
 async function refreshList(){
  try{
   const all=await listSections();
   const select=$('[data-sections]');select.innerHTML='<option value="">Новая секция</option>'+all.map(row=>`<option value="${escapeHTML(row.id)}">${escapeHTML(row.title)} · ${escapeHTML(row.status)}</option>`).join('');
   select.value=state.id||'';
  }catch(error){toast('Список секций недоступен: '+error.message,true);}
 }
 async function save(status){
  if(state.busy||!state.library)return;
  state.busy=true;$('[data-action="save"]').disabled=true;$('[data-action="ready"]').disabled=true;toast('Сохраняем координаты на сервере…');
  const record=copy(state.recipe);record.libraryVersion=state.library.manifest.version;record.librarySha256=state.library.manifest.glbSHA256;
  const savingRevision=state.mutationRevision;
  try{
   const saved=await saveSection({id:state.id,title:state.title,status,cells:record.cells,recipe:record},state.library.manifest);
   state.id=saved.id;state.status=status;
   if(savingRevision===state.mutationRevision){state.recipe=record;state.dirty=false;clearLocalScratch();
    toast(status==='ready'?'Секция готова к согласованию. Координаты сохранены.':'Черновик сохранён в Supabase.');}
   else {toast('Сохранена предыдущая версия; есть новые изменения — сохраните ещё раз.');}
   refreshCount();await refreshList();
  }catch(error){toast('Не сохранено: '+error.message,true);}
  finally{state.busy=false;$('[data-action="save"]').disabled=false;$('[data-action="ready"]').disabled=false;}
 }
 function undo(){
  if(!state.history.length)return;
  state.future.push(copy(state.recipe));state.recipe=state.history.pop();
  if(state.selected&&!state.recipe.stones.some(s=>s.id===state.selected))state.selected=null;
  syncScene();scheduleScratch();
 }
 function redo(){
  if(!state.future.length)return;
  state.history.push(copy(state.recipe));state.recipe=state.future.pop();
  syncScene();scheduleScratch();
 }
 function renderCategories(){
  $('[data-categories]').innerHTML=CATEGORIES.map(c=>`<button type="button" data-category="${c.key}" aria-pressed="${c.key===state.category}">${c.label} · ${c.count}</button>`).join('');
 }
 function renderCatalog(){
  if(!state.library)return;
  renderCategories();
  const items=state.library.manifest.models.filter(m=>m.category===state.category&&(!state.search||m.name.toLowerCase().includes(state.search)));
  const PAGE=16,pages=Math.max(1,Math.ceil(items.length/PAGE));state.page=Math.min(state.page,pages-1);
  const visible=items.slice(state.page*PAGE,(state.page+1)*PAGE);
  $('[data-stones]').innerHTML=visible.map(m=>`<button type="button" class="masonryStone" data-add-stone="${escapeHTML(m.name)}" aria-label="Добавить ${escapeHTML(m.name)}">
   <img loading="lazy" data-thumb="${escapeHTML(m.name)}" alt="" width="76" height="57">
   <span>${escapeHTML(m.name)}<small>${Array.isArray(m.sizeMeters)?m.sizeMeters.map(v=>Math.round(v*100)).join('×')+' см':''}</small></span>
   <span class="masonryPlus">＋</span></button>`).join('');
  $('[data-pages]').textContent=`${state.page+1} / ${pages}`;
  $('[data-page-count]').textContent=`${items.length} моделей`;
  for(const img of root.querySelectorAll('[data-thumb]')){
   // Render real GLB geometry, never an invented icon in place of a rock.
   const url=state.scene?.thumbnail(img.dataset.thumb);
   if(url)img.src=url;
  }
 }
 const handleClick=async e=>{
  if(state.disposed||!state.library)return;
  const category=e.target.closest('[data-category]');
  if(category){state.category=category.dataset.category;state.page=0;renderCatalog();return;}
  const add=e.target.closest('[data-add-stone]');if(add){addStone(add.dataset.addStone);return;}
  const move=e.target.closest('[data-nudge]');if(move){const [a,d]=move.dataset.nudge.split(':');nudge(a,Number(d));return;}
  const rotateButton=e.target.closest('[data-rotate]');if(rotateButton){const [a,d]=rotateButton.dataset.rotate.split(':');rotate(a,Number(d));return;}
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(!action)return;
  switch(action){
   case 'new':{
    if(!confirmDiscard())return;
    clearLocalScratch();setRecipe({...makeRecipe(state.recipe.cells),libraryVersion:state.library.manifest.version,librarySha256:state.library.manifest.glbSHA256});
    await refreshList();toast('Новая секция');break;
   }
   case 'save':await save('draft');break;
   case 'ready':await save('ready');break;
   case 'undo':undo();break;
   case 'redo':redo();break;
   case 'duplicate':{
    const s=state.recipe.stones.find(x=>x.id===state.selected);if(s){const cloned=copy(s);cloned.id=uuid();cloned.position[0]=num(cloned.position[0]+.03);putStone(cloned);}break;
   }
   case 'delete':{
    if(state.selected){commitBefore();state.recipe.stones=state.recipe.stones.filter(s=>s.id!==state.selected);state.selected=null;syncScene();scheduleScratch();}break;
   }
   case 'catalog':{
    const el=$('[data-catalog]');el.hidden=!el.hidden;
    e.target.textContent=el.hidden?'Каталог ▸':'Каталог ▾';break;
   }
   case 'bounds':{
    const button=$('[data-action="bounds"]');const next=button.getAttribute('aria-pressed')!=='true';
    button.setAttribute('aria-pressed',String(next));state.scene.setGhostVisible(next);break;
   }
   case 'camera':state.scene.resetCamera(state.recipe.cells);break;
   case 'export':{
    try{validateRecipe(state.recipe,state.library.manifest);downloadRecipe({title:state.title,recipe:state.recipe});toast('Экспортирован JSON с точными координатами');}
    catch(error){toast(error.message,true);}break;
   }
   case 'prev':state.page=Math.max(0,state.page-1);renderCatalog();break;
   case 'next':state.page+=1;renderCatalog();break;
   case 'apply-size':updateSize([0,1,2].map(i=>Number($(`[data-cell="${i}"]`)?.value)));break;
  }
 };
 root.addEventListener('click',handleClick,{signal});
 root.addEventListener('change',async e=>{
  const t=e.target;if(!state.library)return;
  if(t.matches('[data-pos]')){
   const idx=Number(t.dataset.pos);if(!editSelected('position',idx,Number(t.value)))toast('Недопустимая координата',true);return;
  }
  if(t.matches('[data-scale]')){
   const idx=Number(t.dataset.scale);if(!editSelected('scale',idx,Number(t.value)))toast('Масштаб: от 0,01 до 20',true);return;
  }
  if(t.matches('[data-axis]')){state.scene.setAxis(t.value);return;}
  if(t.matches('[data-preset]')){
   if(t.value==='custom'){$('[data-custom]').hidden=false;return;}
   updateSize(t.value.split(',').map(Number));return;
  }
  if(t.matches('[data-sections]')){
   if(!t.value)return;
   if(!confirmDiscard()){t.value=state.id||'';return;}
   try{
    toast('Открываем сохранённую секцию…');
    const row=await loadSection(t.value);
    setRecipe(row.recipe,{id:row.id,title:row.title,status:row.status});
    clearLocalScratch();toast('Загружено: '+row.title);
   }catch(error){toast('Ошибка загрузки: '+error.message,true);}return;
  }
 },{signal});
 root.addEventListener('input',e=>{
  if(e.target.matches('[data-search]')){state.search=e.target.value.trim().toLowerCase();state.page=0;renderCatalog();}
  if(e.target.matches('[data-title]')){state.title=e.target.value;scheduleScratch();}
 },{signal});
 const onKey=e=>{
  if(state.disposed||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){
   e.preventDefault();if(e.shiftKey)redo();else undo();return;
  }
  if((e.key==='Delete'||e.key==='Backspace')&&state.selected){
   e.preventDefault();root.querySelector('[data-action="delete"]')?.click();
  }
 };
 window.addEventListener('keydown',onKey,{signal});
 const onRevoked=e=>{if(!e.detail?.enabled)context.router.replace('practice.home');};
 window.addEventListener('alantil:activity-access',onRevoked,{signal});
 const unsubscribe=subscribeToAuth(auth=>{
  if(auth.ready&&!auth.user?.id)context.router.replace('practice.home');
 });
 state.unsubscribe=unsubscribe;
 try{
  const library=await loadCommon100({signal});
  if(state.disposed)return;
  state.library=library;
  state.recipe.libraryVersion=library.manifest.version;state.recipe.librarySha256=library.manifest.glbSHA256;
  state.scene=createMasonryScene($('[data-canvas]'),{
   models:library.manifest.models,geometries:library.geometries,
   onSelect:id=>{state.selected=id;renderSelected();},
   onDragStart:()=>commitBefore(),
   onTransform:updateStone,
  });
  state.scene.setBounds(state.recipe.cells);state.scene.resetCamera(state.recipe.cells);
  const backup=readLocalScratch();
  if(backup?.recipe){
   try{setRecipe(backup.recipe,{id:backup.id,title:backup.title,status:backup.status,dirty:true});toast('Авточерновик восстановлен на этом устройстве');}
   catch(error){console.warn('Masonry scratch incompatible',error);}
  }
  renderCatalog();renderSelected();refreshCount();
  $('[data-loading]').hidden=true;
  if(!backup?.recipe)toast('Выберите камень из каталога · свободное размещение без ограничений');
  await refreshList();
 }catch(error){
  if(state.disposed)return;
  console.error('Manual masonry editor failed',error);
  $('[data-loading]').textContent=(state.library?'Не удалось запустить 3D-редактор: ':'Не удалось загрузить оригинальные 100 камней: ')+error.message;
  toast(state.library?'Ошибка запуска 3D-редактора':'Ошибка загрузки библиотеки Common 100',true);
 }
}
export function canLeave(){return !active?.dirty;}
export function getLeaveMessage(){return 'Вы хотите выйти из редактора? Несохранённые на сервере изменения останутся в локальном авточерновике.';}
export function unmount(){
 if(!active)return;
 const state=active;active=null;state.disposed=true;clearTimeout(state.timer);
 if(state.dirty)saveLocalScratch({id:state.id,title:state.title,status:state.status,recipe:state.recipe});
 state.controller.abort();state.unsubscribe?.();state.scene?.dispose();
 state.context.shell.appShell.dataset.feature='';
}
