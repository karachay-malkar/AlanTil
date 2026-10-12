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
  const errors=[],rpc=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/src/features/tower/repository.js*',r=>r.fulfill({contentType:'text/javascript',body:`
   export function towerUserId(){return 'fixture-v2-play'}
   export async function loadTower(){throw Error('V1_RPC_USED_IN_V2')}
   export async function mutateTower(){globalThis.__MUTATED=true;throw Error('V1_MUTATION_USED_IN_V2')}
   function store(){return JSON.parse(sessionStorage.getItem('v2-test')||'{"format":2,"elements":[],"silver":100,"gold":10,"revision":0}')}
   export async function loadTowerV2(){return store()}
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
  assert.match(await page.locator('.towerV2Notice').innerText(),/сохранение V2/);
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
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(output,'tower-v2-play-mobile390.png')});
  assert.deepEqual(errors,[],'No JS exceptions');
  console.log('TOWER_V2_PLAY_BROWSER_QA',JSON.stringify(info));
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
