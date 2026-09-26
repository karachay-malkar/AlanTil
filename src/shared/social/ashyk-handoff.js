let pending=null;
const INTENT_KEY='alantil_ashyk_online_intent_v1';
const ROUTE_KEY='alantil_spa_path';

function safeSessionGet(key){try{return sessionStorage.getItem(key);}catch{return null;}}
function safeSessionSet(key,value){try{sessionStorage.setItem(key,value);return true;}catch{return false;}}
function safeSessionRemove(key){try{sessionStorage.removeItem(key);}catch{}}

export function setPendingAshykInvite(value){pending=value&&value.room?{room:value.room,invite:value.invite||null}:null;}
export function takePendingAshykInvite(){const value=pending;pending=null;return value;}
export function peekPendingAshykInvite(){return pending;}

export function setPendingAshykIntent(intent){
  if(!intent?.kind){safeSessionRemove(INTENT_KEY);return false;}
  return safeSessionSet(INTENT_KEY,JSON.stringify(intent));
}
export function takePendingAshykIntent(){
  const raw=safeSessionGet(INTENT_KEY);
  safeSessionRemove(INTENT_KEY);
  if(!raw)return null;
  try{const value=JSON.parse(raw);return value&&typeof value.kind==='string'?value:null;}catch{return null;}
}
export function peekPendingAshykIntent(){
  const raw=safeSessionGet(INTENT_KEY);
  if(!raw)return null;
  try{const value=JSON.parse(raw);return value&&typeof value.kind==='string'?value:null;}catch{return null;}
}

function metaBuildFromHtml(html){
  const match=String(html||'').match(/<meta\s+name=["']alantil-build["']\s+content=["']([^"']+)["']/i)
    ||String(html||'').match(/<meta\s+content=["']([^"']+)["']\s+name=["']alantil-build["']/i);
  return String(match?.[1]||'');
}
function currentBuild(){return String(document.querySelector('meta[name="alantil-build"]')?.content||'');}

let buildCheck=null,latestBuild='';
export function primeAshykBuildCheck(){
  if(buildCheck||typeof window==='undefined'||typeof document==='undefined'||typeof fetch!=='function')return buildCheck;
  buildCheck=(async()=>{try{
    const response=await fetch(`/index.html?__alantil_build_check=${Date.now()}`,{cache:'no-store',headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(4000)});
    if(response.ok)latestBuild=metaBuildFromHtml(await response.text());
  }catch{} })();
  return buildCheck;
}
export async function ensureCurrentAshykBuild(intent=null){
  // The freshness request is background work, never part of the click latency.
  void primeAshykBuildCheck();
  if(typeof document==='undefined')return true;
  const current=currentBuild();
  if(!latestBuild||!current||latestBuild===current)return true;
  if(intent)setPendingAshykIntent(intent);
  safeSessionSet(ROUTE_KEY,'/practice/ashyk');
  window.location.reload();
  return false;
}
