import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtemp,readFile,writeFile,mkdir,rm} from "node:fs/promises";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";

const mode=process.argv[2]||"baseline";
const output=resolve(process.argv[3]||"visible-first-results");
const run=Number(process.argv[4]||1);
assert.ok(["baseline","visible-first"].includes(mode));
await mkdir(output,{recursive:true});
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const profile=await mkdtemp(join(tmpdir(),"alantil-visible-"));
const chrome=spawn(process.env.CHROME_PATH||"google-chrome",[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--no-first-run","--no-default-browser-check","--remote-debugging-port=0",
  "--user-data-dir="+profile,"about:blank"
],{stdio:"ignore"});
let ws;
const pending=new Map();
const requests=new Map();
let seq=0;
try {
  let port=0;
  for(let i=0;i<180;i++){
    try{port=Number((await readFile(join(profile,"DevToolsActivePort"),"utf8")).split("\n")[0]);if(port)break;}catch{}
    if(chrome.exitCode!==null)throw Error("Chrome process exited during launch");
    await sleep(100);
  }
  assert.ok(port,"Chrome CDP port unavailable");
  const targets=await(await fetch("http://127.0.0.1:"+port+"/json/list")).json();
  const target=targets.find(x=>x.type==="page"&&x.webSocketDebuggerUrl);
  assert.ok(target,"Chrome page target unavailable");
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok,bad)=>{ws.addEventListener("open",ok,{once:true});ws.addEventListener("error",bad,{once:true});});
  ws.addEventListener("message",event=>{
    const msg=JSON.parse(event.data);
    if(msg.id){
      const cb=pending.get(msg.id);
      if(cb){pending.delete(msg.id);clearTimeout(cb.timer);msg.error?cb.reject(Error(JSON.stringify(msg.error))):cb.resolve(msg.result||{});}
    }else if(msg.method==="Network.requestWillBeSent"){
      const p=msg.params;requests.set(p.requestId,{url:p.request.url,start:p.timestamp});
    }else if(msg.method==="Network.responseReceived"){
      const q=requests.get(msg.params.requestId);
      if(q){q.status=msg.params.response.status;q.fromSW=msg.params.response.fromServiceWorker;}
    }else if(msg.method==="Network.loadingFinished"){
      const q=requests.get(msg.params.requestId);
      if(q){q.end=msg.params.timestamp;q.bytes=msg.params.encodedDataLength;}
    }
  });
  function command(method,params={}){
    return new Promise((resolve,reject)=>{
      const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error("CDP timeout "+method));},15000);
      pending.set(id,{timer,resolve,reject});
      ws.send(JSON.stringify({id,method,params}));
    });
  }
  async function evaluate(expression){
    const r=await command("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  }
  await command("Page.enable");
  await command("Network.enable");
  await command("Runtime.enable");
  await command("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await command("Emulation.setCPUThrottlingRate",{rate:4});
  await command("Network.setBypassServiceWorker",{bypass:true});
  await command("Network.setCacheDisabled",{cacheDisabled:true});
  await command("Network.emulateNetworkConditions",{
    offline:false,latency:120,downloadThroughput:210000,uploadThroughput:90000
  });
  const inject='('+function(){
    const settings={interface_language_code:"ru",translation_language_code:"ru",alan_script_code:"cyrillic",alan_dialect_code:"canonical",text_size_code:"medium",learning_setup_completed_at:"2026-10-21T00:00:00.000Z"};
    try{
      localStorage.setItem("alantil_scope_v1:guest:settings",JSON.stringify(settings));
      localStorage.setItem("alantil_scope_v1:guest:guide.state",'{"general_completed":true,"learning_completed":true}');
      localStorage.setItem("alantil_scope_v1:guest:route.story-intro-seen",JSON.stringify({oblivion:true,roots:true,ascent:true,understanding:true,pathways:true}));
    }catch{}
    window.__lab={lcp:[],errors:[],marks:[]};
    try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__lab.lcp.push({time:e.startTime,type:e.element?.tagName||"",size:e.size});}).observe({type:"largest-contentful-paint",buffered:true});}catch{}
    try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__lab.marks.push({time:e.startTime,name:e.name});}).observe({type:"mark",buffered:true});}catch{}
    addEventListener("error",e=>window.__lab.errors.push(e.message||"error"));
  }.toString()+')()';
  await command("Page.addScriptToEvaluateOnNewDocument",{source:inject});
  await command("Page.navigate",{url:"http://127.0.0.1:4173/path/oblivion"});
  async function status(){
    return await evaluate('(()=>{const b=[...document.querySelectorAll(".pathView button[data-station-key]")];const view=document.querySelector(".pathMapViewport");const imgs=[...document.querySelectorAll(".pathView img[data-beginner-diorama-image]")];const bounds=view?.getBoundingClientRect();const visible=imgs.filter(img=>{const r=img.getBoundingClientRect();return bounds&&r.top<bounds.bottom&&r.bottom>bounds.top;});return {buttons:b.length,illustrated:b.filter(x=>x.classList.contains("beginnerDioramaNode")).length,labels:b.filter(x=>x.querySelector(".stationLabel")?.textContent?.trim()).length,images:imgs.length,loaded:imgs.filter(x=>x.complete&&x.naturalWidth>0).length,visible:visible.length,visibleLoaded:visible.filter(x=>x.complete&&x.naturalWidth>0).length,positioning:view?.classList.contains("isPositioning")}})()');
  }
  let initial;
  const start=Date.now();
  let consecutive=0;
  while(Date.now()-start<85000){
    const v=await status();
    if(v.buttons===26 && v.images===26 && v.labels===26 && !v.positioning && v.visible>0 && v.visible===v.visibleLoaded){
      consecutive++;
      if(consecutive>=3){initial=v;break;}
    }else consecutive=0;
    await sleep(200);
  }
  assert.ok(initial,"Visible icons not ready "+JSON.stringify(await status()));
  const firstVisibleMs=await evaluate('performance.now()');
  await sleep(800);
  const preScroll=await status();
  const preRequests=[...requests.values()].filter(r=>r.url.includes("/assets/icons/sets/"));
  const preCompleted=preRequests.filter(x=>x.end!==undefined);
  const beforeScroll={time:firstVisibleMs,ui:initial,afterQuiet:preScroll,iconRequests:preRequests.length,completedRequests:preCompleted.length,bytes:preCompleted.reduce((sum,x)=>sum+(x.bytes||0),0)};
  assert.equal(preScroll.labels,26);
  const scrollStart=Date.now();
  for(let i=0;i<26;i++){
    await evaluate('(()=>{document.querySelectorAll(".pathView button[data-station-key]")['+i+'].scrollIntoView({block:"center",behavior:"instant"})})()');
    let okay=false;
    for(let attempt=0;attempt<100;attempt++){
      const value=await evaluate('(()=>{const b=document.querySelectorAll(".pathView button[data-station-key]")['+i+'];const img=b?.querySelector("img[data-beginner-diorama-image]");return !!(img?.complete&&img.naturalWidth>0)})()');
      if(value){okay=true;break;}
      await sleep(150);
    }
    assert.ok(okay,"Station image failed to load at index "+i);
  }
  const afterScroll=await status();
  assert.equal(afterScroll.loaded,26);
  assert.equal(afterScroll.labels,26);
  // Keep the cold-network profile only for the page-load measurement.
  // Station navigation downloads complete dictionary data; check it under an unthrottled connection.
  await command("Network.emulateNetworkConditions",{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await evaluate('document.querySelector(".beginnerDioramaNode")?.click()');
  let nav=false;
  for(let i=0;i<240;i++){
    if(await evaluate('!!document.querySelector(".stationView")')){nav=true;break;}
    await sleep(150);
  }
  assert.ok(nav,"Navigation to station failed");
  const performance=await evaluate('({lcp:window.__lab?.lcp||[],marks:window.__lab?.marks||[],errors:window.__lab?.errors||[],resources:performance.getEntriesByType("resource").filter(x=>x.name.includes("/assets/icons/sets/")).map(x=>({name:x.name.split("/").pop(),start:x.startTime,duration:x.duration,transferSize:x.transferSize}))})');
  const iconRequests=[...requests.values()].filter(r=>r.url.includes("/assets/icons/sets/"));
  const result={mode,run,firstVisibleMs,beforeScroll,afterScroll,scrollAllMs:Date.now()-scrollStart,navigation:nav,lcp:performance.lcp,marks:performance.marks,errors:performance.errors,resourceCount:performance.resources.length,network:{requests:iconRequests.length,encodedBytes:iconRequests.reduce((s,x)=>s+(x.bytes||0),0),fromSW:iconRequests.filter(x=>x.fromSW).length},resources:performance.resources};
  await writeFile(join(output,mode+"-"+String(run).padStart(2,"0")+".json"),JSON.stringify(result,null,2));
  console.log("VISIBLE-FIRST VERIFIED",JSON.stringify({mode,run,firstVisibleMs,iconRequests:beforeScroll.iconRequests,preScrollBytes:beforeScroll.bytes,totalRequests:iconRequests.length,totalBytes:result.network.encodedBytes,loaded:afterScroll.loaded,navigation:nav,errors:performance.errors}));
  assert.equal(performance.errors.length,0,"Unhandled browser errors");
}finally{
  try{ws?.close();}catch{}
  chrome.kill("SIGTERM");
  await sleep(200);
  if(chrome.exitCode===null)chrome.kill("SIGKILL");
  await rm(profile,{recursive:true,force:true,maxRetries:3});
}
