/** Browser proof of every fixed 486-rock variant and material fallback.
 * Produces WebGL screenshots; no generated illustration or browser-side packing.
 */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const output='/tmp/alantil-gate-486-review';
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const server=cp.spawn('python3',['-m','http.server','8792','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1240,height:820},deviceScaleFactor:1});
  const errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',response=>{if(response.status()>=400)failed.push(response.url()+' '+response.status())});
  await new Promise(r=>setTimeout(r,300));
  await page.goto('http://127.0.0.1:8792/tower-compact-review.html',{waitUntil:'domcontentloaded'});
  await page.locator('#release').selectOption('17.5.9');
  const types=['1x1x1','2x2x2','2x2x3','2x3x4','4x4x4'];
  let count=0;
  for(const kind of types){
   await page.locator('#kind').selectOption(kind);
   for(let variant=0;variant<5;variant++){
    await page.locator('#variant').selectOption(String(variant));
    await page.waitForFunction(([type,index])=>{
     const el=document.getElementById('status');
     return el?.textContent?.includes('Размер: '+type)&&el?.textContent?.includes('Камней:')&&
      !el.textContent.includes('Загрузка') &&
      document.getElementById('variant').value===String(index);
    },[kind,variant],{timeout:45000});
    if(errors.length)throw Error('WebGL error: '+errors.join(' | '));
    const st=await page.locator('#status').textContent();
    if(!/Материал:/.test(st))throw Error('Stone material missing: '+st);
    await page.screenshot({path:path.join(output,kind+'-variant-'+variant+'.png')});
    count++;
   }
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#kind').selectOption('4x4x4');
  await page.locator('#variant').selectOption('4');
  await page.waitForTimeout(600);
  await page.screenshot({path:path.join(output,'mobile-4x4x4.png')});
  if(failed.length)throw Error('HTTP errors '+failed.join(' | '));
  console.log('AUTHORED_486_WEBGL_SCREENSHOTS_OK',count,'PLUS_MOBILE');
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error('REVIEW_FAILED',e);process.exitCode=1});
