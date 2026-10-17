/** Full browser proof for the actual common-100 GLB, 3D gallery, camera and mobile. */
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const out='/tmp/alantil-common100-qa';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=spawn('python3',['-m','http.server','8795','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
   await new Promise(r=>setTimeout(r,500));
   const page=await browser.newPage({viewport:{width:1250,height:850},deviceScaleFactor:1});
   const errors=[];const failures=[];
   page.on('pageerror',e=>errors.push(e.stack||e.message));
   page.on('response',r=>{if(r.status()>=400)failures.push(r.status()+' '+r.url())});
   await page.goto('http://127.0.0.1:8795/tower-common100-review.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Загружено: 100'),{timeout:60000});
   if(errors.length||failures.length)throw new Error(JSON.stringify({errors,failures}));
   if(!(await page.locator('#status').textContent()).includes('17.7-common100.7'))throw Error('Old or cached stone library');
   const count=await page.locator('#catalog button').count();if(count!==12)throw Error('12 stone tiles expected, got '+count);
   const original=await page.locator('#stoneName').textContent();
   await page.locator('#next').click();
   const next=await page.locator('#stoneName').textContent();
   if(next===original)throw Error('Next stone navigation failed');
   await page.locator('#edge').click();
   if(await page.locator('#edge').getAttribute('aria-pressed')!=='true')throw Error('Edges failed');
   await page.locator('#gallery').click();
   if(await page.locator('#gallery').getAttribute('aria-pressed')!=='true')throw Error('Gallery failed');
   await page.screenshot({path:path.join(out,'common100-gallery-main-desktop.png')});
   const groups=[['new-main',38],['large',10],['chinking',12],['lintel',6],['all',100],['main',72]];
   for(const [group,count] of groups){
      await page.locator('[data-group="'+group+'"]').click();
      const str=await page.locator('#position').textContent();
      if(!str.endsWith('/ '+count))throw Error('Bad group '+group+': '+str);
      if(await page.locator('.stage canvas').count()!==1)throw Error('Canvas missing');
      await page.screenshot({path:path.join(out,'common100-'+group+'-desktop.png')});
   }
   await page.locator('[data-group="new-main"]').click();
   if((await page.locator('#stoneName').textContent())!=='MAIN_035')throw Error('Redesigned MAIN_035 not first');
   if(!(await page.locator('#stoneOrigin').textContent()).includes('Массивный'))throw Error('Generated 3D family label missing');
   await page.locator('#gallery').click();
   await page.screenshot({path:path.join(out,'common100-38-redesigned-main-desktop.png')});
   await page.locator('[data-group="lintel"]').click();
   await page.locator('#single').click();
   for (let i=0;i<6;i++){
     const name='LINTEL_'+String(i+1).padStart(3,'0');
     const length=[100,100,125,125,150,150][i];
     if(await page.locator('#stoneName').textContent()!==name)throw Error('Wrong lintel model '+i);
     if(Number(await page.locator('#dx').textContent())!==length)throw Error('Wrong lintel span '+name);
     await page.locator('#next').click();
   }
   await page.locator('#gallery').click();
   await page.locator('[data-group="lintel"]').click();
   await page.screenshot({path:path.join(out,'common100-three-paired-lintel-lengths.png')});
   await page.setViewportSize({width:390,height:844});
   await page.locator('[data-group="large"]').click();
   await page.locator('#single').click();
   await page.screenshot({path:path.join(out,'common100-large-mobile.png'),fullPage:true});
   await page.locator('[data-group="new-main"]').click();
   await page.screenshot({path:path.join(out,'common100-new-main-mobile.png'),fullPage:true});
   await page.locator('[data-group="lintel"]').click();
   await page.screenshot({path:path.join(out,'common100-lintel-mobile.png'),fullPage:true});
   await page.locator('#single').click();
   for(let i=0;i<6;i++){
     const name='LINTEL_'+String(i+1).padStart(3,'0');
     if((await page.locator('#stoneName').textContent())!==name)throw Error('Wrong endcap sample '+name);
     await page.locator('#endLeft').click();
     await page.locator('.stage').screenshot({path:path.join(out,'endcap-'+name+'-left.png')});
     await page.locator('#endRight').click();
     await page.locator('.stage').screenshot({path:path.join(out,'endcap-'+name+'-right.png')});
     await page.locator('#next').click();
   }
   if(errors.length||failures.length)throw new Error(JSON.stringify({errors,failures}));
   console.log('COMMON100_3D_BROWSER_QA_PASS','groups='+groups.length,'meshes=100','canvas=webgl','mobile=390px');
 }finally{await browser.close();server.kill();}
})().catch(err=>{console.error(err);process.exitCode=1;});