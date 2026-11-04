/** Desktop/mobile full-screen orbit, pointer and construction-control WebGL QA.
 * Private owner access is mocked at fixture/auth boundary, never disabled in app. */
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs');
const mockRepository=require('./tower-owner-repository-mock.cjs');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:4173';
const out=path.join(root,'tower-first-person-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=spawn('node',['scripts/static-preview-server.mjs'],{cwd:root,stdio:'ignore'});let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const results=[];
  for(const [device,width,height] of [['desktop',1280,850],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height},isMobile:device==='mobile',hasTouch:device==='mobile',deviceScaleFactor:1});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await mockRepository(page);
   await page.goto(base+'/tests/fixtures/kunlum-tower-world.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.getElementById('qa-root')?.dataset.mount==='success'&&
    document.querySelector('.towerCanvas')?.dataset.ready==='true',null,{timeout:90000});
   const canvas=page.locator('.towerCanvas canvas');
   if(!await canvas.isVisible())throw Error(device+' canvas absent');
   if(await page.locator('.towerCanvas').getAttribute('data-camera-mode')!=='orbit')
    throw Error(device+' wrong default construction camera');
   const start=await canvas.screenshot({path:path.join(out,device+'-orbit-before.png')});
   const bounds=await canvas.boundingBox();
   const x=bounds.x+bounds.width*.6,y=bounds.y+bounds.height*.5;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+95,y+38,{steps:9});await page.mouse.up();
   await page.waitForTimeout(350);
   const moved=await canvas.screenshot({path:path.join(out,device+'-orbit-after.png')});
   if(start.equals(moved))throw Error(device+' orbit drag did not change rendered scene');
   await page.locator('[data-home]').click();
   await page.locator('[data-hammer]').click();
   if(!await page.locator('.towerCatalog').isVisible())throw Error(device+' catalog unavailable');
   await page.locator('[data-section-id="1x1x1"]').click();
   if(!await page.locator('[data-nudge]').isVisible())throw Error(device+' grid nudge controls missing');
   for(const dir of ['up','right','down','left'])await page.locator('[data-nudge-direction="'+dir+'"]').click();
   if((await page.locator('.towerGame').getAttribute('data-mode'))!=='placing')throw Error(device+' nudge exited placement');
   if(errors.length)throw Error(device+' WebGL JavaScript errors: '+JSON.stringify(errors));
   results.push({device,camera:'orbit',pointerDrag:true,home:true,gridNudge:4,webgl:true,errors:0});
   await context.close();
  }
  console.log('TOWER_NAVIGATION_PLACEMENT_BROWSER_PASS',JSON.stringify(results));
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error('TOWER_NAVIGATION_PLACEMENT_BROWSER_FAILED',e.stack||String(e));process.exitCode=1});
