/** Real WebGL smoke: frozen OSM river, flowing shader, desktop/mobile quality. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const out=path.join(process.cwd(),'river-browser-qa');
fs.mkdirSync(out,{recursive:true});
const url='http://127.0.0.1:4173/kunlum-terrain-review.html';
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.CHROME_PATH||undefined,
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader',
   '--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
 const summary=[];
 try{
  for(const [name,width,height] of [['desktop',1280,840],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height},
    deviceScaleFactor:1,isMobile:name==='mobile',hasTouch:name==='mobile'});
   const page=await context.newPage(),errors=[],shaderErrors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{
    if(m.type()==='error'&&/shader|webglprogram|compile|link|VALIDATE_STATUS/i.test(m.text()))
     shaderErrors.push(m.text().slice(0,1200));
   });
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await page.locator('#riverStatus').filter({hasText:'точек OSM из репозитория'}).waitFor({timeout:90000});
   if(!(await page.locator('#riverVisible').isChecked()))throw Error(name+': missing local river');
   if(!(await page.locator('#riverView').isEnabled()))throw Error(name+': river focus is disabled');
   await page.locator('#riverView').click();
   await page.waitForTimeout(1800);
   if(errors.length||shaderErrors.length)throw Error(name+': '+JSON.stringify({errors,shaderErrors}));
   const pixels=await page.locator('canvas').first().evaluate(c=>{
    const gl=c.getContext('webgl2')||c.getContext('webgl');
    return {width:c.width,height:c.height,webgl:!!gl};
   });
   if(!pixels.webgl||pixels.width<300||pixels.height<300)throw Error(name+': WebGL canvas missing '+JSON.stringify(pixels));
   await page.screenshot({path:path.join(out,'cherek-'+name+'-beautiful.png')});
   await page.locator('#qualityInteractive').click();
   await page.waitForTimeout(750);
   if(errors.length||shaderErrors.length)throw Error(name+': interactive failed '+JSON.stringify({errors,shaderErrors}));
   if(!(await page.locator('#riverVisible').isChecked()))throw Error(name+': quality switch lost river');
   await page.screenshot({path:path.join(out,'cherek-'+name+'-interactive.png')});
   summary.push({device:name,qualityModes:2,webgl:true,errors:0,river:'local OSM'});
   await context.close();
  }
  console.log('KUNLUM_RIVER_BROWSER_PASS',JSON.stringify(summary));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
