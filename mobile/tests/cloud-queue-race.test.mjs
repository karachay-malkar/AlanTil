import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as policy from '../../packages/alantil-core/sync-policy.js';
import {createDurableQueue} from '../../packages/alantil-core/durable-queue.js';
const source=readFileSync(new URL('../platform/cloud-sync.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
const tick=()=>new Promise(r=>setImmediate(r));
function harness(){
 let user='A',release;const sent=[],db=new Map();let first=true;
 const c=vm.createContext({...policy,createDurableQueue,AsyncStorage:{getItem:async key=>db.get(key)||null,setItem:async(key,v)=>db.set(key,v)},migrateLegacyNativeValueToGuest:async()=>{},nativeScopedStorageKey:()=>user,getNativeAuthSession:()=>({user:{id:user}}),nativeAuthFetch:async(path,options,expected)=>{assert.equal(expected,user);sent.push(JSON.parse(options.body));if(first){first=false;return new Promise(r=>release=r);}return {ok:true};}});
 vm.runInContext(source,c);
 return {db,sent,change:next=>user=next,run:code=>vm.runInContext(code,c),release:()=>release({ok:true})};
}
test('new favorite survives in-flight acknowledgement and is then sent',async()=>{
 const h=harness();await h.run("queueNativeFavoriteChange('word','old',true)");await tick();
 await h.run("queueNativeFavoriteChange('word','new',true)");h.release();await h.run('flushNativeCloudQueue()');
 assert.deepEqual(h.sent.map(x=>x.word_id),['old','new']);assert.deepEqual(JSON.parse(h.db.get('A')),[]);
});
test('new revision of same favorite survives earlier response',async()=>{
 const h=harness();await h.run("queueNativeFavoriteChange('word','one',true)");await tick();
 await h.run("queueNativeFavoriteChange('word','one',false)");h.release();await h.run('flushNativeCloudQueue()');
 assert.deepEqual(h.sent.map(x=>x.is_active),[true,false]);
});
test('concurrent enqueues retain both entries',async()=>{
 const h=harness();await Promise.all([h.run("queueNativeFavoriteChange('word','a',true)"),h.run("queueNativeFavoriteChange('word','b',true)")]);await tick();h.release();await h.run('flushNativeCloudQueue()');assert.equal(h.sent.length,2);
});
test('account switch preserves old pending entries and does not write new account queue',async()=>{
 const h=harness();await h.run("queueNativeFavoriteChange('word','old',true)");await tick();await h.run("queueNativeFavoriteChange('word','pending',true)");
 const old=h.run('flushNativeCloudQueue()');h.change('B');h.release();assert.equal(await old,false);
 assert.equal(JSON.parse(h.db.get('A'))[0].payload.word_id,'pending');assert.equal(h.db.has('B'),false);assert.equal(h.sent.length,1);
});
test('failed disk write does not poison future mutations',async()=>{
 let fail=true,rows=[];const q=createDurableQueue({read:async()=>rows,write:async(k,v)=>{if(fail)throw Error('disk');rows=v;}});
 await assert.rejects(q.mutate('A',()=>[1]));fail=false;await q.mutate('A',()=>[2]);assert.deepEqual(rows,[2]);
});
