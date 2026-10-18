const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const server=spawn('python3',['-m','http.server','8796','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const dir='/tmp/alantil-common100-masonry';fs.mkdirSync(dir,{recursive:true});
 try{
  await new Promise(r=>setTimeout(r,800));
  const page=await browser.newPage({viewport:{width:1250,height:850},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8796/tower-common100-masonry-review.html?kind=2x2x2',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:60000});
  const categories=['1x1x1','2x2x2','2x2x3','2x3x4','4x4x4','window','door','gate','joint-x','joint-y','joint-z','joint-corner'];
  for(const kind of categories){
   await page.locator('[data-kind="'+kind+'"]').click();
   if(await page.locator('#density').textContent()==='—')throw Error('Missing density '+kind);
  }
  await page.locator('[data-kind="2x2x2"]').click();
  for(let i=0;i<5;i++)await page.locator('#variants button').nth(i).click();
  await page.locator('#wall').click();
  await page.screenshot({path:dir+'/wall-three-sections.png'});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#single').click();
  await page.screenshot({path:dir+'/mobile-section.png',fullPage:true});
  if(errors.length)throw Error(JSON.stringify(errors));
  console.log('MASONRY_3D_VIEWER_PASS',categories.length,'categories; webgl and mobile');
 }finally{await browser.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
