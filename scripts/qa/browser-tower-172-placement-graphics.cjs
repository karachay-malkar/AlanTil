const {chromium}=require('playwright');
const {spawn}=require('node:child_process');const path=require('node:path');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:8838';
(async()=>{
 const server=spawn('python3',['-m','http.server','8838','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const requested=[],errors=[];page.on('request',r=>{if(/BalkariaStone_/.test(r.url()))requested.push(r.url())});page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/src/features/tower/repository.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:`
   export const towerUserId=()=> 'dfcf124e-735b-4caa-81d2-99eb5f02218d';
   import {APPROVED_PREFAB_VERSION} from '../../../packages/tower-game/approved-prefab.mjs';
   import {validatePrefabPlacement} from '../../../packages/tower-game/prefab-layout.mjs';
   window.qaConstruction={revision:0,elements:[{id:'00000000-0000-4000-8000-000000000010',
    type:'masonry_section',sectionId:'2x2x2',variant:0,rotation:0,
    x:12,y:0,z:12,geometryVersion:APPROVED_PREFAB_VERSION}],saves:[]};
   const snapshot=()=>({format:3,revision:window.qaConstruction.revision,
    elements:[...window.qaConstruction.elements],resetAt:null,tekmetBalance:1000});
   export const loadTowerV3=async()=>snapshot();
   export const loadTowerRoofs=async()=>({roofs:[],balance:1000});
   export const mutateTowerV3=async({revision,action,section})=>{
    if(action!=='place'||revision!==window.qaConstruction.revision)throw Error('INVALID_OPERATION');
    const valid=validatePrefabPlacement(window.qaConstruction.elements,section);
    if(!valid.ok)throw Error('INVALID_PLACEMENT: '+valid.reason);
    window.qaConstruction.saves.push(section);
    window.qaConstruction.elements.push(section);window.qaConstruction.revision++;
    return snapshot();
   };
   export const placeTowerLine=async()=>{throw Error('not exercised')};
   export const removeTowerV3Sections=async()=>{throw Error('not exercised')};
   export const clearTowerV3=async()=>{throw Error('not exercised')};
   export const placeTowerRoof=async()=>{throw Error('not exercised')};
   export const removeTowerRoof=async()=>{throw Error('not exercised')};
  `}));
  await page.route(url=>url.pathname==='/src/features/tower/prefab-scene.js'&&url.searchParams.has('v'),
   route=>route.fulfill({status:200,contentType:'text/javascript',body:`
    import {createTowerScene as original} from './prefab-scene.js?placement-real-scene';
    export async function createTowerScene(container,callbacks){
     const scene=await original(container,callbacks);
     window.qaTowerPick=callbacks.onPick;window.qaTowerScene=scene;return scene;
    }
   `}));
  await new Promise(r=>setTimeout(r,500));
  await page.goto(base+'/tests/fixtures/tower-172-placement-graphics.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>['true','error'].includes(document.body.dataset.ready),null,{timeout:120000});
  if(await page.locator('body').getAttribute('data-ready')!=='true')throw Error('Mount failed '+await page.locator('body').getAttribute('data-error'));
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.stoneTextureEncoding?.includes('png-1k'),null,{timeout:120000});
  await page.locator('[data-hammer]').click();
  await page.locator('[data-section-id="1x1x1"]').click();
  if(!await page.locator('[data-nudge]').isVisible())throw Error('Grid nudge toolbar missing');
  for(const direction of ['up','right','down','left'])await page.locator('[data-nudge-direction="'+direction+'"]').click();
  if((await page.locator('.towerGame').getAttribute('data-mode'))!=='placing')throw Error('Nudge exited placement');
  await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.prefabCount==='1'&&
   typeof window.qaTowerPick==='function',null,{timeout:120000});
  // Exercise the real HUD + validator + 3D ghost with a deterministic hit on
  // the TOP logical face. This uses a seeded 3D source block, not a fake cube.
  await page.evaluate(()=>window.qaTowerPick({
   block:window.qaConstruction.elements[0],normal:{x:0,y:1,z:0},position:[3.25,.5,3.25]
  }));
  await page.waitForFunction(()=>{
   const c=document.querySelector('[data-confirm]');
   return c?.dataset.valid==='true'&&!c.disabled;
  },null,{timeout:90000});
  await page.locator('[data-confirm]').click();
  await page.waitForFunction(()=>window.qaConstruction.saves.length===1&&
    document.querySelector('.towerGame')?.dataset.mode==='placing',null,{timeout:90000});
  const placed=await page.evaluate(()=>window.qaConstruction.saves[0]);
  if(placed.x!==13||placed.y!==2||placed.z!==13)
   throw Error('Top-face grid placement penetrated a saved section: '+JSON.stringify(placed));
  // A side hit above ground but without an underlying foundation must remain
  // a red/disabled placement, not get magnetically moved inside the block.
  await page.evaluate(()=>window.qaTowerPick({
   block:window.qaConstruction.elements[0],normal:{x:1,y:0,z:0},position:[3.5,.25,3.25]
  }));
  await page.waitForFunction(()=>document.querySelector('[data-confirm]')?.dataset.valid==='false',
   null,{timeout:90000});
  if(!await page.locator('[data-confirm]').isDisabled())
   throw Error('Unsupported side placement remained confirmable');
  if(!requested.some(url=>url.includes('_1K.png')))throw Error('Mobile did not fetch native 1K maps');
  if(requested.some(url=>url.includes('_2K.')))throw Error('Mobile fetched 2K maps '+requested);
  if(errors.length)throw Error('Browser errors '+JSON.stringify(errors.slice(0,5)));
  console.log('TOWER_172_MOBILE_GRAPHICS_BROWSER_PASS',JSON.stringify({texture:'1K PNG',nudgeButtons:4,
   topFacePlaced:true,topY:2,unsupportedSideBlocked:true,requested1K:requested.length}));
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error('TOWER_172_MOBILE_GRAPHICS_BROWSER_FAILED',e.stack||String(e));process.exitCode=1});
