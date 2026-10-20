/** Smoke-test real Three.js gate-review page and WebGL/HTTP rendering on desktop/mobile. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const shots='/tmp/alantil-gate-v9-preview';
fs.mkdirSync(shots,{recursive:true});
(async()=>{
 const server=cp.spawn('python3',['-m','http.server','8794','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  await new Promise(r=>setTimeout(r,600));
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',res=>{if(res.status()>=400)failed.push(res.url()+' HTTP '+res.status())});
  await page.goto('http://127.0.0.1:8794/gate-fit-review.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.gateReview==='ready'||document.body.dataset.gateReview==='failed',null,{timeout:100000});
  const state=await page.locator('#status').innerText();
  if(await page.locator('body').getAttribute('data-gate-review')!=='ready')throw new Error('Gate preview did not load: '+state);
  if(errors.length||failed.length)throw new Error(JSON.stringify({errors,failed}));
  if(!/GLB/.test(state))throw new Error('Render status missing: '+state);
  const info=await page.locator('#info').innerText();
  if(!info.includes('572')||!info.includes('86'))throw new Error('Candidate metrics missing: '+info);
  await page.screenshot({path:path.join(shots,'desktop-comparison.png')});
  await page.locator('[data-view="new"]').click();
  if(await page.locator('[data-view="new"]').getAttribute('aria-pressed')!=='true')throw new Error('Candidate-only control failed');
  await page.screenshot({path:path.join(shots,'desktop-candidate.png')});
  await page.locator('#bounds').uncheck();
  await page.locator('#neighbors').uncheck();
  await page.locator('[data-view="old"]').click();
  if(await page.locator('[data-view="old"]').getAttribute('aria-pressed')!=='true')throw new Error('Original-only control failed');
  await page.setViewportSize({width:390,height:820});
  await page.locator('[data-view="new"]').click();
  await page.locator('#bounds').check();
  await page.locator('#neighbors').check();
  await page.screenshot({path:path.join(shots,'mobile-candidate.png')});
  if(errors.length||failed.length)throw new Error(JSON.stringify({errors,failed}));
  console.log('GATE_V9_WEBGL_QA_PASS',JSON.stringify({state,info,shots}));
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error('GATE_V9_WEBGL_QA_FAILED',e.stack||String(e));process.exitCode=1});
