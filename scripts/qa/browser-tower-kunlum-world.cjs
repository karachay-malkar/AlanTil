/** WebGL QA for actual tower construction screen; no account or placement modifications. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out=path.join(process.cwd(),'tower-world-browser-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.CHROME_PATH||undefined,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
 try{
  const results=[];
  for(const [type,width,height] of [['desktop',1280,850],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,
    isMobile:type==='mobile',hasTouch:type==='mobile'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   await page.goto('http://127.0.0.1:4173/tests/fixtures/kunlum-tower-world.html',
    {waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.kunlumWorldReady==='true',
    null,{timeout:90000}).catch(async()=>{
     const details=await page.evaluate(()=>({
      mount:document.getElementById('qa-root')?.dataset,
      canvas:document.querySelector('.towerCanvas')?.dataset,
      text:document.body.innerText.slice(0,1600)
     }));
     throw Error(type+' cannot load latest map+river: '+JSON.stringify(details)+' errors='+JSON.stringify(errors));
   });
   const details=await page.locator('.towerCanvas').evaluate(el=>({
    ready:el.dataset.kunlumWorldReady,
    count:Number(el.dataset.kunlumConfirmed),
    river:el.dataset.kunlumRiver,
    node:!!el.querySelector('canvas'),
    gridVisible:el.dataset.gridVisible
   }));
   if(details.count!==120||!details.river.includes('186 points')||!details.node||errors.length)
    throw Error(type+' incorrect world data: '+JSON.stringify({details,errors}));
   // Heavy multi-kilometre DEM must NOT load during construction.
   const beforeOverview=await page.locator('.towerCanvas').evaluate(el=>({
    wide:el.dataset.kunlumWide,centre:el.dataset.kunlumPlotCenter
   }));
   if(beforeOverview.centre!=='7.5,15'||beforeOverview.wide!=='loading')
    throw Error(type+' unexpectedly loaded far terrain before overview '+JSON.stringify(beforeOverview));
   await page.waitForFunction(()=>document.getElementById('qa-root')?.dataset.mount==='success'&&
    document.querySelector('[data-world]')?.disabled===false,null,{timeout:60000});
   const hud=await page.evaluate(()=>({
    catalogClosed:document.querySelector('[data-side]')?.classList.contains('is-open')===false,
    orientationVisible:!!document.querySelector('[data-orientation]')?.getClientRects().length,
    extraCameraButtons:document.querySelectorAll('[data-camera]').length,
    clearInsideSettings:!!document.querySelector('[data-settings-panel] [data-clear]'),
    elevationButtonsVisible:getComputedStyle(document.querySelector('.towerElevationControls')).display==='flex',
    flightModeAbsent:!document.querySelector('[data-fly], [data-ground]'),
    items:document.querySelectorAll('[data-section-id]').length
   }));
   if(!hud.catalogClosed||!hud.orientationVisible||hud.extraCameraButtons||
      !hud.clearInsideSettings||!hud.elevationButtonsVisible||!hud.flightModeAbsent||hud.items!==7)
    throw Error(type+' invalid compact HUD '+JSON.stringify(hud));
   await page.locator('[data-hammer]').click();
   if(!(await page.locator('[data-side]').evaluate(el=>el.classList.contains('is-open'))))
    throw Error(type+' catalog did not open');
   await page.locator('[data-catalog-close]').click();
   if(await page.locator('[data-side]').evaluate(el=>el.classList.contains('is-open')))
    throw Error(type+' catalog did not close');
   await page.locator('[data-settings]').click();
   if(!(await page.locator('[data-settings-panel]').isVisible()))
    throw Error(type+' settings did not open');
   await page.locator('[data-settings]').click();
   if(await page.locator('[data-settings-panel]').isVisible())
    throw Error(type+' settings did not close');
   await page.locator('[data-orientation]').click();
   if(!(await page.locator('[data-orientation]').isVisible()))
    throw Error(type+' orientation button disappeared');
   if(!(await page.locator('[data-world]').isVisible()))
    throw Error(type+' no overview control in actual construction UI');
   const savedLocation=await page.locator('.towerCanvas').getAttribute('data-camera-location');
   await page.locator('[data-world]').click();
   await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.worldView==='true',
    null,{polling:200,timeout:25000}).catch(async error=>{
     await page.screenshot({path:path.join(out,'tower-kunlum-'+type+'-overview-error.png')});
     const state=await page.evaluate(()=>({
      canvas:document.querySelector('.towerCanvas')?.dataset,
      pressed:document.querySelector('[data-world]')?.getAttribute('aria-pressed'),
      title:document.querySelector('[data-world]')?.textContent
     }));
     throw Error(type+' view toggle failed '+JSON.stringify(state)+', page errors='+
      JSON.stringify(errors)+'; '+error.message);
    });
   await page.waitForFunction(()=>{
    const el=document.querySelector('.towerCanvas');
    return el&&['ready','unavailable'].includes(el.dataset.kunlumWide);
   },null,{timeout:45000});
   const extent=await page.locator('.towerCanvas').evaluate(el=>({
    wide:el.dataset.kunlumWide,centre:el.dataset.kunlumPlotCenter
   }));
   if(extent.wide!=='ready')throw Error(type+' panorama could not load the real wide DEM '+JSON.stringify(extent));
   await page.waitForFunction(()=>Number(document.querySelector('.towerCanvas')?.dataset.kunlumStoneCount)>0,
    null,{timeout:80000});
   const coverage=await page.locator('.towerCanvas').evaluate(el=>({
    stoneCount:Number(el.dataset.kunlumStoneCount),
    mappedSegments:Number(el.dataset.kunlumStoneSegments)
   }));
   if(coverage.mappedSegments<602||coverage.stoneCount<coverage.mappedSegments*2)
    throw Error(type+' stone-facing skipped historic wall segments '+JSON.stringify(coverage));
   await page.waitForTimeout(1500);
   if(errors.length)throw Error(type+': errors after wide camera: '+JSON.stringify(errors));
   await page.screenshot({path:path.join(out,'tower-kunlum-'+type+'-overview.png')});
   await page.locator('[data-world]').click();
   await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.worldView==='false');
   const restoredLocation=await page.locator('.towerCanvas').getAttribute('data-camera-location');
   if(savedLocation!==restoredLocation)throw Error(type+' camera teleported after overview '+JSON.stringify({savedLocation,restoredLocation}));
   if(await page.locator('[data-world]').getAttribute('aria-pressed')!=='false')
    throw Error(type+' overview button did not reset');
   await page.screenshot({path:path.join(out,'tower-kunlum-'+type+'-construction.png')});
   results.push({mode:type,confirmed:details.count,river:details.river,worldView:true,
    homeRestored:true,hud,coverage,errors:errors.length});
   await context.close();
  }
  console.log('TOWER_KUNLUM_WORLD_BROWSER_PASS',JSON.stringify(results));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
