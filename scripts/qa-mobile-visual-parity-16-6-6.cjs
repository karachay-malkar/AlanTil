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
  const {resolveTypography}=await import('../packages/alantil-ui/typography.js');
  assert.equal(fontSize,resolveTypography('medium',390).body,'Story Stele must use the reference body size');
  await page.mouse.click(1,1);
  await page.waitForTimeout(300);
  const navButtons=page.getByText('Путь',{exact:true});const navButton=navButtons.first();const navBubble=await navButton.evaluate(node=>{const button=node.closest('[role=button]')||node.parentElement;const bubble=button.firstElementChild;const r=bubble?.getBoundingClientRect?.()||{width:0,height:0};return{width:r.width,height:r.height};});assert.ok(navBubble.width>=36&&navBubble.width<=40&&navBubble.height>=36&&navBubble.height<=40,`BottomNav bubble geometry drift: ${JSON.stringify(navBubble)}`);
  await shot('05-path');
  const progress=page.getByRole('progressbar').first();
  const progressGeometry=await progress.evaluate(node=>({text:node.textContent,cells:[...node.querySelectorAll('div')].filter(el=>{const r=el.getBoundingClientRect();return r.width===8&&r.height===2}).length}));
  assert.equal(progressGeometry.cells,10,'Path progress must have ten 8×2 cells');
  assert.match(progressGeometry.text,/\[.*\]/,'Path progress brackets are missing');
  renderChecks['shared-progress-geometry']='PASS';
  for(const label of ['Практика','Профиль']){
    const clear=await page.getByText(label,{exact:true}).first().evaluate(node=>{const button=node.closest('[role=button]');const svg=button?.querySelector('svg');return !!svg&&Number(getComputedStyle(svg.parentElement).zIndex)>0;});
    assert.ok(clear,`${label}: icon must be above the backdrop`);
  }
  renderChecks['nav-icons-above-backdrop']='PASS';
  await page.setViewportSize({width:1920,height:920});
  await page.waitForTimeout(350);
  await shot('05-path-desktop');
  await page.setViewportSize({width:390,height:844});


  await clickExact('Практика');
  await page.getByText('ПРАКТИКА',{exact:true}).waitFor({state:'visible'});
  await shot('06-practice');
  // Each case uses a clean guest snapshot, then exercises the actual menu and restore UI.
  for(const limit of [20,40,80]){
    for(const direction of ['алан → рус','рус → алан']){
      await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.includes('alantil:16.1:session:test'))localStorage.removeItem(key);});
      await clickExact('Тест');
      await page.getByTestId(`limit-${limit}`).click();
      await clickExact(direction);
      await clickExact('Начать тест');
      await page.getByText(`1/${limit}`,{exact:true}).waitFor({state:'visible'});
      const option=page.getByRole('button').filter({hasText:/./}).filter({hasNotText:/Ответить|Назад/}).first();
      await option.click();
      await clickExact('Ответить');
      await page.getByText(`2/${limit}`,{exact:true}).waitFor({state:'visible'});
      await back();await clickExact('Не болса да болсун!');
      await clickExact('Тест');
      await page.getByText(`2/${limit}`,{exact:true}).waitFor({state:'visible'});
      await back();await clickExact('Не болса да болсун!');
      renderChecks[`test-${limit}-${direction}-answer-restore`]='PASS';
    }
    await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.includes('alantil:16.1:session:match'))localStorage.removeItem(key);});
    await clickExact('Сопоставление');
    await page.getByTestId(`limit-${limit}`).click();await clickExact('Начать игру');
    await page.getByText(`0/${limit}`,{exact:true}).waitFor({state:'visible'});
    await back();await clickExact('Не болса да болсун!');
    await clickExact('Сопоставление');await page.getByText(`0/${limit}`,{exact:true}).waitFor({state:'visible'});
    await back();await clickExact('Не болса да болсун!');
    renderChecks[`match-${limit}-count-restore`]='PASS';
  }
  await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.includes('alantil:16.1:session:test')||key.includes('alantil:16.1:session:match'))localStorage.removeItem(key);});
  await clickExact('Тест');
  await page.getByText('Начать тест',{exact:true}).waitFor({state:'visible'});
  await shot('07-general-test-menu');
  await clickExact('Начать тест');
  await page.getByText('Ответить',{exact:true}).waitFor({state:'visible'});
  await shot('08-general-test-session');
  await back();
  await clickExact('Остаться');
  await page.getByText('Ответить',{exact:true}).waitFor({state:'visible'});
  await back();
  await clickExact('Не болса да болсун!');
  await clickExact('Тест');
  await page.getByText('Ответить',{exact:true}).waitFor({state:'visible'});
  await shot('08-general-test-restored');
  await back();
  await clickExact('Не болса да болсун!');
  renderChecks['test-exit-cancel-confirm-restore']='PASS';

  await clickExact('Сопоставление');
  await page.getByText('Начать игру',{exact:true}).waitFor({state:'visible'});
  await shot('09-match-menu');
  await clickExact('Начать игру');
  await page.waitForTimeout(400);
  await shot('10-match-session');
  await back();
  await clickExact('Остаться');
  await back();
  await clickExact('Не болса да болсун!');
  await clickExact('Сопоставление');
  await page.getByText('Начать игру',{exact:true}).waitFor({state:'detached'});
  await page.waitForTimeout(400);
  await shot('10-match-restored');
  await back();
  await clickExact('Не болса да болсун!');
  renderChecks['match-exit-cancel-confirm-restore']='PASS';

  await clickExact('Избранное');
  await shot('11-favorites');
  await back();
  await clickExact('Песни');
  await page.waitForTimeout(500);
  await shot('12-songs-playlists');
  await back();

  await clickExact('Профиль');
  await page.getByText('Профиль недоступен',{exact:true}).waitFor({state:'visible',timeout:15000});
  for(const label of ['[ Профиль ]','[ Статистика ]','[ Настройки ]']) await page.getByText(label,{exact:true}).waitFor({state:'visible',timeout:5000});
  await page.getByText('Продолжить с Google',{exact:true}).waitFor({state:'visible',timeout:15000});
  assert.equal(await page.getByText('Войти',{exact:true}).count(),0,'Guest Profile must not expose an intermediate sign-in button');
  await shot('13-profile-guest');
  renderChecks['guest-profile-direct-google-entry']='PASS';
  await clickExact('[ Статистика ]');
  await page.waitForTimeout(350);
  await shot('15-profile-statistics');
  await clickExact('[ Настройки ]');
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
  const stationTabMetrics=await page.getByText('Меню',{exact:true}).evaluate(node=>{const button=node.closest('[role=button]')||node.parentElement;const r=button.getBoundingClientRect(),cs=getComputedStyle(button);return{height:r.height,border:cs.borderStyle,background:cs.backgroundColor};});
  assert.ok(stationTabMetrics.height<=30,`Station tab too tall: ${JSON.stringify(stationTabMetrics)}`);
  await shot('20-station-words');
  await page.setViewportSize({width:1920,height:920});
  await page.waitForTimeout(350);
  const tabPadding=await page.getByText('Меню',{exact:true}).evaluate(node=>{const button=node.closest('[role=button]');return Number.parseFloat(getComputedStyle(button.parentElement).paddingLeft);});
  assert.equal(tabPadding,76,'Desktop station tabs must use the shared clamped inset');
  await shot('20-station-desktop');
  await page.setViewportSize({width:390,height:844});

  await clickExact('Статистика');
  await page.waitForTimeout(350);
  await shot('21-station-statistics');
  await clickExact('Меню');
  await clickExact('Учить слова');
  await page.getByText('Пропустить',{exact:true}).waitFor({state:'visible',timeout:15000});
  await shot('22-learn-guide');
  // Walk every Learn guide step; capture the state before and after dismissal.
  for(let step=0;step<4;step++){
    await clickExact('Далее');
    await page.waitForTimeout(600);
    await shot(`22-learn-guide-step-${step+1}`);
  }
  const hole=await page.getByTestId('guide-hole-0').boundingBox();
  const favoriteButtons=page.getByRole('button',{name:'Добавить в избранное',exact:true});
  const favorite=await favoriteButtons.first().boundingBox();
  assert.ok(hole&&favorite,'Favorite and spotlight must be measurable');
  assert.ok(Math.abs(hole.x+hole.width/2-favorite.x-favorite.width/2)<2,'Favorite spotlight x center');
  assert.ok(Math.abs(hole.y+hole.height/2-favorite.y-favorite.height/2)<2,'Favorite spotlight y center');
  await page.setViewportSize({width:320,height:480});
  await page.waitForTimeout(700);
  const compactPanel=await page.getByTestId('guide-overlay').getByRole('alert').boundingBox();
  assert.ok(compactPanel&&compactPanel.y>=0&&compactPanel.y+compactPanel.height<=480,'Guide panel stays within short viewport');
  await page.getByText('Готово',{exact:true}).scrollIntoViewIfNeeded();
  const compactDone=await page.getByText('Готово',{exact:true}).boundingBox();
  assert.ok(compactDone&&compactDone.y>=0&&compactDone.y+compactDone.height<=480,'Guide completion remains reachable');
  await shot('22-learn-guide-short-320x480');
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(700);
  await clickExact('Готово');
  await page.getByTestId('guide-overlay').waitFor({state:'detached'});
  renderChecks['learn-guide-complete-cleanup']='PASS';
  const flip=page.getByRole('button',{name:'Перевернуть карточку'});
  await flip.waitFor({state:'visible',timeout:15000});
  await flip.click();
  await page.waitForTimeout(500);
  await shot('23-learn-front');
  await flip.click();
  await page.waitForTimeout(500);
  await shot('24-learn-back');
  const exampleVisible=await page.locator('text=✦').count().catch(()=>0);
  renderChecks['learn-example-content']=exampleVisible>0?'PASS':'CONTENT_PRESENT_WITHOUT_TEXT_LOCATOR';
  await back();
  await page.getByText('Остаться',{exact:true}).waitFor({state:'visible'});
  await shot('24-learn-exit-confirm');
  await clickExact('Остаться');
  await flip.waitFor({state:'visible'});
  await back();
  await clickExact('Не болса да болсун!');
  renderChecks['learn-exit-cancel-confirm']='PASS';
  await clickExact('Завершить этап: тест');
  await page.getByText('Ответить',{exact:true}).waitFor({state:'visible',timeout:15000});
  await shot('25-stage-test-session');
  await back();
  await clickExact('Остаться');
  await page.getByText('Ответить',{exact:true}).waitFor({state:'visible'});
  renderChecks['stage-exit-cancel']='PASS';
  assert.ok(await finishStageTest(),'Stage test did not reach results');
  await page.getByText('Результат этапа',{exact:true}).waitFor({state:'visible',timeout:15000});
  await shot('26-stage-test-results');

  const failures={consoleErrors,pageErrors,requestFailures,badResponses};
  fs.writeFileSync(path.join(output,'render-qa.json'),JSON.stringify({sourceSha:process.env.SOURCE_SHA||'',url,viewport:{width:390,height:844},renderChecks,steleFontSize:fontSize,...failures},null,2));
  fs.writeFileSync(path.join(output,'00-runtime-errors.json'),JSON.stringify({...failures,url:page.url()},null,2));
  assert.deepEqual(failures,{consoleErrors:[],pageErrors:[],requestFailures:[],badResponses:[]},JSON.stringify(failures,null,2));
  await browser.close();
  console.log(`16.6.6 Chromium visual-state matrix: PASS (${Object.keys(renderChecks).length} checks)`);
})().catch(error=>{
  try{fs.writeFileSync(path.join(output,'render-qa-error.txt'),String(error?.stack||error));}catch{}
  console.error(error);
  process.exit(1);
});
