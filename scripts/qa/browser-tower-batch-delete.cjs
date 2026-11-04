/** Browser end-to-end tower batch-delete UI; RPC is an isolated test double. */
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const base='http://127.0.0.1:8827';
const ids=Array.from({length:4},(_,i)=>'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
(async()=>{
 const server=spawn('python3',['-m','http.server','8827','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/src/features/tower/repository.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:`
  export const towerUserId=()=> 'dfcf124e-735b-4caa-81d2-99eb5f02218d';
  export const loadTowerV3=async()=>({format:3,revision:window.qaRevision,elements:window.qaBlocks,resetAt:null,tekmetBalance:0});
  export const loadTowerRoofs=async()=>({roofs:[],balance:0});
  export const removeTowerV3Sections=async options=>window.qaRemove(options);
  export const mutateTowerV3=async()=>{throw Error('not exercised')};
  export const placeTowerLine=async()=>{throw Error('not exercised')};
  export const clearTowerV3=async()=>{throw Error('not exercised')};
  export const placeTowerRoof=async()=>{throw Error('not exercised')};
  export const removeTowerRoof=async()=>{throw Error('not exercised')};
  `}));
  await page.route(/\\/src\\/features\\/tower\\/prefab-scene\\.js\\?v=/,route=>route.fulfill({status:200,contentType:'text/javascript',body:`
  import {createTowerScene as real} from './prefab-scene.js?batch-delete-qa-original';
  export async function createTowerScene(container,callbacks){
   window.qaSelectBlock=callbacks.onSelection;
   const scene=await real(container,callbacks);window.qaScene=scene;return scene;
  }
  `}));
  await new Promise(r=>setTimeout(r,700));
  await page.goto(base+'/tests/fixtures/tower-batch-delete.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.qaReady==='true',null,{timeout:120000}).catch(async err=>{
   const s=await page.evaluate(()=>({ready:document.body.dataset.qaReady,error:document.body.dataset.qaError,scene:document.querySelector('.towerCanvas')?.dataset}));
   throw Error('Tower fixture failed '+JSON.stringify(s)+' errors '+JSON.stringify(errors)+' '+err);
  });
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.prefabCount==='4',null,{timeout:90000});
  await page.locator('[data-delete-mode]').click();
  const mode=await page.locator('.towerGame').getAttribute('data-mode');
  if(mode!=='multi-remove')throw Error('Delete mode did not open: '+mode);
  await page.evaluate(selected=>{for(const id of selected)window.qaSelectBlock(id)},ids.slice(0,3));
  if(await page.locator('[data-batch-count]').innerText()!=='3')throw Error('Three blocks not selected');
  if(await page.locator('.towerCanvas').getAttribute('data-batch-highlight-count')!=='3')throw Error('3D highlights missing');
  await page.evaluate(id=>window.qaSelectBlock(id),ids[1]);
  if(await page.locator('[data-batch-count]').innerText()!=='2')throw Error('Second tap failed to deselect');
  await page.evaluate(id=>window.qaSelectBlock(id),ids[1]);
  await page.evaluate(()=>{window.qaConfirm=false});
  await page.locator('[data-batch-confirm]').click();
  if((await page.evaluate(()=>window.qaRequests.length))!==0)throw Error('Confirmation cancel deleted blocks');
  if(await page.locator('[data-batch-count]').innerText()!=='3')throw Error('Cancel dropped selection');
  await page.evaluate(()=>{window.qaConfirm=true});
  await page.locator('[data-batch-confirm]').click();
  await page.waitForFunction(()=>window.qaRequests.length===1&&document.querySelector('.towerGame')?.dataset.mode==='idle',null,{timeout:90000});
  const state=await page.evaluate(()=>({
   requests:window.qaRequests,remaining:window.qaBlocks,confirmation:window.qaLastConfirmation?.message,
   highlights:document.querySelector('.towerCanvas')?.dataset.batchHighlightCount
  }));
  if(state.requests[0].sectionIds.length!==3||state.remaining.length!==1||state.remaining[0].id!==ids[3])
   throw Error('Failed atomic deletion or floating upper block lost '+JSON.stringify(state));
  if(!state.confirmation.includes('3 выбранных')||state.highlights!=='0')throw Error('Confirmation or highlight teardown failed');
  await page.locator('[data-delete-mode]').click();
  await page.evaluate(id=>window.qaSelectBlock(id),ids[3]);
  await page.locator('[data-batch-cancel]').click();
  if((await page.locator('.towerGame').getAttribute('data-mode'))!=='idle'||(await page.evaluate(()=>window.qaRequests.length))!==1)
   throw Error('Exit delete mode failed');
  if(errors.length)throw Error('Browser errors '+JSON.stringify(errors));
  console.log('TOWER_BATCH_DELETE_BROWSER_PASS',JSON.stringify({selected:3,removed:3,remaining:1,refund:true,highlight:true,cancel:true,mobile:true}));
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error('TOWER_BATCH_DELETE_BROWSER_FAILED',e.stack||String(e));process.exitCode=1});
