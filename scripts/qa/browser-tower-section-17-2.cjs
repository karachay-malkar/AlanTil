/** Read-only 17.2 section renderer verification against actual WebGL/Workers.
 * Fixtures never call production Supabase and purchases are forbidden. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const evidence='/tmp/alantil-tower-17-2-section';
fs.mkdirSync(evidence,{recursive:true});
(async()=>{
 const server=cp.spawn('python3',['-m','http.server','8772','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:820}});
  const errors=[],consoleErrors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
  await page.route('**/src/features/tower/repository.js*',route=>route.fulfill({contentType:'text/javascript',body:`
    export function towerUserId(){return 'qa-user'}
    export async function loadTower(){throw Error('LEGACY_TOWER_RPC_WAS_CALLED')}
    export async function mutateTower(){throw Error('MUTATION_FORBIDDEN')}
    export async function loadTowerV2(){return {format:2,revision:12,silver:100,gold:100,elements:[
      {id:'rock-a',type:'medium',x:8,y:0,z:8,sx:2,sy:2,sz:2,rotation:0,variant:0,paidCurrency:'silver',paidAmount:4},
      {id:'rock-b',type:'medium',x:10,y:0,z:8,sx:2,sy:2,sz:2,rotation:0,variant:1,paidCurrency:'silver',paidAmount:4},
      {id:'rock-c',type:'medium',x:8,y:0,z:10,sx:2,sy:2,sz:2,rotation:0,variant:2,paidCurrency:'silver',paidAmount:4},
      {id:'rock-d',type:'medium',x:8,y:2,z:8,sx:2,sy:2,sz:2,rotation:0,variant:3,paidCurrency:'silver',paidAmount:4}
    ]}}
    export async function mutateTowerV2(){throw Error('MUTATION_FORBIDDEN')}
  `}));
  await page.route('**/tower-section-fixture*',route=>route.fulfill({contentType:'text/html',body:`
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/src/shared/styles/app.css">
    <link rel="stylesheet" href="/src/features/tower/tower.css">
    <style>body{margin:0}#root{width:100%}</style>
    <div class="appShell" id="app-shell"><div class="appViewport"><div class="appScreenHost"><main id="root"></main></div></div></div>
    <script type="module">
      import {mount} from '/src/features/tower/index.js?v=17.2.3';
      mount({root:document.getElementById('root'),shell:{setHeaderContent(){},appShell:document.getElementById('app-shell')}});
    </script>
  `}));
  await new Promise(done=>setTimeout(done,450));
  await page.goto('http://127.0.0.1:8772/tower-section-fixture');
  await page.waitForSelector('.towerCanvas[data-ready="true"]',{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.sectionReady==='true'&&document.querySelector('.towerCanvas')?.dataset.sectionCount==='4',
    null,{timeout:90000});
  const info=await page.evaluate(()=>{
   const canvas=document.querySelector('.towerCanvas'),d=canvas.dataset;
   return {ready:d.sectionReady,error:d.sectionError||null,sections:Number(d.sectionCount),
    stones:Number(d.sectionStoneCount),joints:Number(d.sectionJointCount),
    fragments:Number(d.masonryFragments||0),masonry:d.masonryReady,
    contextLost:d.contextLost||null,
    webgl:!!canvas.querySelector('canvas')?.getContext('webgl2')};
  });
  assert.equal(info.error,null,'worker fallback is not acceptable');
  assert.equal(info.sections,4);
  assert.ok(info.stones>4,'rendered geometry must have many authored stones');
  assert.ok(info.joints>=3,'wall, corner and upper-section contact must be found');
  assert.equal(info.masonry,'true');
  assert.equal(info.contextLost,null);
  assert.equal(info.webgl,true);
  await page.screenshot({path:path.join(evidence,'section-wall-corner-upper-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:path.join(evidence,'section-wall-corner-upper-mobile.png')});
  assert.deepEqual(errors,[],'uncaught browser exceptions');
  assert.deepEqual(consoleErrors,[],'console errors');
  console.log('TOWER_SECTION_BROWSER_QA',JSON.stringify(info));
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
