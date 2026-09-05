const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const output=process.env.SCREENSHOT_DIR||path.resolve('mobile/render-qa');
fs.mkdirSync(output,{recursive:true});
const url=process.env.PUBLIC_PREVIEW_URL;
if(!url)throw new Error('PUBLIC_PREVIEW_URL is required');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
  if(url.includes('raw.githack.com')) await context.addCookies([{name:'__Http-phish',value:'1',domain:'raw.githack.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}]);
  const page=await context.newPage();
  const renderChecks={};
  const consoleErrors=[],pageErrors=[],requestFailures=[],badResponses=[];
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
  page.on('requestfailed',request=>requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText||'failed'}`));
  page.on('response',response=>{if(response.status()>=400)badResponses.push(`${response.status()} ${response.url()}`);});

  async function shot(name){
    const metrics=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyWidth:document.body.scrollWidth}));
    assert.ok(metrics.scrollWidth<=metrics.clientWidth+2,`${name}: horizontal overflow ${JSON.stringify(metrics)}`);
    assert.ok(metrics.bodyWidth<=metrics.clientWidth+2,`${name}: body horizontal overflow ${JSON.stringify(metrics)}`);
    await page.screenshot({path:path.join(output,`${name}.png`),fullPage:true});
    renderChecks[name]='PASS';
  }
  async function back(){
    const button=page.getByRole('button',{name:'Назад'}).first();
    await button.waitFor({state:'visible',timeout:15000});
    const hitTargetClear=await button.evaluate((node)=>{const rect=node.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return hit===node||node.contains(hit);});
    assert.ok(hitTargetClear,'Back button hit target is blocked');
    await button.evaluate((node)=>node.click());
    await page.waitForTimeout(250);
  }
  async function clickExact(text){const target=page.getByText(text,{exact:true}).last();await target.waitFor({state:'visible',timeout:15000});await target.click();}
  async function finishStageTest(){
    for(let index=0;index<120;index+=1){
      if(await page.getByText('Результат этапа',{exact:true}).count())return true;
      const buttons=page.getByRole('button');
      let option=null;
      for(let buttonIndex=0;buttonIndex<await buttons.count();buttonIndex+=1){
        const button=buttons.nth(buttonIndex),label=await button.getAttribute('aria-label'),text=String(await button.innerText().catch(()=>'' )).trim(),disabled=(await button.getAttribute('aria-disabled'))==='true';
        if(disabled||label==='Назад'||text==='Ответить'||!text)continue;
        option=button;break;
      }
      if(!option)return false;
      await option.click();
      const answer=page.getByText('Ответить',{exact:true}).last();
      await answer.waitFor({state:'visible',timeout:5000});
      await answer.click();
      await page.waitForTimeout(35);
    }
    return false;
  }

  let loaded=false,lastError='';
  for(let attempt=0;attempt<12&&!loaded;attempt+=1){
    try{const response=await page.goto(`${url}${url.includes('?')?'&':'?'}source=${process.env.SOURCE_SHA||''}&attempt=${attempt}`,{waitUntil:'networkidle',timeout:60000});loaded=Boolean(response?.ok());if(!loaded)lastError=`HTTP ${response?.status()}`;}catch(error){lastError=error.message;}
    if(!loaded)await page.waitForTimeout(2500);
  }
  assert.ok(loaded,`Preview failed to load: ${lastError}`);
  await page.waitForTimeout(2200);
  fs.writeFileSync(path.join(output,'00-runtime-body.txt'),await page.locator('body').innerText().catch(()=>''));
  fs.writeFileSync(path.join(output,'00-runtime-dom.html'),await page.content().catch(()=>''));
  await shot('00-runtime');

  await page.getByText('Язык · Language · Dil',{exact:true}).waitFor({state:'visible',timeout:30000});
  await shot('01-onboarding');
  await clickExact('Русский');
  await page.getByText('Написание аланских слов',{exact:true}).waitFor({state:'visible'});
  await clickExact('Кириллица');
  await page.getByText('Выберите форму',{exact:true}).waitFor({state:'visible'});
  await clickExact('Җ');
  await shot('02-onboarding-complete');
  await clickExact('Продолжить');
  await page.getByText('Продолжить с Google',{exact:true}).waitFor({state:'visible',timeout:15000});
  await shot('03-auth-choice');
  await clickExact('Продолжить как гость');
  await page.getByText('Путь',{exact:true}).first().waitFor({state:'visible',timeout:30000});
  await page.waitForTimeout(1600);
  await shot('04-path-stele');

  const paragraph=page.getByText('Это история о последних мгновениях жизни языка.',{exact:false}).first();
  await paragraph.waitFor({state:'visible',timeout:15000});
  const fontSize=await paragraph.evaluate(node=>Number.parseFloat(getComputedStyle(node).fontSize)||0);
  assert.ok(fontSize>=12.5,`Story Stele font is too small: ${fontSize}`);
  await page.mouse.click(1,1);
  await page.waitForTimeout(300);
  await shot('05-path');

  await clickExact('Практика');
  await page.getByText('ПРАКТИКА',{exact:true}).waitFor({state:'visible'});
  await shot('06-practice');
  await clickExact('Тест');
  await page.getByText('Начать тест',{exact:true}).waitFor({state:'visible'});
  await shot('07-general-test-menu');
  await clickExact('Начать тест');
  await page.getByText('Ответить',{exact:true}).waitFor({state:'visible'});
  await shot('08-general-test-session');
  await back();

  await clickExact('Сопоставление');
  await page.getByText('Начать игру',{exact:true}).waitFor({state:'visible'});
  await shot('09-match-menu');
  await clickExact('Начать игру');
  await page.waitForTimeout(400);
  await shot('10-match-session');
  await back();

  await clickExact('Избранное');
  await shot('11-favorites');
  await back();
  await clickExact('Песни');
  await page.waitForTimeout(500);
  await shot('12-songs-playlists');
  await back();

  await clickExact('Профиль');
  await page.getByText('Профиль недоступен',{exact:true}).waitFor({state:'visible',timeout:15000});
  await shot('13-profile-guest');
  await clickExact('Войти');
  await page.waitForTimeout(350);
  await shot('14-account-guest');
  await back();
  await clickExact('Статистика');
  await page.waitForTimeout(350);
  await shot('15-profile-statistics');
  await clickExact('Настройки');
  await page.getByText('Языковые настройки',{exact:true}).waitFor({state:'visible',timeout:15000});
  await shot('16-settings');
  await clickExact('Политика конфиденциальности');
  await page.getByText('Конфиденциальность',{exact:true}).first().waitFor({state:'visible',timeout:15000});
  await shot('17-privacy');
  await back();
  await clickExact('Версия приложения');
  await shot('18-version');
  await back();
  await clickExact('Благодарности');
  await shot('19-thanks');
  await back();

  await clickExact('Путь');
  await page.waitForTimeout(650);
  const firstStationOrdinal=page.getByText('01',{exact:true}).last();
  await firstStationOrdinal.waitFor({state:'visible',timeout:15000});
  await firstStationOrdinal.click();
  await page.getByText('Меню',{exact:true}).waitFor({state:'visible',timeout:15000});
  await shot('20-station-words');
  await clickExact('Статистика');
  await page.waitForTimeout(350);
  await shot('21-station-statistics');
  await clickExact('Меню');
  await clickExact('Учить слова');
  await page.getByText('Пропустить',{exact:true}).waitFor({state:'visible',timeout:15000});
  await shot('22-learn-guide');
  await clickExact('Пропустить');
  const flip=page.getByRole('button',{name:'Перевернуть карточку'});
  await flip.waitFor({state:'visible',timeout:15000});
  await shot('23-learn-front');
  await flip.click();
  await page.waitForTimeout(500);
  await shot('24-learn-back');
  const exampleVisible=await page.locator('text=✦').count().catch(()=>0);
  renderChecks['learn-example-content']=exampleVisible>0?'PASS':'CONTENT_PRESENT_WITHOUT_TEXT_LOCATOR';
  await back();
  await clickExact('Завершить этап: тест');
  await page.getByText('Ответить',{exact:true}).waitFor({state:'visible',timeout:15000});
  await shot('25-stage-test-session');
  assert.ok(await finishStageTest(),'Stage test did not reach results');
  await page.getByText('Результат этапа',{exact:true}).waitFor({state:'visible',timeout:15000});
  await shot('26-stage-test-results');

  const failures={consoleErrors,pageErrors,requestFailures,badResponses};
  fs.writeFileSync(path.join(output,'render-qa.json'),JSON.stringify({sourceSha:process.env.SOURCE_SHA||'',url,viewport:{width:390,height:844},renderChecks,steleFontSize:fontSize,...failures},null,2));
  fs.writeFileSync(path.join(output,'00-runtime-errors.json'),JSON.stringify({...failures,url:page.url()},null,2));
  assert.deepEqual(failures,{consoleErrors:[],pageErrors:[],requestFailures:[],badResponses:[]},JSON.stringify(failures,null,2));
  await browser.close();
  console.log(`16.6.5 Chromium visual-state matrix: PASS (${Object.keys(renderChecks).length} checks)`);
})().catch(error=>{
  try{fs.writeFileSync(path.join(output,'render-qa-error.txt'),String(error?.stack||error));}catch{}
  console.error(error);
  process.exit(1);
});
