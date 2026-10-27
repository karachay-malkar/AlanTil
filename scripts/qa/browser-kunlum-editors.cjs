/** Browser proof that the 2D and 3D wall editors share the original map. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(process.cwd(),'kunlum-editors-browser-qa');fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.CHROME_PATH||undefined,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
 try{
  const output=[];
  for(const [mode,width,height] of [['desktop',1280,850],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,
    isMobile:mode==='mobile',hasTouch:mode==='mobile'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4173/kunlum-vector-editor.html',
    {waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.querySelector('#site rect')&&
    document.querySelectorAll('#candidates path').length===602,null,{timeout:30000}).catch(async error=>{
     const details=await page.evaluate(()=>({
      status:document.querySelector('#status')?.textContent?.slice(0,700),
      rectangles:document.querySelectorAll('#site rect').length,
      auto:document.querySelectorAll('#candidates path').length,
      title:document.title,body:document.body.innerText.slice(0,900)
     }));
     await page.screenshot({timeout:90000,animations:'disabled',path:path.join(dir,mode+'-2d-failed.png')});
     throw Error(mode+' cannot load original 2D map: '+JSON.stringify({details,errors})+'; '+error.message);
    });
   const twoD=await page.evaluate(()=>{
    const b=document.querySelector('#site rect');
    return {x:Number(b.getAttribute('x')),y:Number(b.getAttribute('y')),
     width:Number(b.getAttribute('width')),height:Number(b.getAttribute('height')),
     transform:b.parentElement.getAttribute('transform'),
     auto:document.querySelectorAll('#candidates path').length};
   });
   if(Math.abs(twoD.x-1060.6697998046875)>1e-5||Math.abs(twoD.y-892.3427734375)>1e-5||
      Math.abs(twoD.width-108)>1e-5||Math.abs(twoD.height-54)>1e-5||
      !twoD.transform.startsWith('rotate(-7 ')||twoD.auto!==602||errors.length)
    throw Error(mode+' 2D original map changed: '+JSON.stringify({twoD,errors}));
   await page.screenshot({timeout:90000,animations:'disabled',path:path.join(dir,mode+'-2d.png')});
   await page.goto('http://127.0.0.1:4173/kunlum-terrace-editor-3d.html',
    {waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.querySelector('#hud')?.textContent.includes('120 подтверждённых объектов')&&
    document.querySelector('#hud')?.textContent.includes('602 дополнительных непроверенных контуров')&&
    !!document.querySelector('#view canvas'),null,{timeout:90000});
   const threeD=await page.evaluate(()=>({
    hud:document.querySelector('#hud').textContent.slice(0,320),
    parcel:document.querySelector('#parcelVisible')?.checked,
    canvas:!!document.querySelector('#view canvas')}));
   if(!threeD.parcel||!threeD.canvas||errors.length)
    throw Error(mode+' 3D editor inconsistent: '+JSON.stringify({threeD,errors}));
   await page.waitForFunction(()=>Number(document.querySelector('#view')?.dataset.common100StoneCount)>0,
    null,{timeout:80000});
   await page.screenshot({timeout:90000,animations:'disabled',path:path.join(dir,mode+'-3d.png')});
   output.push({mode,twoD,threeD,errors});
   await context.close();
  }
  console.log('KUNLUM_UNIFIED_EDITORS_PASS',JSON.stringify(output));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
