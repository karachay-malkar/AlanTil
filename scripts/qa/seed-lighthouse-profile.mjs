import {spawn} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const profile=resolve(process.argv[2]||'');
if(!process.argv[2]||profile==='/')throw new Error('Isolated Chrome profile directory required');
await mkdir(profile,{recursive:true});
const chrome=spawn(process.env.CHROME_PATH||'google-chrome',[
  '--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run',
  '--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,
  'http://127.0.0.1:4173/'
],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket=null;
try{
  let port=0;
  for(let i=0;i<120;i++){
    if(chrome.exitCode!==null)throw new Error('Chrome exited before seeding');
    try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}
    await sleep(100);
  }
  if(!port)throw new Error('Chrome did not open its DevTools port');
  let target=null;
  for(let i=0;i<100;i++){
    try{
      const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target=tabs.find(tab=>tab.type==='page'&&tab.url.startsWith('http://127.0.0.1:4173/'));
      if(target?.webSocketDebuggerUrl)break;
    }catch{}
    await sleep(100);
  }
  if(!target?.webSocketDebuggerUrl)throw new Error('No AlanTil tab found');
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    socket.addEventListener('open',resolve,{once:true});
    socket.addEventListener('error',()=>reject(new Error('CDP connection failed')),{once:true});
  });
  const settings={interface_language_code:'ru',translation_language_code:'ru',alan_script_code:'cyrillic',alan_dialect_code:'canonical',text_size_code:'medium',learning_setup_completed_at:'2026-10-21T00:00:00.000Z'};
  const expression=`(() => {
    localStorage.setItem('alantil_scope_v1:guest:settings', ${JSON.stringify(JSON.stringify(settings))});
    localStorage.setItem('alantil_scope_v1:guest:guide.state','{"general_completed":true,"learning_completed":true}');
    // A returning visitor has already dismissed story introductions.
    localStorage.setItem('alantil_scope_v1:guest:route.story-intro-seen',JSON.stringify({oblivion:true,understanding:true,roots:true,ascent:true,pathways:true}));
    return localStorage.getItem('alantil_scope_v1:guest:settings');
  })()`;
  const requestId=42;
  const result=new Promise((resolve,reject)=>{
    socket.addEventListener('message',event=>{
      let reply;try{reply=JSON.parse(event.data);}catch{return;}
      if(reply.id!==requestId)return;
      if(reply.error||reply.result?.exceptionDetails)reject(new Error(JSON.stringify(reply.error||reply.result.exceptionDetails)));
      else resolve(reply.result?.result?.value);
    });
  });
  socket.send(JSON.stringify({id:requestId,method:'Runtime.evaluate',params:{expression,returnByValue:true}}));
  const value=await Promise.race([result,new Promise((_,reject)=>setTimeout(()=>reject(new Error('CDP seeding timeout')),6000))]);
  if(!String(value||'').includes('learning_setup_completed_at'))throw new Error('Storage fixture did not persist');
  console.log('Prepared isolated completed-setup profile');
}finally{
  try{socket?.close();}catch{}
  chrome.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),sleep(2500)]);
  if(chrome.exitCode===null)chrome.kill('SIGKILL');
}
