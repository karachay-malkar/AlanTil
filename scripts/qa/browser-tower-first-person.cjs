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
    return {mode:el.dataset.cameraMode,point:raw,flying:el.dataset.flying};
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
   const moved=await state();
   if(!(moved.point[0]>a.point[0]+.10))throw Error(device+' did not move right '+JSON.stringify({a,moved}));
   const lookBefore=(await state()).point;
   const canvas=page.locator('.towerCanvas canvas');
   const box=await canvas.boundingBox();const x=box.x+box.width*.67,y=box.y+box.height*.54;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+70,y+22,{steps:4});await page.mouse.up();
   if(errors.length)throw Error(device+' look errors '+JSON.stringify(errors));
   await page.locator('[data-fly]').click();
   if(await page.locator('[data-fly]').getAttribute('aria-pressed')!=='true')
    throw Error('Flight not enabled');
   if(!(await page.locator('[data-rise]').isVisible()))
    throw Error(device+' flight altitude control hidden while flying');
   const up=await page.locator('[data-rise]').boundingBox();
   await page.evaluate(()=>{
    window.__towerRiseEvents=[];
    const b=document.querySelector('[data-rise]');
    for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture','gotpointercapture'])
     b.addEventListener(type,e=>window.__towerRiseEvents.push({type,at:performance.now(),id:e.pointerId}));
   });
   await page.mouse.move(up.x+up.width/2,up.y+up.height/2);
   await page.mouse.down();
   const samples=[];for(let i=0;i<3;i++){await sleep(300);samples.push(await state());}
   await page.mouse.up();await sleep(80);
   const flown=await state();
   if(!(flown.point[1]>a.point[1]+1&&flown.point[1]<=15.02)){
    const events=await page.evaluate(()=>window.__towerRiseEvents);
    throw Error(device+' flight altitude invalid '+JSON.stringify({a,flown,samples,events,up}));
   }
   await page.screenshot({path:path.join(out,device+'-flight.png')});
   await page.locator('[data-ground]').click();
   const grounded=await state();
   if(Math.abs(grounded.point[1]-1.7)>.08||grounded.flying!=='false')
    throw Error(device+' did not land '+JSON.stringify(grounded));
   await page.locator('[data-world]').click();
   if(await page.locator('.towerCanvas').getAttribute('data-world-view')!=='true')
    throw Error(device+' overview camera unavailable');
   await page.locator('[data-world]').click();
   const home=await state();
   if(home.mode!=='explore'||await page.locator('.towerCanvas').getAttribute('data-world-view')!=='false')
    throw Error(device+' normal construction camera not restored '+JSON.stringify(home));
   if(await page.locator('.towerCatalog').isVisible())throw Error('Construction catalog should default closed');
   await page.locator('[data-hammer]').click();
   if(!(await page.locator('.towerCatalog').isVisible()))throw Error('Construction catalog failed to open');
   if(errors.length)throw Error(device+' uncaught JavaScript '+JSON.stringify(errors));
   verified.push({device,walkMoved:true,flightY:flown.point[1],landedY:grounded.point[1],
    constructionRestored:true,errors:errors.length});
   await ctx.close();
  }
  console.log('TOWER_FIRST_PERSON_BROWSER_PASS',JSON.stringify(verified));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
