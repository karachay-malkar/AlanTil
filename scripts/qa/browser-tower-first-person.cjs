/** Real AlanTil tower screen: touch/keyboard movement, grounded camera and 15m limit. */
const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs');
const out=path.join(process.cwd(),'tower-first-person-qa');fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.CHROME_PATH||undefined,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader',
   '--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
 try{
  const verified=[];
  for(const device of ['desktop','mobile']){
   const ctx=await browser.newContext({
    viewport:device==='mobile'?{width:390,height:844}:{width:1280,height:850},
    isMobile:device==='mobile',hasTouch:device==='mobile'
   });
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4173/tests/fixtures/kunlum-tower-world.html',
    {waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.getElementById('qa-root')?.dataset.mount==='success'&&
    document.querySelector('.towerCanvas')?.dataset.cameraMode==='explore',null,{timeout:90000});
   const state=()=>page.locator('.towerCanvas').evaluate(el=>{
    const raw=el.dataset.cameraLocation?.split(',').map(Number)||[];
    return {mode:el.dataset.cameraMode,point:raw};
   });
   // Building starts in first-person; the old orbit-mode switch is removed.
   let a=await state();
   if(a.mode!=='explore'||Math.abs(a.point[1]-1.7)>.08)
    throw Error(device+' did not start at person eye level '+JSON.stringify(a));
   if(!(await page.locator('[data-joystick]').isVisible())&&device==='mobile')
    throw Error('Mobile joystick not visible');
   await page.screenshot({path:path.join(out,device+'-walk.png')});
   if(device==='desktop'){
    await page.keyboard.down('KeyD');await sleep(500);await page.keyboard.up('KeyD');
   }else{
    const b=await page.locator('[data-joystick]').boundingBox();
    const x=b.x+b.width/2,y=b.y+b.height/2;
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x+31,y,{steps:6});await sleep(800);await page.mouse.up();
   }
   await page.waitForFunction(startX=>{
    const el=document.querySelector('.towerCanvas');
    return Number(el?.dataset.cameraLocation?.split(',')[0])>startX+.10;
   },a.point[0],{timeout:5000}).catch(()=>{});
   const moved=await state();
   if(!(moved.point[0]>a.point[0]+.10))throw Error(device+' did not move right '+JSON.stringify({a,moved}));
   const lookBefore=(await state()).point;
   const canvas=page.locator('.towerCanvas canvas');
   const box=await canvas.boundingBox();const x=box.x+box.width*.67,y=box.y+box.height*.54;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+70,y+22,{steps:4});await page.mouse.up();
   if(errors.length)throw Error(device+' look errors '+JSON.stringify(errors));
   if(await page.locator('[data-fly], [data-ground]').count())
    throw Error(device+' obsolete flight mode still exists');
   if(!(await page.locator('[data-rise]').isVisible())||
      !(await page.locator('[data-fall]').isVisible()))
    throw Error(device+' two always-visible height arrows missing');
   const beforeElevation=await state();
   const up=await page.locator('[data-rise]').boundingBox();
   await page.mouse.move(up.x+up.width/2,up.y+up.height/2);
   await page.mouse.down();await sleep(850);await page.mouse.up();await sleep(120);
   const raised=await state();
   if(!(raised.point[1]>beforeElevation.point[1]+.08&&
        raised.point[1]<beforeElevation.point[1]+1.4&&raised.point[1]<=15.02))
    throw Error(device+' elevation did not move smoothly '+JSON.stringify({beforeElevation,raised}));
   await sleep(250);
   const heldAltitude=await state();
   if(Math.abs(heldAltitude.point[1]-raised.point[1])>.03)
    throw Error(device+' altitude changed after releasing ↑ '+JSON.stringify({raised,heldAltitude}));
   const down=await page.locator('[data-fall]').boundingBox();
   await page.mouse.move(down.x+down.width/2,down.y+down.height/2);
   await page.mouse.down();await sleep(400);await page.mouse.up();await sleep(100);
   const lowered=await state();
   if(!(lowered.point[1]<raised.point[1]-.04&&lowered.point[1]>=1.7))
    throw Error(device+' lowering jumped or failed '+JSON.stringify({raised,lowered}));
   await page.screenshot({path:path.join(out,device+'-height-arrows.png')});
   await page.locator('[data-world]').click();
   if(await page.locator('.towerCanvas').getAttribute('data-world-view')!=='true')
    throw Error(device+' overview camera unavailable');
   await page.locator('[data-world]').click();
   const home=await state();
   if(home.mode!=='explore'||await page.locator('.towerCanvas').getAttribute('data-world-view')!=='false')
    throw Error(device+' normal construction camera not restored '+JSON.stringify(home));
   if(Math.abs(home.point[0]-lowered.point[0])>.03||
      Math.abs(home.point[1]-lowered.point[1])>.03||
      Math.abs(home.point[2]-lowered.point[2])>.03)
    throw Error(device+' overview teleported the player '+JSON.stringify({lowered,home}));
   if(await page.locator('.towerCatalog').isVisible())throw Error('Construction catalog should default closed');
   await page.locator('[data-hammer]').click();
   try{
    await page.locator('.towerCatalog').waitFor({state:'visible',timeout:4000});
   }catch(error){
    const debug=await page.evaluate(()=>{
     const game=document.querySelector('.towerGame'),side=document.querySelector('[data-side]');
     const catalog=document.querySelector('.towerCatalog');
     return {mode:game?.dataset.mode,explore:game?.dataset.explore,catalogOpen:game?.dataset.catalogOpen,
      sideClass:side?.className,sideInert:side?.inert,sideHidden:side?.hidden,
      sideDisplay:side&&getComputedStyle(side).display,sideVisibility:side&&getComputedStyle(side).visibility,
      catalogDisplay:catalog&&getComputedStyle(catalog).display,
      hammerDisabled:document.querySelector('[data-hammer]')?.disabled};
    });
    throw Error(device+' catalog after overview did not open '+JSON.stringify(debug)+' '+error.message);
   }
   if(errors.length)throw Error(device+' uncaught JavaScript '+JSON.stringify(errors));
   verified.push({device,walkMoved:true,raisedY:raised.point[1],loweredY:lowered.point[1],
    altitudePreserved:true,constructionRestored:true,errors:errors.length});
   console.log('TOWER_FIRST_PERSON_DEVICE_PASS',device,JSON.stringify(verified.at(-1)));
   await ctx.close();
  }
  // Landscape mobile must remain interactive while all 2K stone PBR downloads stall.
  const landscapeCtx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  const landscape=await landscapeCtx.newPage();
  await landscape.route('**/assets/tower/materials/balkaria-stone-v2.1/**',async route=>{
   await sleep(12000);
   await route.continue().catch(()=>{});
  });
  const started=Date.now();
  await landscape.goto('http://127.0.0.1:4173/tests/fixtures/kunlum-tower-world.html',
   {waitUntil:'domcontentloaded',timeout:45000});
  await landscape.waitForFunction(()=>
   document.getElementById('qa-root')?.dataset.mount==='success'&&
   document.querySelector('.towerCanvas')?.dataset.cameraMode==='explore',
   null,{timeout:9000});
  const startupMs=Date.now()-started;
  const quality=await landscape.locator('.towerCanvas').evaluate(el=>({
   mobile:el.dataset.mobileQuality,encoding:el.dataset.stoneTextureEncoding,
   playable:el.dataset.ready
  }));
  if(quality.mobile!=='true'||quality.playable!=='true')
   throw Error('Landscape mobile quality/startup regression '+JSON.stringify(quality));
  if(quality.encoding!=='pending')
   throw Error('Tower blocked on PBR texture download '+JSON.stringify(quality));
  await landscape.locator('[data-hammer]').click({timeout:6000});
  await landscape.locator('.towerCatalog').waitFor({state:'visible',timeout:3000});
  await landscape.screenshot({path:path.join(out,'mobile-landscape-fast-start.png')});
  console.log('TOWER_LANDSCAPE_FAST_START_PASS',JSON.stringify({startupMs,...quality}));
  await landscapeCtx.close();
  // Real SPA route, not only the isolated test fixture: guest setup is already complete.
  const appCtx=await browser.newContext({viewport:{width:844,height:390},
   isMobile:true,hasTouch:true});
  await appCtx.addInitScript(()=>{
   localStorage.setItem('alantil_scope_v1:guest:settings',JSON.stringify({
    interface_language_code:'ru',translation_language_code:'ru',
    alan_script_code:'cyrillic',alan_dialect_code:'canonical',
    text_size_code:'medium',learning_setup_completed_at:'2026-10-26T00:00:00.000Z'
   }));
  });
  const app=await appCtx.newPage(),appErrors=[];
  app.on('pageerror',error=>appErrors.push(error.message));
  await app.goto('http://127.0.0.1:4173/practice/tower',
   {waitUntil:'domcontentloaded',timeout:45000});
  await app.waitForFunction(()=>{
   const world=document.querySelector('.towerCanvas'),hud=document.querySelector('.towerGame');
   return world?.dataset.cameraMode==='explore'&&hud?.dataset.explore==='true'&&
    hud.dataset.mode==='idle'&&!document.querySelector('[data-hammer]')?.disabled;
  },null,{timeout:65000});
  const fullRoute=await app.locator('.towerCanvas').evaluate(el=>({
   mobile:el.dataset.mobileQuality,ready:el.dataset.ready,mode:el.dataset.cameraMode
  }));
  if(fullRoute.mobile!=='true'||fullRoute.ready!=='true'||appErrors.length)
   throw Error('Real mobile SPA construction failed '+JSON.stringify({fullRoute,appErrors}));
  await app.locator('[data-hammer]').click();
  await app.locator('.towerCatalog').waitFor({state:'visible',timeout:5000});
  await app.locator('[data-section-id="1x1x1"]').click();
  await app.waitForFunction(()=>document.querySelector('.towerGame')?.dataset.mode==='placing',
   null,{timeout:15000});
  await app.screenshot({path:path.join(out,'real-spa-landscape-construction.png')});
  console.log('TOWER_REAL_SPA_ROUTE_PASS',JSON.stringify(fullRoute));
  await appCtx.close();
  console.log('TOWER_FIRST_PERSON_BROWSER_PASS',JSON.stringify(verified));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
