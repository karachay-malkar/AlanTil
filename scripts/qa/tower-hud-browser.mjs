import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';

const css=await readFile(new URL('../../src/features/tower/tower.css',import.meta.url),'utf8');
const shellCss=await readFile(new URL('../../src/shared/styles/shell.css',import.meta.url),'utf8');
const tokens=`:root{--safe-top:0px;--safe-bottom:0px;--safe-left:0px;--safe-right:0px;--line:#aaa;--line-soft:#ddd;--surface-0:#fff;--surface-1:#f0eee9;--app-bg:#f0eee9;--text-1:#292929;--text-2:#666;--danger:#a22;--accent-soft:#e2f7e7;--accent-strong:#3b8755;--font-body:Arial,sans-serif;--text-button:12px;--shadow-sm:0 3px 8px #0003;--z-header:20;--ui-button-disabled-opacity:.6;--ui-header-action-size:44px;--ui-header-action-icon-size:20px}html,body{margin:0;width:100%;height:100%;overflow:hidden}`;
const button=(label)=>`<button class="btn towerIconAction" aria-label="${label}">${label}</button>`;
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${tokens}\n${shellCss}\n${css}</style></head><body>
<div class="appShell" data-feature="tower"><header class="appHeader">
 <div class="appHeaderLeading"><button id="back" class="appHeaderAction">←</button></div></header>
 <main class="appViewport"><div class="appScreenHost"><section class="towerView"><div class="towerGame" data-mode="idle" data-explore="true" data-catalog-open="false">
 <div class="towerStage"><div class="towerCanvas"></div></div>
 <div class="towerTekmetWallet"><span class="towerTekmetIcon">◈</span><output>1250</output></div>
 <div class="towerQuickActions">${button('Поворот')}${button('Настройки')}</div>
 <div class="towerSettingsMenu" id="settings" hidden>${button('Очистить всё')}<span>Очистить башню</span></div>
 <div class="towerCamera">${button('К участку')}</div>
 <div class="towerPlacementBar" id="placement" hidden><div class="towerTekmetQuote">◈ 3</div>${button('Готово')}${button('Отмена')}${button('Поворот')}${button('Вариант')}${button('Отменить точку')}</div>
 <div class="towerBeamControls" id="beam" hidden>
 <div class="towerBeamRow"><span class="towerBeamLabel">Длина</span><button class="btn">↓</button><output>4,00 м</output><button class="btn">↑</button></div>
 <div class="towerBeamRow"><span class="towerBeamLabel">Смещение</span><button class="btn">←</button><button class="btn">→</button></div></div>
 <div class="towerSide" id="catalog"><button class="towerCatalogClose">×</button><div class="towerCatalogContent"><div class="towerCatalog"><div class="towerCatalogTabs"><button class="towerCatalogTab">Камни</button><button class="towerCatalogTab">Дерево</button><button class="towerCatalogTab">Крыша</button></div><div class="towerCatalogPanel">${Array.from({length:9},(_,i)=>`<button class="towerItem">Камень ${i+1}</button>`).join('')}</div></div></div></div>
 <button class="towerIconAction" data-hammer>Каталог</button></div></section></div></main>
 </div><div id="modalRoot"></div></body></html>`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
await mkdir('reports/tower-hud-browser',{recursive:true});
function overlap(a,b){return a&&b&&a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y}
const cases=[
 {width:360,height:800},{width:667,height:375},{width:844,height:390},{width:915,height:412}
];
for(const viewport of cases){
 const page=await browser.newPage({viewport,isMobile:false,reducedMotion:'reduce'});
 await page.setContent(html);
 const rect=async s=>page.locator(s).boundingBox();
 const back=await rect('#back'),wallet=await rect('.towerTekmetWallet');
 const headerRight=await rect('.towerQuickActions');
 if(!back||!wallet||!headerRight)throw Error('Header element missing '+JSON.stringify(viewport));
 if(overlap(back,wallet)||overlap(wallet,headerRight))
  throw Error('Header collision '+JSON.stringify({viewport,back,wallet,headerRight}));
 if(Math.abs(wallet.x+wallet.width/2-viewport.width/2)>2)
  throw Error('Wallet not centred '+JSON.stringify(viewport));
 await page.locator('#settings').evaluate(el=>el.hidden=false);
 const settings=await rect('#settings');
 if(!settings||settings.x<0||settings.x+settings.width>viewport.width||settings.y<0||settings.y+settings.height>viewport.height)
  throw Error('Settings invisible '+JSON.stringify({viewport,settings}));
 await page.locator('#settings').evaluate(el=>el.hidden=true);
 await page.locator('.towerGame').evaluate(el=>el.dataset.mode='placing');
 await page.locator('#placement').evaluate(el=>el.hidden=false);
 await page.locator('#beam').evaluate(el=>el.hidden=false);
 const placement=await rect('#placement'),beam=await rect('#beam');
 if(!placement||!beam)throw Error('Beam controls invisible '+JSON.stringify(viewport));
 if(overlap(beam,placement))throw Error('Beam and placement collide '+JSON.stringify({viewport,placement,beam}));
 for(const [name,r] of [['beam',beam],['placement',placement]]){
  if(r.x<0||r.y<0||r.x+r.width>viewport.width+1||r.y+r.height>viewport.height+1)
   throw Error(name+' clipped '+JSON.stringify({viewport,r}));
 }
 if((await rect('#back'))===null)throw Error('Back lost during placement');
 await page.locator('#beam').evaluate(el=>el.hidden=true);
 await page.locator('#placement').evaluate(el=>el.hidden=true);
 await page.locator('.towerGame').evaluate(el=>el.dataset.mode='roof');
 if(!(await page.locator('#back').isVisible()))throw Error('Back hidden in roofing');
 await page.locator('.towerGame').evaluate(el=>{el.dataset.mode='idle';el.dataset.catalogOpen='true'});
 await page.locator('#catalog').evaluate(el=>el.classList.add('is-open'));
 await page.waitForTimeout(220); // Measure settled layout, not the drawer's transition frame.
 const catalog=await rect('#catalog');
 if(!catalog||catalog.x<0||catalog.y<0||catalog.x+catalog.width>viewport.width+1||catalog.y+catalog.height>viewport.height+1)
  throw Error('Catalog clipped '+JSON.stringify({viewport,catalog}));
 if(viewport.width>viewport.height&&catalog.x<viewport.width/2)
  throw Error('Landscape drawer is not on the right '+JSON.stringify({viewport,catalog}));
 await page.screenshot({path:`reports/tower-hud-browser/${viewport.width}x${viewport.height}.png`});
 console.log('PASS responsive tower HUD',viewport.width+'x'+viewport.height);
 await page.close();
}
await browser.close();
