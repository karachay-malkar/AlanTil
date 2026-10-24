/** Real Common100 PBR/geometry comparison, no edits to saved buildings. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const out=path.join(process.cwd(),'stone-uv-browser-qa');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({
  headless:true,executablePath:process.env.CHROME_PATH||undefined,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader',
   '--enable-unsafe-swiftshader','--disable-gpu-sandbox']
 });
 try{
  const results=[];
  const variants=[
   {device:'desktop',width:1280,height:840,texture:'ktx2'},
   {device:'mobile',width:390,height:844,texture:'ktx2'},
   {device:'mobile',width:390,height:844,texture:'png'}
  ];
  for(const config of variants){
   const {device,width,height,texture}=config;
   const ctx=await browser.newContext({
    viewport:{width,height},deviceScaleFactor:1,
    isMobile:device==='mobile',hasTouch:device==='mobile'
   });
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   const url='http://127.0.0.1:4173/tests/fixtures/tower-common100-uv.html'+
    (texture==='png'?'?towerTexture=png':'');
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.querySelector('#stage')?.dataset.ready==='true',
    null,{timeout:90000}).catch(async()=>{
     const state=await page.evaluate(()=>({
      ready:document.getElementById('stage')?.dataset,
      rock:window.qaRockReady
     }));
     throw Error('Common100 fixture failed: '+JSON.stringify(config)+' '+JSON.stringify(state)+' errors '+JSON.stringify(errors));
    });
   const info=await page.evaluate(()=>window.qaRockReady);
   if(info.stones!==40||info.sourceCount!==100||!info.corrected||errors.length)
    throw Error('Invalid material/recipe '+JSON.stringify({config,info,errors}));
   for(const mode of ['before','after']){
    await page.evaluate(m=>window.qaSetRockMode(m),mode);
    await page.waitForTimeout(300);
    await page.screenshot({path:path.join(out,device+'-'+texture+'-'+mode+'.png')});
   }
   results.push({...config,info,errors:errors.length});
   await ctx.close();
  }
  console.log('TOWER_COMMON100_UV_BROWSER_PASS',JSON.stringify(results));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
