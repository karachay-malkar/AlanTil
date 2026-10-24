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
   if(!(await page.locator('[data-world]').isVisible()))
    throw Error(type+' no overview control in actual construction UI');
   await page.locator('[data-world]').click();
   await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.worldView==='true');
   await page.waitForTimeout(1500);
   if(errors.length)throw Error(type+': errors after wide camera: '+JSON.stringify(errors));
   await page.screenshot({path:path.join(out,'tower-kunlum-'+type+'-overview.png')});
   await page.locator('[data-camera="home"]').click();
   await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.worldView==='false');
   if(await page.locator('[data-world]').getAttribute('aria-pressed')!=='false')
    throw Error(type+' overview button did not reset');
   await page.screenshot({path:path.join(out,'tower-kunlum-'+type+'-construction.png')});
   results.push({mode:type,confirmed:details.count,river:details.river,worldView:true,
    homeRestored:true,errors:errors.length});
   await context.close();
  }
  console.log('TOWER_KUNLUM_WORLD_BROWSER_PASS',JSON.stringify(results));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
