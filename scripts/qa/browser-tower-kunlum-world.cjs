/** Current mapped Kunlum world + real construction UI, desktop and mobile. */
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs');
const mockRepository=require('./tower-owner-repository-mock.cjs');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:4173';
const out=path.join(root,'tower-world-browser-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=spawn('node',['scripts/static-preview-server.mjs'],{cwd:root,stdio:'ignore'});let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const results=[];
  for(const [device,width,height] of [['desktop',1280,850],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height},isMobile:device==='mobile',hasTouch:device==='mobile'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await mockRepository(page);
   let releaseTextures;
   const textureGate=new Promise(resolve=>{releaseTextures=resolve;});
   await page.route('**/assets/tower/materials/balkaria-stone-v2.1/**',async route=>{
    await textureGate;
    await route.continue();
   });
   try{
    await Promise.all([
     page.waitForRequest(request=>new URL(request.url()).pathname.startsWith('/assets/tower/materials/balkaria-stone-v2.1/'),{timeout:30000}),
     page.goto(base+'/tests/fixtures/kunlum-tower-world.html',{waitUntil:'domcontentloaded'})
    ]);
    await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.kunlumWorldReady==='true'&&
     document.getElementById('qa-root')?.dataset.mount==='success',null,{timeout:100000});
    await page.waitForFunction(()=>Number(document.querySelector('.towerCanvas')?.dataset.kunlumStoneSegments)>0&&
     document.querySelector('.towerCanvas')?.dataset.kunlumRuinEngine==='fixed-common100-instances-v1'&&
     document.querySelector('.towerCanvas')?.dataset.stoneTextureEncoding==='pending',null,{timeout:45000});
   }finally{releaseTextures();}
   await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.stoneTextureEncoding!=='pending',
    null,{timeout:90000});
   const data=await page.locator('.towerCanvas').evaluate(el=>({
    confirmed:Number(el.dataset.kunlumConfirmed),river:el.dataset.kunlumRiver,
    segments:Number(el.dataset.kunlumStoneSegments),ruinEngine:el.dataset.kunlumRuinEngine,
    stoneCount:Number(el.dataset.kunlumStoneCount),
    wide:el.dataset.kunlumWide,mode:el.dataset.cameraMode
   }));
   if(data.confirmed!==120||!data.river.includes('186 points')||data.segments<602||data.stoneCount<=data.segments)
    throw Error(device+' lost mapped 3D world '+JSON.stringify(data));
   if(data.mode!=='orbit')throw Error(device+' wrong default camera '+data.mode);
   if(await page.locator('[data-world]').count())throw Error(device+' removed wide-view HUD button unexpectedly restored');
   if(!await page.locator('[data-home]').isVisible())throw Error(device+' plot reset button absent');
   await page.locator('[data-hammer]').click();
   if(!await page.locator('.towerCatalog').isVisible())throw Error(device+' catalog not reachable');
   await page.locator('[data-catalog-close]').click();
   await page.locator('[data-settings]').click();
   if(!await page.locator('[data-settings-panel]').isVisible())throw Error(device+' settings unavailable');
   await page.locator('[data-settings]').click();
   if(errors.length)throw Error(device+' browser errors '+JSON.stringify(errors));
   await page.screenshot({path:path.join(out,device+'-world.png'),animations:'disabled'});
   results.push({device,...data,errors:0});
   await context.close();
  }
  console.log('TOWER_KUNLUM_WORLD_BROWSER_PASS',JSON.stringify(results));
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error('TOWER_KUNLUM_WORLD_BROWSER_FAILED',e.stack||String(e));process.exitCode=1});
