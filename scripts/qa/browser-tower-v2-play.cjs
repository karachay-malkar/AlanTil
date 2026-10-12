/** Actual V2 opt-in frontend with an isolated server-shaped RPC stub.
 * PostgreSQL tests independently validate authority, payments and ownership. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const output=process.env.ALANTIL_TOWER_QA_OUTPUT||'/tmp/alantil-tower-v2';
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=cp.spawn('python3',['-m','http.server','8771','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:820}});
  const errors=[],rpc=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text())});
  await page.route('**/src/features/tower/repository.js*',r=>r.fulfill({contentType:'text/javascript',body:`
   export function towerUserId(){return 'fixture-v2-play'}
   export async function loadTower(){throw Error('V1_RPC_USED_IN_V2')}
   export async function mutateTower(){globalThis.__MUTATED=true;throw Error('V1_MUTATION_USED_IN_V2')}
   function store(){return JSON.parse(sessionStorage.getItem('v2-test')||'{"format":2,"elements":[],"silver":100,"gold":10,"revision":0}')}
   export async function loadTowerV2(){return store()}
   export async function loadTowerV2Geometry(){
    const state=store();
    const [{ROCK_PACK},{originalRockMesh},{bodyForTowerBlock}]=await Promise.all([
     import('/assets/tower/processed-rocks.mjs'),
     import('/packages/tower-game/rock-shapes.mjs'),
     import('/packages/tower-game/stone-mesh-adapter.mjs')
    ]);
    return {format:2,geometryVersion:1,revision:state.revision,bodies:state.elements.map(b=>{
     const kind=b.type==='stone'?'small':b.type;
     const mesh=originalRockMesh(ROCK_PACK[kind][b.variant],b.variant);
     const body=bodyForTowerBlock(mesh,b);
     return {id:b.id,v:body.vertices,f:body.mesh.faces};
    })};
   }
   export async function mutateTowerV2(op){
    const state=store();if(op.revision!==state.revision)throw Error('REVISION_CONFLICT');
    if(op.action==='place'){
      if(!Number.isFinite(op.element?.x)||Number.isInteger(op.element.x))throw Error('V2_COORDS_NOT_FREE');
      state.elements.push({...op.element,paidCurrency:op.currency,paidAmount:4});state.silver-=4;
    }else if(op.action==='remove')state.elements=state.elements.filter(x=>x.id!==op.elementId);
    else throw Error('INVALID_ACTION');
    state.revision++;sessionStorage.setItem('v2-test',JSON.stringify(state));return state;
   }
  `}));
  await page.route('**/tower-v2-fixture*',r=>r.fulfill({contentType:'text/html',body:`
   <meta name="viewport" content="width=device-width,initial-scale=1">
   <link rel="stylesheet" href="/src/shared/styles/app.css">
   <link rel="stylesheet" href="/src/features/tower/tower.css">
   <style>body{margin:0}#root{width:100%}</style>
   <div class="appShell" id="app-shell"><div class="appViewport"><div class="appScreenHost"><main id="root"></main></div></div></div>
   <script type="module">import {mount} from '/src/features/tower/index.js';mount({root:document.getElementById('root'),shell:{setHeaderContent(){},appShell:document.getElementById('app-shell')}});</script>
  `}));
  await new Promise(r=>setTimeout(r,500));
  await page.goto('http://127.0.0.1:8771/tower-v2-fixture?tower_v2_play=1');
  await page.waitForSelector('.towerCanvas[data-ready="true"]',{timeout:30000});
  assert.match(await page.locator('.towerV2Notice').innerText(),/отдельное сохранение/);
  assert.equal(await page.locator('[data-tower-mode="classic"]').getAttribute('href'),'/tower-v2-fixture');
  try{await page.waitForFunction(()=>document.querySelector('.towerStatus')?.textContent?.includes('Предварительная проверка пройдена'),{timeout:14000});}catch(e){
   const debug=await page.evaluate(()=>({ready:document.querySelector('.towerCanvas')?.dataset.ready,status:document.querySelector('.towerStatus')?.textContent,kind:document.querySelector('.towerStatus')?.dataset.kind,values:[...document.querySelectorAll('[data-position]')].map(x=>x.value),visible:!document.querySelector('[data-confirm]')?.hidden,workerNotice:document.querySelector('.towerV2Notice')?.textContent}));
   console.error('V2_DEBUG_FAILURE',JSON.stringify({debug,errors}));
   await page.screenshot({path:path.join(output,'tower-v2-debug-failure.png')});throw e;
  }
  const info=await page.evaluate(()=>({text:document.querySelector('[data-confirm]')?.textContent,disabled:document.querySelector('[data-confirm]')?.disabled,coords:[...document.querySelectorAll('[data-position]')].map(x=>Number(x.value)),webgl:!!document.querySelector('canvas')?.getContext('webgl2'),contextLost:document.querySelector('.towerCanvas').dataset.contextLost||null,statusKind:document.querySelector('.towerStatus').dataset.kind}));
  assert.equal(info.disabled,false,'V2 user may save after real-mesh preview');
  assert.equal(info.webgl,true,'WebGL2 must be available in CI');
  assert.equal(info.statusKind,'info','Supported V2 proposal must not be styled as an error');
  assert(info.coords.some(c=>!Number.isInteger(c)),'Real-mesh placement must not snap to grid');
  assert(info.coords.every(Number.isFinite));
  assert.equal(await page.evaluate(()=>Boolean(globalThis.__MUTATED)),false);
  await page.locator('[data-confirm]').evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelector('[data-silver]')?.textContent==='96',{timeout:30000});
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('v2-test')).elements.length),1);
  assert.equal(await page.evaluate(()=>Boolean(globalThis.__MUTATED)),false);
  await page.screenshot({path:path.join(output,'tower-v2-play-1200.png')});
  // Reload a server-shaped V2 snapshot with actual side-by-side authored
  // stones. Worker must fill only their real measured gap using source pebbles.
  await page.evaluate(()=>{
   const state=JSON.parse(sessionStorage.getItem('v2-test'));
   state.elements=[
    {id:'qa-real-stone-a',type:'medium',x:20,y:0,z:20,sx:2,sy:1,sz:1,rotation:0,variant:0,paidCurrency:'silver',paidAmount:4},
    {id:'qa-real-stone-b',type:'medium',x:22.1,y:0,z:20,sx:2,sy:1,sz:1,rotation:0,variant:0,paidCurrency:'silver',paidAmount:4}
   ];
   state.revision=9;state.silver=92;
   sessionStorage.setItem('v2-test',JSON.stringify(state));
   document.querySelector('[data-refresh]').click();
  });
  try{
   await page.waitForFunction(()=>{const el=document.querySelector('.towerCanvas');return el?.dataset.masonryReady==='true'&&Number(el.dataset.masonryFragments)>0&&Number(el.dataset.masonryFittedVertices)>0;},null,{timeout:13000});
  }catch(e){
   const state=await page.evaluate(()=>({
    ready:document.querySelector('.towerCanvas')?.dataset.ready,
    data:{...document.querySelector('.towerCanvas')?.dataset},
    selected:document.querySelector('.towerSelected')?.textContent,
    status:document.querySelector('.towerStatus')?.textContent,
    snapshot:sessionStorage.getItem('v2-test')?.slice(0,800)
   }));
   console.error('STAGE5_V2_JOINT_FAILURE',JSON.stringify({state,errors,warnings}));
   await page.screenshot({path:path.join(output,'tower-v2-play-debug.png')});
   throw e;
  }
  assert.equal(await page.locator('.towerCanvas').getAttribute('data-masonry-server-verified'),'true','A current PostgreSQL geometry manifest is required before cosmetic joints');
  const quality=await page.locator('.towerCanvas').evaluate(el=>({
   sourceOnly:el.dataset.masonrySourceOnly,
   fragments:Number(el.dataset.masonryFragments),
   fittedVertices:Number(el.dataset.masonryFittedVertices),
   windingRepaired:Number(el.dataset.repairedWinding),
   mortarVolume:Number(el.dataset.masonryMortarVolume),
   gapJoints:Number(el.dataset.masonryJoints)
  }));
  assert.equal(quality.sourceOnly,'true','Only authored source rocks may fill V2 gaps');
  assert(quality.fragments>0&&quality.gapJoints>0);
  assert(quality.fittedVertices>0,'Measured neighboring source stones should adapt');
  assert.equal(quality.mortarVolume,0,'No procedural mortar in V2');
  assert.equal(quality.windingRepaired,3,'Three long rock variants must have repaired display winding');
  await page.screenshot({path:path.join(output,'tower-v2-authored-joint-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(output,'tower-v2-authored-joint-mobile390.png')});
  // Mobile heavy saved snapshot: 50 genuine sourced rock meshes, no invented
  // filler where pairs are physically distant. This is render QA, not a save.
  await page.evaluate(()=>{
   const state=JSON.parse(sessionStorage.getItem('v2-test'));
   state.elements=Array.from({length:50},(_,i)=>({
    id:'test-stone-'+i,type:'medium',x:2+(i%7)*7,y:0,z:2+Math.floor(i/7)*7,
    sx:2,sy:1,sz:1,rotation:0,variant:i%5,paidCurrency:'silver',paidAmount:4
   }));state.revision=51;state.silver=100;
   sessionStorage.setItem('v2-test',JSON.stringify(state));
   document.querySelector('[data-refresh]').click();
  });
  await page.waitForFunction(()=>{
   const el=document.querySelector('.towerCanvas');
   return el?.dataset.masonryServerVerified==='true'&&el?.dataset.masonryReady==='true'&&el?.dataset.masonrySourceOnly==='true'&&el?.dataset.masonryFragments==='0';
  },{timeout:30000});
  /* certificate version and the source-only infill cannot be bypassed */
  assert.equal(await page.locator('.towerCanvas').getAttribute('data-masonry-server-verified'),'true');
  /* Original function below retained for its diagnostics */
  await page.waitForFunction(()=>{
   const el=document.querySelector('.towerCanvas');
   return el?.dataset.masonryReady==='true'&&el?.dataset.masonrySourceOnly==='true'&&el?.dataset.masonryFragments==='0';
  },{timeout:30000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(output,'tower-v2-50-stones-mobile390.png')});
  assert.deepEqual(errors,[],'No JS exceptions');
  console.log('TOWER_V2_PLAY_BROWSER_QA',JSON.stringify({...info,quality}));
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
