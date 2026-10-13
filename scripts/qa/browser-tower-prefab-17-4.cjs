/** Read-only WebGL integration QA for the single prefab editor.
 * All paid snapshots are mocked. A V1/V2/V3 wallet mutation is prohibited. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const evidence=process.env.ALANTIL_TOWER_QA_OUTPUT||'/tmp/alantil-tower-prefab';
fs.mkdirSync(evidence,{recursive:true});
(async()=>{
 const server=cp.spawn('python3',['-m','http.server','8784','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:820}});
  const errors=[],responses=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)responses.push({url:r.url(),status:r.status()});});
  await page.route('**/src/features/tower/repository.js*',r=>r.fulfill({contentType:'text/javascript',body:`
   export function towerUserId(){return 'qa-user'}
   export async function loadTower(){return {elements:[],silver:95,gold:10,revision:3}}
   export async function loadTowerV2(){return {format:2,elements:[
    {id:'paid-original',type:'medium',x:5,y:0,z:5,sx:2,sy:1,sz:1,rotation:0,variant:0,paidCurrency:'silver',paidAmount:4}
   ],silver:95,gold:10,revision:3}}
   export async function mutateTower(){globalThis.__MUTATED=true;throw Error('MUTATION_FORBIDDEN')}
   export async function mutateTowerV2(){globalThis.__MUTATED=true;throw Error('MUTATION_FORBIDDEN')}
  `}));
  await page.route('**/prefab-tower-fixture*',r=>r.fulfill({contentType:'text/html',body:`
   <meta name="viewport" content="width=device-width,initial-scale=1">
   <link rel="stylesheet" href="/src/shared/styles/app.css">
   <link rel="stylesheet" href="/src/features/tower/tower.css">
   <div class="appShell" id="app-shell"><div class="appViewport"><div class="appScreenHost"><main id="root"></main></div></div></div>
   <script type="module">import {mount} from '/src/features/tower/index.js?v=17.5.0';mount({root:document.getElementById('root'),shell:{setHeaderContent(){},appShell:document.getElementById('app-shell')}});</script>`}));
  await new Promise(done=>setTimeout(done,300));
  await page.goto('http://127.0.0.1:8784/prefab-tower-fixture');
  await page.waitForSelector('.towerCanvas[data-ready="true"]',{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.prefabReady==='true',{timeout:45000});
  assert.equal(await page.locator('.towerItem').count(),5,'Five prefab catalog sizes');
  assert.match(await page.locator('[data-variant]').innerText(),/1\/8/);
  await page.waitForFunction(()=>!document.querySelector('[data-confirm]')?.disabled,{timeout:20000});
  assert.equal(await page.locator('[data-silver]').innerText(),'95');
  const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('alantil_tower_prefab_draft_17_4_qa-user')||'{}'));
  assert.equal(initial.localDraft,undefined);
  await page.locator('[data-confirm]').click();
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.prefabCount==='1',{timeout:30000});
  let info=await page.evaluate(()=>({prefabs:Number(document.querySelector('.towerCanvas')?.dataset.prefabCount),
   draft:JSON.parse(localStorage.getItem('alantil_tower_prefab_draft_17_4_qa-user')||'{}'),
   purchases:Boolean(globalThis.__MUTATED),silver:document.querySelector('[data-silver]')?.innerText,
   webgl:!!document.querySelector('.towerCanvas canvas')?.getContext('webgl2'),
   error:document.querySelector('.towerCanvas')?.dataset.prefabError||null}));
  assert.equal(info.prefabs,1);assert.equal(info.draft.sections.length,1);assert.equal(info.draft.format,3);
  assert.ok(info.draft.sections.every(s=>[s.x,s.y,s.z].every(Number.isInteger)),'sections snap to 25-cm grid');
  assert.equal(info.draft.sections[0].geometryVersion,'17.5.0');
  assert.equal(info.purchases,false);assert.equal(info.silver,'95');assert.equal(info.webgl,true);assert.equal(info.error,null);
  // Keep the isolated paid V2 fixture intact while displaying a fully prepared
  // wall, side seam and upper course (no runtime stone-packing Worker).
  await page.evaluate(()=>{
   const key='alantil_tower_prefab_draft_17_4_qa-user',saved=JSON.parse(localStorage.getItem(key));
   const a=saved.sections[0];
   const side={...a,id:'qa-side',sectionId:'2x2x3',variant:1,x:a.x+2,y:0,z:a.z};
   const top={...a,id:'qa-top',variant:2,x:a.x,y:2,z:a.z};
   saved.sections.push(side,top);localStorage.setItem(key,JSON.stringify(saved));
  });
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.prefabCount==='3'&&
    Number(document.querySelector('.towerCanvas')?.dataset.prefabJoints)>=2,{timeout:45000});
  await page.locator('[data-tool="select"]').click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.towerItem').count(),5);
  assert.ok(await page.locator('.towerCanvas').getAttribute('data-prefab-joint-tiles')!==null);
  await page.screenshot({path:path.join(evidence,'prefab-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(evidence,'prefab-mobile.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(responses,[]);
  console.log('TOWER_PREFAB_17_4_BROWSER_QA',JSON.stringify(info));
 }finally{await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1});