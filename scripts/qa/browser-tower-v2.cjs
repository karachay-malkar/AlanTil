/** Read-only 17.1 gridless 3D preview integration test. Runs in CI Chromium.
 * No Supabase network calls; original wallet operations are strictly forbidden.
 */
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
   export function towerUserId(){return 'fixture-v2-readonly'}
   export async function loadTower(){return {elements:[],silver:100,gold:10,revision:0}}
   export async function mutateTower(){globalThis.__MUTATED=true;throw Error('V2 preview attempted a mutation')}
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
  await page.goto('http://127.0.0.1:8771/tower-v2-fixture?tower_v2_preview=1');
  await page.waitForSelector('.towerCanvas[data-ready="true"]',{timeout:30000});
  assert.match(await page.locator('.towerV2Notice').innerText(),/без сохранения/);
  await page.waitForFunction(()=>document.querySelector('.towerStatus')?.textContent?.includes('Расчётная опора подтверждена'),{timeout:25000});
  const info=await page.evaluate(()=>({text:document.querySelector('[data-confirm]')?.textContent,disabled:document.querySelector('[data-confirm]')?.disabled,coords:[...document.querySelectorAll('[data-position]')].map(x=>Number(x.value)),webgl:!!document.querySelector('canvas')?.getContext('webgl2'),contextLost:document.querySelector('.towerCanvas').dataset.contextLost||null}));
  assert(info.disabled,'Save must remain disabled');
  assert(info.coords.some(c=>!Number.isInteger(c)),'Real-mesh placement must not snap to grid');
  assert(info.coords.every(Number.isFinite));
  assert.equal(await page.evaluate(()=>Boolean(globalThis.__MUTATED)),false);
  await page.locator('[data-confirm]').evaluate(el=>el.click());
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>Boolean(globalThis.__MUTATED)),false);
  await page.screenshot({path:path.join(output,'tower-v2-gridless-1200.png')});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(output,'tower-v2-gridless-mobile390.png')});
  assert.deepEqual(errors,[],'No JS exceptions');
  console.log('TOWER_V2_BROWSER_QA',JSON.stringify(info));
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
