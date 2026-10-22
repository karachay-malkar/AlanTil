import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtemp,readFile,rm,mkdir,writeFile,appendFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const origin="http://127.0.0.1:4173";
const output=resolve(process.argv[2]||"diagnostic-results");
const engine=process.env.CHROME_PATH||"google-chrome";
await mkdir(output,{recursive:true});
const modes=["fixture-fast","fixture-late","metadata-preseed","stable-layout"];
const orders=[
  ["fixture-fast","fixture-late","metadata-preseed","stable-layout"],
  ["stable-layout","fixture-fast","fixture-late","metadata-preseed"],
  ["metadata-preseed","stable-layout","fixture-fast","fixture-late"]
];

async function browserRun(mode,fixture=null,runNo=0) {
  const dir=await mkdtemp(join(tmpdir(),"alantil-diagnostic-"));
  const chrome=spawn(engine,[
    "--headless=new","--no-sandbox","--disable-dev-shm-usage",
    "--no-first-run","--no-default-browser-check","--remote-debugging-port=0",
    "--disable-background-timer-throttling","--disable-renderer-backgrounding",
    "--user-data-dir="+dir,"about:blank"
  ],{stdio:"ignore"});
  let ws;
  const callbacks=new Map(),requests=new Map(),requestEvents=[];
  let id=0;
  try {
    let port=0;
    for(let j=0;j<150;j++){
      try{port=Number((await readFile(join(dir,"DevToolsActivePort"),"utf8")).split("\n")[0]);if(port)break;}catch{}
      if(chrome.exitCode!==null)throw Error("Chrome stopped: "+chrome.exitCode);
      await sleep(100);
    }
    assert.ok(port,"DevTools port absent");
    const targets=await (await fetch("http://127.0.0.1:"+port+"/json/list")).json();
    const page=targets.find(t=>t.type==="page"&&t.webSocketDebuggerUrl);
    assert.ok(page,"DevTools page absent");
    ws=new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((ok,bad)=>{ws.addEventListener("open",ok,{once:true});ws.addEventListener("error",bad,{once:true});});
    ws.addEventListener("message",ev=>{
      const m=JSON.parse(ev.data);
      if(m.id){
        const c=callbacks.get(m.id);
        if(!c)return;
        callbacks.delete(m.id);clearTimeout(c.timer);
        m.error?c.reject(Error(JSON.stringify(m.error))):c.resolve(m.result||{});
      }else if(m.method==="Network.requestWillBeSent"){
        requests.set(m.params.requestId,{url:m.params.request.url,start:m.params.timestamp,initiator:m.params.initiator?.type});
      }else if(m.method==="Network.responseReceived"){
        const q=requests.get(m.params.requestId);
        if(q){q.status=m.params.response.status;q.fromServiceWorker=m.params.response.fromServiceWorker;q.fromDiskCache=m.params.response.fromDiskCache;}
      }else if(m.method==="Network.loadingFinished"){
        const q=requests.get(m.params.requestId);if(q){q.end=m.params.timestamp;q.bytes=m.params.encodedDataLength;requestEvents.push(q);}
      }
    });
    function call(method,params={},timeout=20000){
      return new Promise((resolve,reject)=>{
        const key=++id;
        const timer=setTimeout(()=>{callbacks.delete(key);reject(Error("CDP timeout: "+method));},timeout);
        callbacks.set(key,{resolve,reject,timer});
        ws.send(JSON.stringify({id:key,method,params}));
      });
    }
    async function evaluate(expression){
      const v=await call("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true},18000);
      if(v.exceptionDetails)throw Error("JS exception: "+JSON.stringify(v.exceptionDetails));
      return v.result?.value;
    }
    await call("Page.enable");
    await call("Network.enable");
    await call("Runtime.enable");
    await call("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await call("Emulation.setCPUThrottlingRate",{rate:4});
    await call("Network.setBypassServiceWorker",{bypass:true});
    await call("Network.setCacheDisabled",{cacheDisabled:true});
    const data=fixture||{beginner:[],intermediate:[]};
    const delay=mode==="fixture-late"||mode==="stable-layout"?2500:0;
    const script='('+function(init){
      try{
        const settings={interface_language_code:"ru",translation_language_code:"ru",alan_script_code:"cyrillic",alan_dialect_code:"canonical",text_size_code:"medium",learning_setup_completed_at:"2026-10-21T00:00:00.000Z"};
        localStorage.setItem("alantil_scope_v1:guest:settings",JSON.stringify(settings));
        localStorage.setItem("alantil_scope_v1:guest:guide.state",'{"general_completed":true,"learning_completed":true}');
        localStorage.setItem("alantil_scope_v1:guest:route.story-intro-seen",JSON.stringify({oblivion:true,understanding:true,roots:true,ascent:true,pathways:true}));
        if(init.mode==="metadata-preseed"){
          localStorage.setItem("alantil_beginner_set_metadata_v2",JSON.stringify(init.data.beginner));
          localStorage.setItem("alantil_intermediate_set_metadata_v2",JSON.stringify(init.data.intermediate));
        }
      }catch(error){}
      const diag=window.__pathDiagnostic={mode:init.mode,events:[],lcp:[],shifts:[],longtasks:[],errors:[]};
      const log=(kind,details={})=>diag.events.push({kind,t:performance.now(),...details});
      function observe(type,cb){
        try{new PerformanceObserver(list=>list.getEntries().forEach(cb)).observe({type,buffered:true});}catch(e){}
      }
      observe("mark",e=>log("mark",{name:e.name,t:e.startTime}));
      observe("largest-contentful-paint",e=>diag.lcp.push({t:e.startTime,size:e.size,element:e.element?.closest?.("[data-station-key]")?.getAttribute("data-station-key")||e.element?.tagName||"",url:e.url||""}));
      observe("longtask",e=>diag.longtasks.push({t:e.startTime,duration:e.duration,attribution:e.attribution?.map(a=>a.name)||[]}));
      observe("layout-shift",e=>{if(!e.hadRecentInput)diag.shifts.push({t:e.startTime,value:e.value});});
      window.addEventListener("error",e=>diag.errors.push(String(e.message||"error")));
      window.addEventListener("unhandledrejection",e=>diag.errors.push(String(e.reason||"rejection")));
      document.addEventListener("load",e=>{if(e.target?.matches?.("img.beginnerDioramaImage"))log("image-loaded",{src:e.target.getAttribute("src"),name:e.target.closest("[data-station-key]")?.getAttribute("data-station-key")||""});},true);
      const originalFetch=window.fetch;
      window.fetch=async function(url,options){
        const address=String(url?.url||url);
        const meta=address.includes("/rest/v1/content_structure");
        const kind=address.includes("beginner-")?"beginner":"intermediate";
        if(meta)log("metadata-request",{which:kind});
        if(meta&&init.mode!=="remote-calibration"){
          if(init.delay>0)await new Promise(r=>setTimeout(r,init.delay));
          const rows=init.data[kind]||[];
          log("metadata-response",{which:kind,rows:rows.length});
          return new Response(JSON.stringify(rows),{status:200,headers:{"Content-Type":"application/json"}});
        }
        const response=await originalFetch.apply(this,arguments);
        if(meta)log("metadata-response",{which:kind,status:response.status});
        return response;
      };
      let last="";const monitor=()=>{
        const buttons=document.querySelectorAll(".pathView button[data-station-key]");
        const illustrated=document.querySelectorAll(".pathView .beginnerDioramaNode");
        const withImg=document.querySelectorAll(".pathView img[data-beginner-diorama-image]");
        const loaded=[...withImg].filter(img=>img.complete&&img.naturalWidth>0).length;
        const snapshot=[buttons.length,illustrated.length,withImg.length,loaded].join("/");
        if(snapshot!==last){last=snapshot;log("dom-state",{buttons:buttons.length,illustrated:illustrated.length,images:withImg.length,loaded,scrollTop:document.querySelector(".pathMapViewport")?.scrollTop||0});}
      };
      const startMonitoring=()=>{
        new MutationObserver(monitor).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","src"]});
        setInterval(monitor,150);
      };
      if(document.documentElement)startMonitoring();
      else document.addEventListener("readystatechange",()=>{if(document.documentElement&&!diag.monitorStarted){diag.monitorStarted=true;startMonitoring();}},{once:true});
      if(init.mode==="stable-layout"){
        const style=document.createElement("style");
        style.textContent=".pathView .stationNode[data-adaptive-station-meta]{width:168px!important;height:148px!important;min-height:148px!important;display:flex!important;flex-direction:column;align-items:center;justify-content:flex-start}";
        const insert=()=>document.head?document.head.append(style):setTimeout(insert,0);
        insert();
      }
      log("init");
    }.toString()+')('+JSON.stringify({mode,data,delay})+');';
    await call("Page.addScriptToEvaluateOnNewDocument",{source:script});
    await call("Page.navigate",{url:origin+"/path/oblivion"});
    let status,started=Date.now();
    while(Date.now()-started<45000){
      try{status=await evaluate('(()=>{const root=document.querySelector(".pathView");const nodes=[...document.querySelectorAll(".pathView button[data-station-key]")];const imgs=[...document.querySelectorAll(".pathView img[data-beginner-diorama-image]")];return {buttons:nodes.length,illustrated:nodes.filter(x=>x.classList.contains("beginnerDioramaNode")).length,loaded:imgs.filter(x=>x.complete&&x.naturalWidth>0).length,labels:nodes.filter(x=>x.querySelector(".stationLabel")?.textContent?.trim()).length,root:!!root}})()');}catch{}
      if(status?.buttons===26 && status?.loaded===26)break;
      await sleep(220);
    }
    assert.equal(status?.buttons,26,"Route map did not load: "+JSON.stringify(status));
    assert.equal(status?.loaded,26,"26 station images not loaded: "+JSON.stringify(status));
    assert.equal(status?.labels,26,"26 station labels not visible: "+JSON.stringify(status));
    await sleep(800);
    const events=await evaluate('(()=>{const d=window.__pathDiagnostic;return {events:d.events,lcp:d.lcp,shifts:d.shifts,longtasks:d.longtasks,errors:d.errors,marks:performance.getEntriesByType("mark").map(x=>({name:x.name,t:x.startTime})),resources:performance.getEntriesByType("resource").filter(x=>x.name.includes("/assets/icons/sets/")||x.name.includes("content_structure")||x.name.includes("path-route-index")).map(x=>({name:x.name.split("/").pop(),start:x.startTime,end:x.responseEnd,duration:x.duration,initiatorType:x.initiatorType})),metadata:{beginner:JSON.parse(localStorage.getItem("alantil_beginner_set_metadata_v2")||"[]"),intermediate:JSON.parse(localStorage.getItem("alantil_intermediate_set_metadata_v2")||"[]")},rendered:!!document.querySelector(".pathView"),viewport:{height:document.querySelector(".pathMapViewport")?.scrollHeight,scrollTop:document.querySelector(".pathMapViewport")?.scrollTop},swControlled:!!navigator.serviceWorker?.controller}})()');
    const screenshot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
    const target=join(output,"run-"+String(runNo).padStart(2,"0")+"-"+mode);
    await writeFile(target+".png",Buffer.from(screenshot.data,"base64"));
    const result={mode,runNo,status,lcp:events.lcp.at(-1)||null,events:events.events,longtasks:events.longtasks,shifts:events.shifts,errors:events.errors,marks:events.marks,resources:events.resources,requests:requestEvents.filter(r=>r.url.includes("content_structure")||r.url.includes("/assets/icons/sets/")),viewport:events.viewport,swControlled:events.swControlled};
    await writeFile(target+".json",JSON.stringify(result,null,2));
    if(!fixture){
      assert.equal(events.metadata.beginner.length,30,"First run did not obtain complete beginner metadata");
      assert.equal(events.metadata.intermediate.length,26,"First run did not obtain complete intermediate metadata");
    }
    return {result,fixture:events.metadata};
  }finally{
    try{ws?.close();}catch{}
    chrome.kill("SIGTERM");
    await sleep(200);
    if(chrome.exitCode===null)chrome.kill("SIGKILL");
    await rm(dir,{force:true,recursive:true,maxRetries:3});
  }
}
function firstTime(run,kind,filter=()=>true){return run.events.find(x=>x.kind===kind&&filter(x))?.t??null;}
function summary(run){
  const tImg=firstTime(run,"dom-state",x=>x.images===26);
  const tLoad=firstTime(run,"dom-state",x=>x.loaded===26);
  const tRendered=firstTime(run,"mark",x=>x.name==="alantil:path:rendered");
  const tIntermediate=firstTime(run,"metadata-response",x=>x.which==="intermediate");
  const longTaskTotal=run.longtasks.reduce((sum,x)=>sum+x.duration,0);
  return {mode:run.mode,run:run.runNo,rendered:tRendered,metadata:tIntermediate,imagesInserted:tImg,imagesLoaded:tLoad,lcp:run.lcp?.t||null,lcpStation:run.lcp?.element||"",longTaskTotal,shiftTotal:run.shifts.reduce((sum,x)=>sum+x.value,0),scrollHeight:run.viewport.height,swControlled:run.swControlled,errors:run.errors};
}
const all=[];
const initial=await browserRun("remote-calibration",null,0);
const fixture=initial.fixture;
await writeFile(join(output,"metadata-fixture.json"),JSON.stringify(fixture,null,2));
all.push(summary(initial.result));
console.log("Calibration:",JSON.stringify(all[0]));
let no=1;
for(const group of orders){
  for(const mode of group){
    const next=await browserRun(mode,fixture,no++);
    const line=summary(next.result);
    all.push(line);
    console.log("Trial:",JSON.stringify(line));
  }
}
await writeFile(join(output,"summary.json"),JSON.stringify(all,null,2));
const columns=["mode","run","rendered","metadata","imagesInserted","imagesLoaded","lcp","lcpStation","longTaskTotal","shiftTotal","scrollHeight","swControlled"];
const csv=[columns.join(","),...all.map(row=>columns.map(k=>JSON.stringify(row[k]??"")).join(","))].join("\n");
await writeFile(join(output,"summary.csv"),csv);
const sorted=Object.groupBy(all.slice(1),r=>r.mode);
console.log("=== GROUP MEDIANS ===");
for(const [mode,rows] of Object.entries(sorted)){
  const med=key=>rows.map(x=>x[key]).filter(Number.isFinite).sort((a,b)=>a-b)[1];
  console.log(JSON.stringify({mode,lcp:med("lcp"),metadata:med("metadata"),imagesInserted:med("imagesInserted"),imagesLoaded:med("imagesLoaded"),longTaskTotal:med("longTaskTotal"),lcpStations:rows.map(r=>r.lcpStation)}));
}
