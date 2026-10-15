/** AlanTil 17.5.2 WebGL integration: compact UI, server persistence mock, selection.
 * Transaction/isolation assertions run separately against PostgreSQL in CI.
 */
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
   export function towerUserId(){return '11111111-1111-4111-8111-111111111111'}
   export async function loadTower(){return {elements:[],silver:95,gold:10,revision:3}}
   export async function loadTowerV2(){return {format:2,elements:[],silver:95,gold:10,revision:3}}
   function current(){return JSON.parse(localStorage.getItem('__QA_REMOTE_V3')||'{"format":3,"revision":0,"elements":[]}')}
   export async function loadTowerV3(){return current()}
   export async function mutateTowerV3(operation){
    const old=current();if(operation.revision!==old.revision)throw Error('REVISION_CONFLICT');
    let next;
    if(operation.action==='place')next=[...old.elements,operation.section];
    else if(operation.action==='remove')next=old.elements.filter(x=>x.id!==operation.sectionId);
    else throw Error('UNKNOWN_ACTION');
    const result={format:3,revision:old.revision+1,elements:next};
    localStorage.setItem('__QA_REMOTE_V3',JSON.stringify(result));return result;
   }
  `}));
  await page.route('**/prefab-tower-fixture*',r=>r.fulfill({contentType:'text/html',body:`
   <meta name="viewport" content="width=device-width,initial-scale=1">
   <link rel="stylesheet" href="/src/shared/styles/app.css">
   <link rel="stylesheet" href="/src/features/tower/tower.css">
   <div class="appShell" id="app-shell"><div class="appViewport"><div class="appScreenHost"><main id="root"></main></div></div></div>
   <script type="module">import {mount} from '/src/features/tower/index.js?v=17.5.2';mount({root:document.getElementById('root'),shell:{setHeaderContent(){},appShell:document.getElementById('app-shell')}});</script>`}));
  await new Promise(resolve=>setTimeout(resolve,300));
  await page.goto('http://127.0.0.1:8784/prefab-tower-fixture');
  await page.waitForSelector('.towerCanvas[data-ready="true"]',{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.prefabReady==='true',{timeout:45000});
  assert.equal(await page.locator('.towerItem').count(),6);
  assert.equal(await page.locator('[data-section-id="window-4x5x2"]').count(),1);
  assert.equal(await page.locator('.towerGame').getAttribute('data-mode'),'idle');
  assert.equal(await page.locator('[data-placement]').isVisible(),false);
  assert.equal(await page.locator('[data-side]').evaluate(x=>x.classList.contains('is-open')),true);
  assert.equal(await page.locator('[data-hammer]').count(),1);
  assert.equal(await page.locator('[data-draft-notice]').count(),0);
  await page.locator('[data-section-id="2x2x2"]').click();
  assert.equal(await page.locator('[data-variant]').count(),1);
  assert.equal(await page.locator('.towerGame').getAttribute('data-mode'),'placing');
  assert.equal(await page.locator('[data-side]').evaluate(x=>x.classList.contains('is-open')),false);
  assert.equal(await page.locator('[data-placement] .towerIconAction').count(),4);
  // The camera may target a legacy stone or the horizon. Explicitly touch
  // the unobstructed ground in the test if the default proposal is invalid.
  if(await page.locator('[data-confirm]').isDisabled()){
   const rect=await page.locator('.towerCanvas canvas').boundingBox();
   for(const [dx,dy] of [[.51,.61],[.5,.53],[.42,.65],[.56,.7]]){
    await page.mouse.click(rect.x+rect.width*dx,rect.y+rect.height*dy);
    if(!(await page.locator('[data-confirm]').isDisabled()))break;
   }
  }
  await page.waitForFunction(()=>!document.querySelector('[data-confirm]')?.disabled,{timeout:12000});
  await page.locator('[data-confirm]').click();
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.prefabCount==='1'&&
   document.querySelector('.towerGame')?.dataset.mode==='idle',{timeout:40000});
  let snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('__QA_REMOTE_V3')));
  assert.equal(snapshot.revision,1);
  assert.equal(snapshot.elements.length,1);
  assert.equal(snapshot.elements[0].geometryVersion,'17.5.2');
  assert.ok([snapshot.elements[0].x,snapshot.elements[0].y,snapshot.elements[0].z].every(Number.isInteger));
  assert.equal(await page.evaluate(()=>localStorage.getItem('alantil_tower_prefab_draft_17_4_11111111-1111-4111-8111-111111111111')),null);
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.prefabCount==='1',{timeout:40000});
  // In normal mode, tapping a visible section selects the whole prepared object.
  const rect=await page.locator('.towerCanvas canvas').boundingBox();
  for(const [dx,dy] of [[.5,.52],[.5,.45],[.48,.55],[.53,.55]]){
   await page.mouse.click(rect.x+rect.width*dx,rect.y+rect.height*dy);
   if(await page.locator('.towerGame').getAttribute('data-mode')==='selected')break;
  }
  assert.equal(await page.locator('.towerGame').getAttribute('data-mode'),'selected','Tap must select an installed section');
  assert.equal(await page.locator('[data-remove]').isVisible(),true);
  await page.locator('[data-remove]').click();
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.prefabCount==='0',{timeout:30000});
  snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('__QA_REMOTE_V3')));
  assert.equal(snapshot.elements.length,0);
  assert.equal(snapshot.revision,2);
  assert.equal(await page.locator('[data-side]').evaluate(x=>x.classList.contains('is-open')),true);
  // Integration regression: the authored vertical window is a first-class
  // sixteenth-century stone prefab, not a generated masonry cuboid. Its one
  // variant, 90-degree rotation, GLB preview, V3 save and reload must work.
  await page.locator('[data-section-id="window-4x5x2"]').click();
  assert.equal(await page.locator('[data-variant]').isVisible(),false);
  assert.equal(await page.locator('.towerGame').getAttribute('data-mode'),'placing');
  if(await page.locator('[data-confirm]').isDisabled()){
   const area=await page.locator('.towerCanvas canvas').boundingBox();
   for(const [dx,dy] of [[.50,.61],[.50,.53],[.42,.65],[.56,.70],[.60,.56]]){
    await page.mouse.click(area.x+area.width*dx,area.y+area.height*dy);
    if(!(await page.locator('[data-confirm]').isDisabled()))break;
   }
  }
  await page.waitForFunction(()=>!document.querySelector('[data-confirm]')?.disabled,{timeout:30000});
  await page.locator('[data-rotate]').click();
  await page.waitForFunction(()=>!document.querySelector('[data-confirm]')?.disabled,{timeout:30000});
  await page.locator('[data-confirm]').click();
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.prefabCount==='1' &&
   document.querySelector('.towerGame')?.dataset.mode==='idle',{timeout:45000});
  let windowSnapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('__QA_REMOTE_V3')));
  assert.equal(windowSnapshot.elements.length,1);
  assert.equal(windowSnapshot.elements[0].sectionId,'window-4x5x2');
  assert.equal(windowSnapshot.elements[0].geometryVersion,'17.6-window.1');
  assert.equal(windowSnapshot.elements[0].variant,0);
  assert.equal(windowSnapshot.elements[0].rotation,1);
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.prefabCount==='1', {timeout:45000});
  assert.equal(await page.locator('.towerCanvas').getAttribute('data-prefab-joint-errors'),'0');
  windowSnapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('__QA_REMOTE_V3')));
  assert.equal(windowSnapshot.elements[0].sectionId,'window-4x5x2');
  // Next test scene below is independent from user data: server is mocked.
  // After testing create/reload/select/delete, render a PREPARED natural-rock
  // wall with corner and upper course as real WebGL visual evidence. This test
  // mock never writes to a user's Supabase account or their tower draft.
  await page.evaluate(()=>{
   const make=(id,x,y,z,variant)=>({id,type:'masonry_section',sectionId:'2x2x2',
    variant,rotation:0,x,y,z,geometryVersion:'17.5.2'});
   localStorage.setItem('__QA_REMOTE_V3',JSON.stringify({format:3,revision:3,elements:[
    make('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',2,0,2,0),
    make('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',4,0,2,1),
    make('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',2,0,4,2),
    make('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',2,2,2,1)
   ]}));
  });
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.prefabCount==='4'&&
   Number(document.querySelector('.towerCanvas')?.dataset.prefabJointTiles)>=8,{timeout:45000});
  assert.equal(await page.locator('.towerCanvas').getAttribute('data-prefab-joint-errors'),'0');
  await page.screenshot({path:path.join(evidence,'prefab-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('.towerCanvas').getAttribute('data-prefab-count'),'4');
  await page.screenshot({path:path.join(evidence,'prefab-mobile.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(responses,[]);
  console.log('TOWER_PREFAB_17_5_1_BROWSER_QA',JSON.stringify({revision:snapshot.revision,sections:snapshot.elements.length,webgl:true,selection:true,serverMock:true,noDraft:true}));
 }finally{await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1});