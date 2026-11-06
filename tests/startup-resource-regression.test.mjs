import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');

for(const operation of ['cacheFirst','networkFirst','navigationResponse']){
 test(operation+' returns the successful response when cache writing fails',async()=>{
  let attempted=0;
  const tasks=[];
  const cache={match:async()=>null,put:async()=>{attempted++;throw Error('QuotaExceededError');}};
  const context=vm.createContext({self:{location:{origin:"https://alantil.ru"},addEventListener(){}},URL,Response,caches:{open:async()=>cache},fetch:async()=>new Response('fresh'),keepAlive:task=>tasks.push(task)});
  vm.runInContext(source,context);
  const args=operation==='navigationResponse'?'keepAlive':operation==='cacheFirst'?'undefined,keepAlive':'undefined,{},keepAlive';
  const response=await vm.runInContext(operation+'("/asset",'+args+')',context);
  await Promise.all(tasks);
  assert.equal(attempted,1);
  assert.equal(response.status,200);
  assert.equal(await response.text(),'fresh');
 });
}

const pathSource=await readFile(new URL('../src/features/path/feature.js',import.meta.url),'utf8');
test('a failed compressed index falls back to plain JSON before the dictionary',async()=>{
 const calls=[];
 const context=vm.createContext({
  DecompressionStream,PATH_ROUTE_INDEX_URL:'compressed',PATH_ROUTE_INDEX_FALLBACK_URL:'plain',
  fetch:async url=>{calls.push(url);return url==='compressed'?new Response('',{status:503}):new Response(JSON.stringify({version:'1',word_count:1,words:[{id:1}]}));},
  getRepositoryDiagnostics:()=>({}),getPersistedDictionaryVersion:()=>null,
  getDisplayedWordCollection:words=>words,getCompleteDictionaryWords:()=>{throw Error('full dictionary requested');}
 });
 const start=pathSource.indexOf('let pathIndexCache');
 const end=pathSource.indexOf('let studyDependencies',start);
 vm.runInContext(pathSource.slice(start,end),context);
 assert.equal((await vm.runInContext('getHomeRouteWords()',context))[0].id,1);
 assert.deepEqual(calls,['compressed','plain']);
});
