import {spawn,spawnSync} from "node:child_process";
import {readFile,writeFile,rm,mkdtemp,mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

const ROOT="http://127.0.0.1:4173", sleep=ms=>new Promise(r=>setTimeout(r,ms));
const CHROME=process.env.CHROME_PATH||"google-chrome";
const tmp=await mkdtemp(join(tmpdir(),"tower-speed-"));
const results=[],errors=[];
await mkdir("perf-results",{recursive:true});

const fixture=[
'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>',
'<div id="mount" style="width:95vw;height:85vh"></div><script type="module">',
'import {createTowerScene} from "/src/features/tower/prefab-scene.js?v=17.2.6";',
'import {APPROVED_PREFAB_VERSION} from "/packages/tower-game/approved-prefab.mjs";',
'import * as THREE from "/src/vendor/three/three.module.js";',
'const out=window.__towerProbe={done:false,stages:[],renderCount:0};',
'const original=THREE.WebGLRenderer.prototype.render;',
'THREE.WebGLRenderer.prototype.render=function(...args){out.renderCount++;return original.apply(this,args)};',
'try{',
' const now=performance.now();const scene=await createTowerScene(document.querySelector("#mount"));',
' out.createSceneMs=Math.round(performance.now()-now);',
' for(const count of [1,5,10,20]){',
'  const blocks=Array.from({length:count},(_,i)=>({id:"bench-"+i,type:"masonry_section",sectionId:"1x1x1",variant:0,rotation:0,geometryVersion:APPROVED_PREFAB_VERSION,x:(i%5)*8,y:0,z:Math.floor(i/5)*8}));',
'  const t=performance.now();await scene.setBlocks(blocks);',
'  out.stages.push({count,ms:Math.round(performance.now()-t),rendered:document.querySelector("#mount").dataset.prefabCount,error:document.querySelector("#mount").dataset.prefabError||null});',
' }',
' const before=out.renderCount,t=performance.now();await new Promise(r=>setTimeout(r,2500));',
' out.idleRenderCount=out.renderCount-before;out.idleSeconds=(performance.now()-t)/1000;',
' scene.dispose();',
'}catch(e){out.error=String(e?.stack||e)}finally{out.done=true}',
'</script></body></html>'
].join("\n");
await writeFile("tower-perf-fixture.html",fixture);

async function scenario(name,width,height,dpr,cpu,slowNetwork){
 const dir=join(tmp,name);await mkdir(dir);
 const seed=spawnSync(process.execPath,["scripts/qa/seed-lighthouse-profile.mjs",dir],{encoding:"utf8",timeout:35000,env:{...process.env,CHROME_PATH:CHROME,ALANTIL_SEED_STORAGE_ONLY:"1"}});
 if(seed.status!==0)throw Error("Could not seed authenticated-like learning setup: "+seed.stderr+" "+seed.stdout);
 await rm(join(dir,"DevToolsActivePort"),{force:true});
 const browser=spawn(CHROME,["--headless=new","--no-sandbox","--disable-dev-shm-usage","--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-webgl","--remote-debugging-port=0","--user-data-dir="+dir,"about:blank"],{stdio:"ignore"});
 let ws;
 try{
  let port=0;
  for(let i=0;i<150;i++){if(browser.exitCode!==null)throw Error("Chrome exited");try{port=+((await readFile(join(dir,"DevToolsActivePort"),"utf8")).split("\n")[0]);if(port)break}catch{}await sleep(100)}
  if(!port)throw Error("No debugging port");
  let tab;
  for(let i=0;i<100;i++){const tabs=await(await fetch("http://127.0.0.1:"+port+"/json/list")).json();tab=tabs.find(x=>x.type==="page"&&x.webSocketDebuggerUrl);if(tab)break;await sleep(100)}
  if(!tab)throw Error("No page");
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true})});
  let id=0;const pending=new Map(),requestMap=new Map(),completed=[];
  const exceptions=[],browserConsole=[];
  ws.addEventListener("message",ev=>{
   const m=JSON.parse(ev.data);
   if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result||{});return}
   if(m.method==="Network.requestWillBeSent"){requestMap.set(m.params.requestId,{url:m.params.request.url,bytes:0,status:null,fromSW:false,cache:false})}
   else if(m.method==="Network.responseReceived"){const x=requestMap.get(m.params.requestId);if(x){x.status=m.params.response.status;x.fromSW=!!m.params.response.fromServiceWorker;x.cache=!!m.params.response.fromDiskCache}}
   else if(m.method==="Network.loadingFinished"){const x=requestMap.get(m.params.requestId);if(x){x.bytes=m.params.encodedDataLength||0;completed.push({...x})}}
   else if(m.method==="Runtime.exceptionThrown")exceptions.push(m.params?.exceptionDetails?.text||"exception");
   else if(m.method==="Runtime.consoleAPICalled")browserConsole.push({type:m.params.type,text:(m.params.args||[]).map(x=>x.value||x.description||"").join(" ").slice(0,1200)});
   else if(m.method==="Log.entryAdded")browserConsole.push({type:"browserLog",text:m.params.entry?.text});
  });
  const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error("Timeout "+method))},18000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}))});
  const evalJS=async expression=>{const r=await call("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error("Browser:"+r.exceptionDetails.text);return r.result?.value};
  const wait=async(expr,label,timeout=90000)=>{const since=Date.now();while(Date.now()-since<timeout){try{const v=await evalJS(expr);if(v)return v}catch{}await sleep(250)}throw Error("Timed out "+label)};
  const metrics=async()=>Object.fromEntries((await call("Performance.getMetrics")).metrics.map(x=>[x.name,x.value]));
  const traffic=start=>{const all=completed.slice(start),tower=all.filter(x=>x.url.includes("/assets/tower/"));return {requests:all.length,bytes:all.reduce((a,b)=>a+b.bytes,0),towerRequests:tower.length,towerBytes:tower.reduce((a,b)=>a+b.bytes,0),large:tower.sort((a,b)=>b.bytes-a.bytes).slice(0,8).map(x=>({asset:new URL(x.url).pathname,bytes:x.bytes,fromSW:x.fromSW,cache:x.cache}))}};
  await Promise.all([call("Page.enable"),call("Runtime.enable"),call("Network.enable"),call("Performance.enable"),call("Log.enable")]);
  await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:dpr,mobile:width<600});
  if(cpu>1)await call("Emulation.setCPUThrottlingRate",{rate:cpu});
  if(slowNetwork)await call("Network.emulateNetworkConditions",{offline:false,latency:60,downloadThroughput:1900000,uploadThroughput:450000});
  const opens=[];
  for(const phase of ["cold","warm"]){
   const from=completed.length,started=Date.now();
   await call("Page.navigate",{url:ROOT+"/practice/tower"});
   try { await wait('document.querySelector(".towerCanvas")?.dataset.ready==="true" || Boolean(document.querySelector(".errorState"))',"3D canvas first ready or route error",16000); if(await evalJS('Boolean(document.querySelector(".errorState"))'))throw Error("Route error screen"); }
   catch(error) {
    const debug=await evalJS('({url:location.href,title:document.title,canvas:Boolean(document.querySelector(".towerCanvas")),root:document.querySelector("#appRoot")?.innerText?.slice(0,750),webgl2:Boolean(document.createElement("canvas").getContext("webgl2")),body:document.body?.innerText?.slice(0,600),readyState:document.readyState})').catch(e=>({error:String(e)}));
    const traffic=completed.slice(from).slice(-25).map(x=>({url:x.url.slice(0,160),bytes:x.bytes,status:x.status}));
    errors.push({scenario:name,phase,debug,uncaught:exceptions,console:browserConsole,network:traffic});
    console.error("TOWER_DIAGNOSTIC",JSON.stringify({scenario:name,phase,debug,uncaught:exceptions,console:browserConsole.slice(-15),network:traffic.slice(-12)}));
    throw new Error("3D browser debug "+JSON.stringify(debug));
   }
   const readyMs=Date.now()-started;
   await wait('document.querySelector(".towerCanvas")?.dataset.prefabReady==="true"',"empty tower set ready",35000);
   const openMs=Date.now()-started,texture=await evalJS('document.querySelector(".towerCanvas")?.dataset.stoneTextureEncoding');
   const before=await metrics();
   const frame=await evalJS('new Promise(resolve=>{let frames=0,long=0,max=0,prev=0,start=performance.now();function tick(t){frames++;if(prev){let d=t-prev;max=Math.max(max,d);if(d>50)long++;}prev=t;if(t-start<2500)requestAnimationFrame(tick);else resolve({frames,ms:t-start,long,maxGap:Math.round(max)});}requestAnimationFrame(tick)})');
   const after=await metrics();
   const t=traffic(from);
   opens.push({phase,readyMs,openMs,texture,fps:+(1000*frame.frames/frame.ms).toFixed(1),frame,
    taskShare:+((after.TaskDuration-before.TaskDuration)/(frame.ms/1000)).toFixed(3),
    heapMB:+(after.JSHeapUsedSize/1048576).toFixed(1),domNodes:after.Nodes,...t});
   if(phase==="cold")await sleep(500);
  }
  const begin=completed.length;
  await call("Page.navigate",{url:ROOT+"/tower-perf-fixture.html"});
  await wait('window.__towerProbe?.done===true',"authored prefab benchmark",140000);
  const fixtureResult=await evalJS("window.__towerProbe");
  await sleep(300);
  const item={scenario:name,settings:{width,height,dpr,cpu,slowNetwork},opens,prefab:{...fixtureResult,...traffic(begin)},exceptions};
  results.push(item);console.log("TOWER_BENCH_RESULT",JSON.stringify(item));
  if(fixtureResult.error)errors.push(name+": "+fixtureResult.error);
 }catch(e){errors.push(name+": "+String(e));console.error("TOWER_BENCH_FAILURE",name,e);}
 finally{try{ws?.close()}catch{}browser.kill("SIGTERM");await sleep(500);if(browser.exitCode===null)browser.kill("SIGKILL")}
}
try{
 await scenario("desktop-1280",1280,800,1,1,false);
 await scenario("android-emulated-390",390,844,2,3,true);
}finally{
 await rm("tower-perf-fixture.html",{force:true});
 await rm(tmp,{recursive:true,force:true,maxRetries:3});
 await writeFile("perf-results/tower-editor-speed.json",JSON.stringify({results,errors},null,2));
}
if(!results.length)process.exitCode=1;
