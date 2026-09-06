const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');

const output=process.env.SCREENSHOT_DIR||path.resolve('mobile/render-qa-16.6.6');
const targetUrl=process.env.PUBLIC_PREVIEW_URL;
const referenceUrl=process.env.WEB_REFERENCE_URL||'https://raw.githack.com/karachay-malkar/AlanTil/3249e0d3364656e1030d50791b24aaa8789ed1b8/index.html';
if(!targetUrl)throw new Error('PUBLIC_PREVIEW_URL is required');
fs.mkdirSync(output,{recursive:true});

function safeName(value){return String(value).replace(/[^a-z0-9._-]+/gi,'-');}
function readPng(file){return PNG.sync.read(fs.readFileSync(file));}
function comparePng(referenceFile,targetFile,diffFile){
  const a=readPng(referenceFile),b=readPng(targetFile);
  if(a.width!==b.width||a.height!==b.height)return {status:'SIZE_MISMATCH',reference:[a.width,a.height],target:[b.width,b.height]};
  const diff=new PNG({width:a.width,height:a.height});
  const pixels=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:0.12,includeAA:false});
  fs.writeFileSync(diffFile,PNG.sync.write(diff));
  return {status:'COMPARED',pixels,total:a.width*a.height,ratio:pixels/(a.width*a.height)};
}
async function addRawGithackCookie(context,url){if(url.includes('raw.githack.com'))await context.addCookies([{name:'__Http-phish',value:'1',domain:'raw.githack.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}]);}
async function openWithRetry(page,url){let loaded=false,lastError='';for(let attempt=0;attempt<12&&!loaded;attempt+=1){try{const response=await page.goto(`${url}${url.includes('?')?'&':'?'}qa=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:60000});loaded=Boolean(response?.ok());if(!loaded)lastError=`HTTP ${response?.status()}`;}catch(error){lastError=error.message;}if(!loaded)await page.waitForTimeout(1800);}assert.ok(loaded,`Preview failed to load: ${lastError}`);}
async function stabilize(page){await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'}).catch(()=>{});await page.waitForTimeout(250);}
async function collectMetrics(page){return page.evaluate(()=>{const rect=n=>{const r=n.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)}};const buttons=[...document.querySelectorAll('[role="button"],button')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0}).slice(0,50).map(n=>({text:(n.innerText||n.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,80),rect:rect(n),font:getComputedStyle(n).fontSize}));const text=[...document.querySelectorAll('h1,h2,h3,p,[role="heading"]')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0}).slice(0,40).map(n=>({text:(n.innerText||'').trim().replace(/\s+/g,' ').slice(0,100),rect:rect(n),font:getComputedStyle(n).fontSize,lineHeight:getComputedStyle(n).lineHeight}));return {viewport:{w:innerWidth,h:innerHeight},scroll:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},buttons,text};});}

async function createHarness(browser,label,url){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'ru-RU'});await addRawGithackCookie(context,url);const page=await context.newPage();const failures={consoleErrors:[],pageErrors:[],requestFailures:[],badResponses:[]};page.on('console',m=>{if(m.type()==='error')failures.consoleErrors.push(m.text())});page.on('pageerror',e=>failures.pageErrors.push(String(e?.stack||e)));page.on('requestfailed',r=>failures.requestFailures.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText||'failed'}`));page.on('response',r=>{if(r.status()>=400)failures.badResponses.push(`${r.status()} ${r.url()}`)});await openWithRetry(page,url);await stabilize(page);const captures={};async function capture(name){await stabilize(page);const m=await collectMetrics(page);assert.ok(m.scroll.w<=m.viewport.w+2,`${label}/${name}: horizontal overflow ${JSON.stringify(m.scroll)}`);const viewportFile=path.join(output,`${label}-${safeName(name)}.png`),fullFile=path.join(output,`${label}-${safeName(name)}-full.png`);await page.screenshot({path:viewportFile,fullPage:false});await page.screenshot({path:fullFile,fullPage:true});captures[name]={viewportFile,fullFile,metrics:m};return captures[name];}return {context,page,failures,captures,capture};
}
async function clickExact(page,text){const target=page.getByText(text,{exact:true}).last();await target.waitFor({state:'visible',timeout:15000});await target.click();}
async function clickNamed(page,name){const target=page.getByRole('button',{name}).last();await target.waitFor({state:'visible',timeout:15000});await target.click();}
async function back(page){const button=page.getByRole('button',{name:/^(Назад|Back)$/}).first();await button.waitFor({state:'visible',timeout:15000});const clear=await button.evaluate(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return hit===node||node.contains(hit)});assert.ok(clear,'Back button hit target is blocked');await button.click();await page.waitForTimeout(180);}
async function finishStageTest(page){for(let i=0;i<120;i+=1){if(await page.getByText('Результат этапа',{exact:true}).count())return true;const buttons=page.getByRole('button');let option=null;for(let j=0;j<await buttons.count();j+=1){const b=buttons.nth(j),label=await b.getAttribute('aria-label'),text=String(await b.innerText().catch(()=>'' )).trim(),disabled=(await b.getAttribute('aria-disabled'))==='true';if(disabled||label==='Назад'||text==='Ответить'||!text)continue;option=b;break;}if(!option)return false;await option.click();const answer=page.getByText('Ответить',{exact:true}).last();await answer.waitFor({state:'visible',timeout:5000});await answer.click();await page.waitForTimeout(30);}return false;}

async function runFlow(h,isReference=false){
  const {page,capture}=h;
  fs.writeFileSync(path.join(output,`${isReference?'reference':'target'}-runtime-body.txt`),await page.locator('body').innerText().catch(()=>''));
  await capture('00-runtime');
  await page.getByText('Язык · Language · Dil',{exact:true}).waitFor({state:'visible',timeout:30000});
  await capture('01-onboarding');
  await clickExact(page,'Русский');await page.getByText('Написание аланских слов',{exact:true}).waitFor({state:'visible'});await clickExact(page,'Кириллица');await page.getByText('Выберите форму',{exact:true}).waitFor({state:'visible'});await clickExact(page,'Җ');await capture('02-onboarding-complete');
  await clickExact(page,'Продолжить');await page.getByText('Продолжить с Google',{exact:true}).waitFor({state:'visible',timeout:15000});await capture('03-auth-choice');
  await clickExact(page,'Продолжить как гость');await page.getByText('Путь',{exact:true}).first().waitFor({state:'visible',timeout:30000});await page.waitForTimeout(1000);await capture('04-path-stele');
  const stele=page.getByText('Это история о последних мгновениях жизни языка.',{exact:false}).first();await stele.waitFor({state:'visible',timeout:15000});const steleFontSize=await stele.evaluate(node=>Number.parseFloat(getComputedStyle(node).fontSize)||0);await page.mouse.click(1,1);await page.waitForTimeout(250);await capture('05-path');
  await clickExact(page,'Практика');await page.getByText(isReference?'Практика':'ПРАКТИКА',{exact:true}).waitFor({state:'visible',timeout:15000}).catch(async()=>page.getByText(/Практика/i).first().waitFor({state:'visible'}));await capture('06-practice');
  await clickExact(page,'Тест');await page.getByText('Начать тест',{exact:true}).waitFor({state:'visible'});await capture('07-general-test-menu');await clickExact(page,'Начать тест');await page.getByText('Ответить',{exact:true}).waitFor({state:'visible'});await capture('08-general-test-session');await back(page);
  await clickExact(page,'Сопоставление');await page.getByText('Начать игру',{exact:true}).waitFor({state:'visible'});await capture('09-match-menu');await clickExact(page,'Начать игру');await page.waitForTimeout(250);await capture('10-match-session');await back(page);
  await clickExact(page,'Избранное');await capture('11-favorites');await back(page);
  await clickExact(page,'Песни');await page.waitForTimeout(300);await capture('12-songs-playlists');await back(page);
  await clickExact(page,'Профиль');await page.getByText('Профиль недоступен',{exact:true}).waitFor({state:'visible',timeout:15000});await capture('13-profile-guest');await clickExact(page,'Войти');await page.waitForTimeout(250);await capture('14-account-guest');await back(page);
  await clickNamed(page,/Статистика/);await page.waitForTimeout(250);await capture('15-profile-statistics');await clickNamed(page,/Настройки/);await page.getByText('Языковые настройки',{exact:true}).waitFor({state:'visible',timeout:15000});await capture('16-settings');await clickExact(page,'Политика конфиденциальности');await page.getByText('Конфиденциальность',{exact:true}).first().waitFor({state:'visible',timeout:15000});await capture('17-privacy');await back(page);await clickExact(page,'Версия приложения');await capture('18-version');await back(page);await clickExact(page,'Благодарности');await capture('19-thanks');await back(page);
  await clickExact(page,'Путь');await page.waitForTimeout(450);const firstStation=page.getByText('01',{exact:true}).last();await firstStation.waitFor({state:'visible',timeout:15000});await firstStation.click();await page.getByText('Меню',{exact:true}).waitFor({state:'visible',timeout:15000});await capture('20-station-words');await clickNamed(page,/Статистика/);await page.waitForTimeout(250);await capture('21-station-statistics');await clickNamed(page,/Меню/);await clickExact(page,'Учить слова');await page.getByText('Пропустить',{exact:true}).waitFor({state:'visible',timeout:15000});await capture('22-learn-guide');await clickExact(page,'Пропустить');const flip=page.getByRole('button',{name:'Перевернуть карточку'});await flip.waitFor({state:'visible',timeout:15000});await capture('23-learn-front');await flip.click();await page.waitForTimeout(350);await capture('24-learn-back');await back(page);await clickExact(page,'Завершить этап: тест');await page.getByText('Ответить',{exact:true}).waitFor({state:'visible',timeout:15000});await capture('25-stage-test-session');assert.ok(await finishStageTest(page),'Stage test did not reach results');await page.getByText('Результат этапа',{exact:true}).waitFor({state:'visible',timeout:15000});await capture('26-stage-test-results');
  return {steleFontSize};
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const target=await createHarness(browser,'target',targetUrl);const targetFlow=await runFlow(target,false);assert.deepEqual(target.failures,{consoleErrors:[],pageErrors:[],requestFailures:[],badResponses:[]},JSON.stringify(target.failures,null,2));
  const reference=await createHarness(browser,'reference',referenceUrl);let referenceFlow=null,referenceError='';try{referenceFlow=await runFlow(reference,true);}catch(error){referenceError=String(error?.stack||error);fs.writeFileSync(path.join(output,'reference-flow-error.txt'),referenceError);}
  const comparisons={};for(const name of Object.keys(target.captures)){if(!reference.captures[name])continue;comparisons[name]=comparePng(reference.captures[name].viewportFile,target.captures[name].viewportFile,path.join(output,`diff-${safeName(name)}.png`));comparisons[name].targetMetrics=target.captures[name].metrics;comparisons[name].referenceMetrics=reference.captures[name].metrics;}
  const ranked=Object.entries(comparisons).filter(([,v])=>v.status==='COMPARED').sort((a,b)=>b[1].ratio-a[1].ratio).map(([name,v])=>({name,ratio:v.ratio,pixels:v.pixels,total:v.total}));
  const report={version:'16.6.6',sourceSha:process.env.SOURCE_SHA||'',targetUrl,referenceUrl,viewport:{width:390,height:844},targetFlow,referenceFlow,referenceError,targetFailures:target.failures,referenceFailures:reference.failures,comparisons,ranked};fs.writeFileSync(path.join(output,'visual-comparison-16.6.6.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(output,'VISUAL_DIFF_RANKING.txt'),ranked.map((x,i)=>`${String(i+1).padStart(2,'0')}. ${x.name} — ${(x.ratio*100).toFixed(2)}%`).join('\n')+'\n');
  assert.ok(Object.keys(comparisons).length>=8,`Reference comparison coverage too low: ${Object.keys(comparisons).length}`);
  await target.context.close();await reference.context.close();await browser.close();console.log(`16.6.6 render QA complete: ${Object.keys(comparisons).length} paired states`);
})().catch(error=>{try{fs.writeFileSync(path.join(output,'render-qa-error.txt'),String(error?.stack||error));}catch{}console.error(error);process.exit(1);});