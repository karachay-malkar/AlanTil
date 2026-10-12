// UI uses an isolated wallet fixture; live SQL assertions are documented separately.
const assert=require('node:assert/strict');const cp=require('child_process');const {chromium}=require(process.env.ALANTIL_PLAYWRIGHT_MODULE||'playwright');const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'../..');const output=process.env.ALANTIL_TOWER_QA_OUTPUT||'/tmp/alantil-tower-qa';fs.mkdirSync(output,{recursive:true});
(async()=>{const server=cp.spawn('python3',['-m','http.server','8766','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});await new Promise(r=>setTimeout(r,500));const browser=await chromium.launch({...(process.env.ALANTIL_BROWSER_EXECUTABLE?{executablePath:process.env.ALANTIL_BROWSER_EXECUTABLE}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let state={silver:1000,gold:20,revision:0,elements:[]};let receipts=new Set(),failNext=true;
await page.route('**/src/features/tower/repository.js*',r=>r.fulfill({contentType:'text/javascript',body:`export function towerUserId(){return 'fixture'};export async function loadTower(){return(await fetch('/__tower_test')).json()};export async function mutateTower(op){const r=await fetch('/__tower_test',{method:'POST',body:JSON.stringify(op)});if(!r.ok)throw Error('Network response lost');return r.json()}` }));
await page.route('**/__tower_test',async r=>{if(r.request().method()==='POST'){const op=JSON.parse(r.request().postData());if(!receipts.has(op.id)){receipts.add(op.id);if(op.action==='place'){const price={stone:1,medium:4,long:8,big:24}[op.element.type];const amount=op.currency==='gold'?price/8:price;state[op.currency]-=amount;state.elements.push({...op.element,paidCurrency:op.currency,paidAmount:amount});}else if(op.action==='remove'){const b=state.elements.find(b=>b.id===op.elementId);state[b.paidCurrency]+=b.paidAmount;state.elements=state.elements.filter(b=>b.id!==op.elementId);}else if(op.action==='exchange_gold'){state.gold--;state.silver+=8;}state.revision++;}if(failNext){failNext=false;return r.fulfill({status:503,body:'lost'});}}await r.fulfill({contentType:'application/json',body:JSON.stringify(state)});});
await page.route('**/src/features/tower/scene.js*',async route=>{
 const response=await route.fetch(),raw=await response.text();
 const needle='return {setBlocks(value){';
 if(!raw.includes(needle))throw Error('debug scene anchor disappeared');
 await route.fulfill({contentType:'text/javascript',body:raw.replace(needle,"globalThis.__towerDebug={pickAt,getBlocks:()=>blocks,getTool:()=>tool,getCamera:()=>camera.position.toArray(),getTarget:()=>controls.target.toArray()};"+needle)});
});
await page.route('**/tower-fixture',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/shared/styles/app.css"><link rel="stylesheet" href="/src/features/tower/tower.css"><style>body{margin:0;background:#eee9df}#root{width:100%}</style><div class="appShell" id="app-shell"><div class="appViewport"><div class="appScreenHost"><main id="root"></main></div></div></div><script type="module">import {mount} from '/src/features/tower/index.js';mount({root:document.getElementById('root'),shell:{setHeaderContent(){},appShell:document.getElementById('app-shell')}});</script>`}));
await page.goto('http://127.0.0.1:8766/tower-fixture');await page.waitForSelector('.towerCanvas[data-ready=true]');await page.waitForFunction(()=>document.querySelector('[data-silver]').textContent==='1000');await page.locator('canvas').click({position:{x:640,y:450}});await page.locator('[data-confirm]').waitFor({state:'visible'});await page.locator('[data-confirm]').click();await page.locator('[data-retry]').waitFor({state:'visible'});assert.equal(state.silver,996);await page.locator('[data-retry]').click();await page.waitForFunction(()=>document.querySelector('[data-silver]').textContent==='996');assert.equal(state.elements.length,1);assert.equal(receipts.size,1);
console.log('DOCK_DIAGNOSTIC',JSON.stringify(await page.evaluate(()=>{
 const b=document.querySelector('[data-tool=select]'),dock=document.querySelector('.towerSide');
 return {buttonRect:b?.getBoundingClientRect().toJSON(),buttonDisplay:getComputedStyle(b).display,
   toolDisplay:getComputedStyle(b.parentElement).display,dockClasses:dock?.className,
   dockRect:dock?.getBoundingClientRect().toJSON(),catalogHidden:document.querySelector('.towerCatalogContent')?.hidden,
   catalogRect:document.querySelector('.towerCatalogContent')?.getBoundingClientRect().toJSON()};
})));
await page.screenshot({path:path.join(output,'tower-before-selection.png'),fullPage:true});
await page.locator('.towerOptions summary').click();await page.locator('[data-tool=select]').click();await page.locator('.towerOptions summary').click();await page.getByRole('button',{name:'Вся башня'}).click();await page.waitForTimeout(850);const box=await page.locator('canvas').boundingBox();
let selected=false;
for(const [ox,oy] of [[0,0],[0,-18],[0,18],[-18,0],[18,0],[-32,-24],[32,-24]]){
 console.log('PICK_DIAGNOSTIC',JSON.stringify(await page.evaluate(([x,y])=>({test:{x,y},hit:globalThis.__towerDebug?.pickAt(x,y),tool:globalThis.__towerDebug?.getTool(),blocks:globalThis.__towerDebug?.getBlocks()?.map(b=>({id:b.id,x:b.x,y:b.y,z:b.z,sx:b.sx,sy:b.sy,sz:b.sz})),camera:globalThis.__towerDebug?.getCamera(),target:globalThis.__towerDebug?.getTarget()}),[box.x+box.width/2+ox,box.y+box.height/2+oy])));
 await page.mouse.click(box.x+box.width/2+ox,box.y+box.height/2+oy);
 if(await page.locator('[data-remove]').isVisible()){selected=true;break;}
}
if(!selected){await page.screenshot({path:path.join(output,'tower-selection-failure.png'),fullPage:true});throw Error('Placed 3D element is not pickable in center camera view');}await page.locator('[data-remove]').click();await page.waitForFunction(()=>document.querySelector('[data-silver]').textContent==='1000');assert.equal(state.elements.length,0);
assert.equal(await page.locator('[data-item=medium]').count(),3);
assert.equal(await page.locator('[data-item=long]').count(),6);
assert.equal(await page.locator('[data-item=big]').count(),3);
assert.equal(await page.locator('[data-item=stone]').count(),0);
await page.locator('[data-item=big][data-config="2"]').click();
assert.equal(await page.locator('[data-dimension="0"]').inputValue(),'3');
assert.equal(await page.locator('[data-dimension="1"]').inputValue(),'4');
assert.equal(await page.locator('[data-dimension="2"]').inputValue(),'4');
assert.equal(await page.locator('.towerDimensions input[type=number]').count(),0,'stone size cannot be stretched');
await page.locator('canvas').click({position:{x:640,y:450}});
const draftCoords=await page.locator('[data-position]').evaluateAll(els=>els.map(x=>x.value));
await page.locator('[data-item=medium][data-config="1"]').click();
assert.equal(await page.locator('[data-confirm]').isVisible(),true,'ghost must survive a different category configuration');
assert.deepEqual(await page.locator('[data-position]').evaluateAll(els=>els.map(x=>x.value)),draftCoords);
await page.locator('[data-item=big][data-config="2"]').click();
assert.equal(await page.locator('[data-confirm]').isVisible(),true,'ghost must survive return to big stone');
assert.deepEqual(await page.locator('[data-position]').evaluateAll(els=>els.map(x=>x.value)),draftCoords);
assert.equal(state.elements.length,0,'catalogue changes are preview-only; no RPC mutation');
await page.locator('[data-quick=variant]').waitFor({state:'visible'});
await page.locator('[data-quick=variant]').click();
assert.match(await page.locator('[data-quick=variant]').innerText(),/2\/7/,'preview may change shape while preserving dimensions');
assert.equal(await page.locator('[data-dimension="0"]').inputValue(),'3');
await page.locator('.towerCurrency label').nth(1).click();
assert.equal(await page.locator('[name=tower-currency][value=gold]').isChecked(),true);
await page.locator('[data-confirm]').waitFor({state:'visible'});
assert.match(await page.locator('[data-confirm]').innerText(),/3/);
await page.locator('[data-confirm]').click();
await page.waitForFunction(()=>document.querySelector('[data-gold]').textContent==='17');
assert.deepEqual([state.elements[0].sx,state.elements[0].sy,state.elements[0].sz],[3,4,4]);
assert.equal(state.elements[0].variant,1,'server fixture must save selected authored shape variant');
await page.getByRole('button',{name:'Вся башня'}).click();await page.waitForTimeout(350);await page.locator('.towerOptions summary').click();await page.locator('[data-tool=select]').click();await page.locator('.towerOptions summary').click();await page.screenshot({path:path.join(output,'tower-built-desktop.png'),fullPage:true});
// A second adjoining model forces the real irregular-volume worker path.
const original=state.elements[0];
const second={...original,id:require('node:crypto').randomUUID(),x:original.x+original.sx,variant:1};
state.elements.push(second);state.revision++;
await page.locator('.towerOptions summary').click();await page.locator('[data-refresh]').click();
await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.masonryReady==='true',{timeout:30000});
await page.screenshot({path:path.join(output,'tower-infill-desktop.png'),fullPage:true});
const masonry=await page.locator('.towerCanvas').evaluate(el=>({coverage:el.dataset.masonryCoverage,fragments:el.dataset.masonryFragments}));
console.log('INFILL_QA',masonry);
assert.ok(Number(masonry.fragments)>0,'Real adjacent stones must generate volumetric rubble');
const physical=await page.locator('.towerCanvas').evaluate(el=>({
 total:Number(el.dataset.masonryTotalCoverage),stone:Number(el.dataset.masonryStoneCoverage),
 mortar:Number(el.dataset.masonryMortarVolume),leak:Number(el.dataset.masonryMortarForbiddenVolume),
 incomplete:el.dataset.masonryTruncated
}));
assert.ok(physical.total>=90,'Real WebGL must render at least 90% physical infill');
assert.ok(physical.stone>0&&physical.mortar>0,'Stone and solid mortar must both be present');
assert.equal(physical.leak,0,'Mortar forbidden in exterior 20% guard');
assert.equal(physical.incomplete,'false','Partial joint geometry is not acceptable');
await page.locator('.towerOptions summary').click();await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Вся башня'}).click();await page.waitForTimeout(720);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'tower-built-mobile.png'),fullPage:true});
for(const width of [320,768,1440]){
 await page.setViewportSize({width,height:844});
 await page.waitForTimeout(200);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal document overflow at '+width+'px');
 await page.screenshot({path:path.join(output,'tower-built-'+width+'.png'),fullPage:true});
}
// Real authored-mesh construction evidence for the full mandatory 2/5/15/50 scenes.
await page.setViewportSize({width:1280,height:900});
for(const count of [2,5,15,50]){
 state.elements=Array.from({length:count},(_,i)=>({
  id:'scene-'+count+'-'+i,type:'medium',x:(i%10)*2,y:0,z:Math.floor(i/10)*2,
  sx:2,sy:2,sz:2,rotation:0,variant:i%5,paidCurrency:'silver',paidAmount:4
 }));
 state.revision++;
 await page.locator('.towerOptions summary').click();
 await page.locator('[data-refresh]').click();
 await page.locator('.towerOptions summary').click();
 await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.masonryReady==='true',{timeout:60000});
 await page.getByRole('button',{name:'Вся башня'}).click();
 await page.waitForTimeout(620);
 await page.screenshot({path:path.join(output,'tower-scene-'+count+'-oblique.png'),fullPage:true});
 const frame=await page.locator('canvas').boundingBox();
 await page.mouse.move(frame.x+frame.width*.6,frame.y+frame.height*.4);
 await page.mouse.down();
 await page.mouse.move(frame.x+frame.width*.3,frame.y+frame.height*.4,{steps:18});
 await page.mouse.up();
 await page.waitForTimeout(400);
 await page.screenshot({path:path.join(output,'tower-scene-'+count+'-side.png'),fullPage:true});
 await page.locator('[data-layer]').evaluate(input=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForFunction(()=>document.querySelector('.towerCanvas')?.dataset.masonryReady==='true',{timeout:60000});
 await page.waitForTimeout(220);
 await page.screenshot({path:path.join(output,'tower-scene-'+count+'-section.png'),fullPage:true});
 await page.locator('[data-layer]').evaluate(input=>{input.value=input.max;input.dispatchEvent(new Event('input',{bubbles:true}));});
}
assert.deepEqual(errors,[]);console.log('PASS real WebGL desktop/mobile, purchase, lost response retry, selection, exact refund, 12 fixed catalog sizes, preserved stone variants, gold payment; no JS errors');}finally{await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exit(1)});
