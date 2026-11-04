import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import mockTowerOwnerRepository from './tower-owner-repository-mock.cjs';
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const out='reports/kunlum-visual-optimization';
await mkdir(out,{recursive:true});
const rows=[];
for(const mode of ['before','after']){
 for(const [name,width,height] of [['desktop',1280,800],['mobile',390,844]]){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,
   isMobile:name==='mobile',hasTouch:name==='mobile'});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(mode==='after')await mockTowerOwnerRepository(page);
  page.on('console',message=>{if(message.type()==='error'&&/WebGLProgram|shader error|glsl/i.test(message.text()))errors.push(message.text());});
  const start=Date.now(),port=mode==='before'?4174:4173;
  const row={mode,name,width,height};
  try{
   await page.goto('http://127.0.0.1:'+port+'/tests/fixtures/kunlum-tower-world.html',
    {waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>{
    const c=document.querySelector('.towerCanvas');
    return c?.dataset.kunlumWorldReady==='true'&&
     document.querySelector('#qa-root')?.dataset.mount==='success';
   },null,{timeout:100000});
   // WorldReady reports terrain/river, not the later async Common100 wall pass.
   // Both baselines must be compared after that second pass finishes.
   await page.waitForFunction(()=>{
    const el=document.querySelector('.towerCanvas');
    return Number(el?.dataset.kunlumStoneSegments||0)>0 &&
      el?.dataset.kunlumRuinEngine==='camera-chunk-lod-v4';
   },null,{timeout:100000});
   if(mode==='after')await page.waitForFunction(()=>
    document.querySelector('.towerCanvas')?.dataset.kunlumTerrainScan==='ready',
    null,{timeout:45000});
   await page.waitForTimeout(800);
   Object.assign(row,await page.locator('.towerCanvas').evaluate(el=>({
    engine:el.dataset.kunlumRuinEngine,
    segments:Number(el.dataset.kunlumStoneSegments||0),
    drawCalls:Number(el.dataset.towerDrawCalls||0),
    triangles:Number(el.dataset.towerTriangles||0),
    gpuGeometries:Number(el.dataset.towerGpuGeometries||0),
    gpuTextures:Number(el.dataset.towerGpuTextures||0),
    terrainEncoding:el.dataset.stoneTextureEncoding,
    terrainScan:el.dataset.kunlumTerrainScan||'unknown'
   })));
   row.readyMs=Date.now()-start;row.status='ready';
   await page.screenshot({path:out+'/'+mode+'-'+name+'.png',animations:'disabled'});
   if(!row.segments||!row.engine||errors.length)
    throw Error('Incomplete construction world '+JSON.stringify({row,errors}));
  }catch(error){row.status='error';row.error=String(error.message||error);row.pageErrors=errors;}
  rows.push(row);console.log(JSON.stringify(row));
  await ctx.close();
 }
}
await browser.close();
await writeFile(out+'/comparison.json',JSON.stringify(rows,null,2)+'\n');
if(rows.some(r=>r.status!=='ready'))process.exitCode=1;
// Guard against accidentally reintroducing heavy middle-distance geometry.
// Draw calls/triangles are comparable within the same headless WebGL runner;
// these are NOT a substitute for physical-phone FPS or equal terrain profiles.
for(const name of ['desktop','mobile']){
 const old=rows.find(r=>r.mode==='before'&&r.name===name);
 const fresh=rows.find(r=>r.mode==='after'&&r.name===name);
 if(old?.status!=='ready'||fresh?.status!=='ready')continue;
 const limit=name==='mobile'?1.15:1.45;
 const ratios=Object.fromEntries(['drawCalls','triangles'].map(key=>
  [key,+(fresh[key]/Math.max(1,old[key])).toFixed(3)]));
 console.log('TOWER_LOD_WEBGL_BUDGET',JSON.stringify({name,ratios,limit,
  before:{drawCalls:old.drawCalls,triangles:old.triangles},
  after:{drawCalls:fresh.drawCalls,triangles:fresh.triangles}}));
 if(Object.values(ratios).some(ratio=>ratio>limit)){
  console.error(name+' WebGL geometry budget exceeded',JSON.stringify({ratios,limit}));
  process.exitCode=1;
 }
}

