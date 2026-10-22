import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {appendFile,readFile,rm,mkdtemp,mkdir,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";

const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const output=resolve(process.argv[2]||"diagnostic-results");
await mkdir(output,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),"alantil-sw-evidence-"));
const chrome=spawn(process.env.CHROME_PATH||"google-chrome",[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage","--no-first-run",
  "--remote-debugging-port=0","--user-data-dir="+profile,"about:blank"
],{stdio:"ignore"});
let socket;
const pending=new Map();
let seq=0;
const responses=[];
try{
  let port=0;
  for(let i=0;i<130;i++){
    try{port=Number((await readFile(join(profile,"DevToolsActivePort"),"utf8")).split("\n")[0]);if(port)break;}catch{}
    if(chrome.exitCode!==null)throw Error("Chrome stopped before debugging");
    await sleep(100);
  }
  assert.ok(port,"No Chrome debugging port");
  const targets=await(await fetch("http://127.0.0.1:"+port+"/json/list")).json();
  socket=new WebSocket(targets.find(x=>x.type==="page").webSocketDebuggerUrl);
  await new Promise((ok,bad)=>{socket.addEventListener("open",ok,{once:true});socket.addEventListener("error",bad,{once:true});});
  socket.addEventListener("message",ev=>{
    const data=JSON.parse(ev.data);
    if(data.id){
      const value=pending.get(data.id);
      if(value){pending.delete(data.id);clearTimeout(value.timer);data.error?value.reject(Error(JSON.stringify(data.error))):value.resolve(data.result||{});}
    }else if(data.method==="Network.responseReceived"){
      const p=data.params;
      if(p.response.url.includes("/src/features/path/feature.js?")){
        responses.push({url:p.response.url,status:p.response.status,fromServiceWorker:p.response.fromServiceWorker,fromDiskCache:p.response.fromDiskCache});
      }
    }
  });
  function send(method,params={},timeout=20000){
    return new Promise((resolve,reject)=>{
      const id=++seq;
      const timer=setTimeout(()=>{pending.delete(id);reject(Error("CDP timed out "+method));},timeout);
      pending.set(id,{timer,resolve,reject});
      socket.send(JSON.stringify({id,method,params}));
    });
  }
  async function evalJs(expr){
    const res=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});
    if(res.exceptionDetails)throw Error(JSON.stringify(res.exceptionDetails));
    return res.result?.value;
  }
  await send("Page.enable");
  await send("Network.enable");
  await send("Page.addScriptToEvaluateOnNewDocument",{source:'(() => { try {const s={interface_language_code:"ru",translation_language_code:"ru",alan_script_code:"cyrillic",alan_dialect_code:"canonical",text_size_code:"medium",learning_setup_completed_at:"2026-10-21T00:00:00.000Z"};localStorage.setItem("alantil_scope_v1:guest:settings",JSON.stringify(s));localStorage.setItem("alantil_scope_v1:guest:guide.state",JSON.stringify({general_completed:true,learning_completed:true}));}catch(e){} })()'});
  await send("Page.navigate",{url:"http://127.0.0.1:4173/path/oblivion"});
  const check='(async()=>{const reg=await Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),900))]);const cache=await caches.open("alantil-shell-17.2.1");const cached=await cache.match("/src/features/path/feature.js?v=17.2.1");return {ready:!!reg,controlled:!!navigator.serviceWorker.controller,cacheExists:!!cached,cachedText:cached?await cached.text():"",keys:await caches.keys()}})()';
  let before=null;
  for(let n=0;n<27;n++){
    try{
      const now=await evalJs(check);
      if(now?.cacheExists && now?.controlled){before=now;break;}
    }catch(e){}
    await sleep(300);
  }
  assert.ok(before?.cacheExists,"Service worker did not populate versioned feature code");
  assert.ok(before.controlled,"Page not controlled by worker");
  const original=before.cachedText;
  const marker="// AlanTil QA probe: unbumped feature update "+Date.now();
  const file=resolve("src/features/path/feature.js");
  try{
    await appendFile(file,"\n"+marker+"\n","utf8");
    const probe=await evalJs('(async()=>{ const r=await fetch("/src/features/path/feature.js?v=17.2.1",{cache:"reload"}); const cached=await caches.match("/src/features/path/feature.js?v=17.2.1");return {networkText:await r.text(),cachedText:cached?await cached.text():""};})()');
    assert.ok(probe.networkText.includes(marker),"Network did not serve modified feature");
    assert.ok(!probe.cachedText.includes(marker),"Existing cache unexpectedly invalidated itself");
    assert.equal(probe.cachedText,original,"Stale cache has changed without version bump");
    await send("Page.reload",{ignoreCache:true});
    await sleep(2600);
    const reloaded=await evalJs('({controlled:!!navigator.serviceWorker.controller,featureElement:!!document.querySelector(".pathView")})');
    const evidence={sameVersion:true,version:"17.2.1",networkHasNewBytes:probe.networkText.includes(marker),cacheHasNewBytes:probe.cachedText.includes(marker),cachedBytes:probe.cachedText.length,networkBytes:probe.networkText.length,cacheNames:before.keys,reloaded,featureRequests:responses};
    await writeFile(join(output,"same-version-service-worker-staleness.json"),JSON.stringify(evidence,null,2));
    console.log("SAME VERSION SERVICE WORKER:",JSON.stringify(evidence));
    if(!responses.some(x=>x.fromServiceWorker===true))console.warn("New document was not controlled during reload. Stale CacheStorage bytes are confirmed, but stale executed JavaScript is not proven by this trial.");
  }finally{
    await writeFile(file,original);
  }
}finally{
  try{socket?.close();}catch{}
  chrome.kill("SIGTERM");
  await sleep(300);
  if(chrome.exitCode===null)chrome.kill("SIGKILL");
  await rm(profile,{recursive:true,force:true,maxRetries:3});
}
