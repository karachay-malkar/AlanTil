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
   export const loadTowerV3=async()=>({format:3,revision:0,elements:[],resetAt:null,tekmetBalance:1000});
   export const loadTowerRoofs=async()=>({roofs:[],balance:1000});
   export const mutateTowerV3=async()=>{throw Error('not exercised')};
   export const placeTowerLine=async()=>{throw Error('not exercised')};
   export const removeTowerV3Sections=async()=>{throw Error('not exercised')};
   export const clearTowerV3=async()=>{throw Error('not exercised')};
   export const placeTowerRoof=async()=>{throw Error('not exercised')};
   export const removeTowerRoof=async()=>{throw Error('not exercised')};
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
  if(!requested.some(url=>url.includes('_1K.png')))throw Error('Mobile did not fetch native 1K maps');
  if(requested.some(url=>url.includes('_2K.')))throw Error('Mobile fetched 2K maps '+requested);
  if(errors.length)throw Error('Browser errors '+JSON.stringify(errors.slice(0,5)));
  console.log('TOWER_172_MOBILE_GRAPHICS_BROWSER_PASS',JSON.stringify({texture:'1K PNG',nudgeButtons:4,requested1K:requested.length}));
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error('TOWER_172_MOBILE_GRAPHICS_BROWSER_FAILED',e.stack||String(e));process.exitCode=1});
