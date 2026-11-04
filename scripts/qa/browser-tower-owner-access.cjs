/** Real browser check: hidden Tower menu, owner visibility, account switching. */
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const server=spawn('python3',['-m','http.server','8831','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await new Promise(resolve=>setTimeout(resolve,550));
  await page.goto('http://127.0.0.1:8831/tests/fixtures/tower-owner-access.html');
  await page.waitForFunction(()=>['true','error'].includes(document.body.dataset.ready),null,{timeout:30000});
  const state=await page.locator('body').getAttribute('data-ready');
  if(state!=='true')throw Error('Cannot mount practice menu: '+await page.locator('body').getAttribute('data-error'));
  const button=page.locator('[data-tower-private]');
  if(await button.isVisible())throw Error('Guest can see Tower entry');
  await page.evaluate(()=>window.testOwnerAccess.setAuthState({ready:true,user:{id:window.testOwnerAccess.TOWER_ACCESS_USER_ID}}));
  if(!await button.isVisible())throw Error('Verified owner cannot see Tower entry');
  await button.click();
  const navigations=await page.evaluate(()=>window.testOwnerAccess.routes);
  if(navigations.at(-1)!=='practice.tower')throw Error('Owner Tower navigation broken');
  await page.evaluate(()=>window.testOwnerAccess.setAuthState({ready:true,user:{id:'9ecab0b5-2b8d-4381-b8ad-057dc28efaee'}}));
  if(await button.isVisible())throw Error('Other account can see Tower entry after switch');
  await page.evaluate(()=>window.testOwnerAccess.setAuthState({ready:true,user:null}));
  if(await button.isVisible())throw Error('Signed-out guest can see Tower entry');
  await page.evaluate(()=>window.testOwnerAccess.unmount());
  const body=await page.locator('body').innerText();
  if(body.includes('as_alan')||body.includes('as-alan'))throw Error('Owner identity disclosed in UI');
  if(errors.length)throw Error('Browser console errors: '+JSON.stringify(errors));
  console.log('TOWER_OWNER_MENU_BROWSER_PASS',JSON.stringify({guestHidden:true,ownerVisible:true,otherHidden:true,logoutHidden:true,usernameNotShown:true}));
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error('TOWER_OWNER_MENU_BROWSER_FAILED',e.stack||String(e));process.exitCode=1});
