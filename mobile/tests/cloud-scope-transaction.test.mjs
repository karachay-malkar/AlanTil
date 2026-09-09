import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as favorites from '../../packages/alantil-core/favorites.js';
import * as settings from '../../packages/alantil-core/settings.js';
import * as progress from '../../packages/alantil-core/word-progress.js';
import * as scopes from '../../packages/alantil-core/storage-scope.js';
import * as analytics from '../../packages/alantil-core/analytics.js';
import * as policy from '../../packages/alantil-core/sync-policy.js';
import {createDurableQueue} from '../../packages/alantil-core/durable-queue.js';
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function module(name,env){const source=readFileSync(new URL(`../platform/${name}.js`,import.meta.url),'utf8').replace(/^import [\s\S]*?;\n/gm,'').replace(/export /g,'');const c=vm.createContext(env);vm.runInContext(source,c);return c;}
function harness(){
 let user='A',pause=null;const db=new Map(),writes=[];
 const key=(base,scope=`user:${user}`)=>scopes.scopedStorageKey(base,scope);
 const env={...analytics,trackNativeEvent:async()=>{},...favorites,...settings,...progress,...scopes,...policy,createDurableQueue,
 getNativeStorageScope:()=>`user:${user}`,nativeScopedStorageKey:key,getNativeAuthSession:()=>({user:{id:user}}),
 migrateLegacyNativeValueToGuest:async()=>{if(pause){const p=pause;pause=null;p.entered.resolve();await p.release.promise;}},
 AsyncStorage:{getItem:async k=>db.get(k)??null,setItem:async(k,v)=>{writes.push(k);db.set(k,v);}},
 nativeAuthFetch:async(path,options,expected)=>{assert.equal(expected,user);return {ok:true,text:async()=>JSON.stringify(path.includes('user_word_favorites')?[{word_id:'remote',is_active:true}]:[])};}
 };
 const storage=module('storage',env),prog=module('progress',env);
 const cloud=module('cloud-sync',{...env,...Object.fromEntries(Object.keys(storage).filter(k=>typeof storage[k]==='function').map(k=>[k,storage[k]])),loadNativeWordProgressState:prog.loadNativeWordProgressState,saveNativeWordProgressState:prog.saveNativeWordProgressState});
 return {db,writes,key,storage,prog,cloud,switch:()=>user='B',pause:()=>{pause={entered:deferred(),release:deferred()};return pause;}};
}
test('settings write keeps initial scope while migration awaits',async()=>{
 const h=harness(),p=h.pause(),run=h.storage.saveNativeSettings({text_size:'L'},{sync:false});await p.entered.promise;h.switch();p.release.resolve();await run;
 assert.ok(h.writes.length);assert.ok(h.writes.every(k=>k.includes(':user:A:')));
});
test('favorite values and sync metadata stay with initiating user',async()=>{
 const h=harness(),p=h.pause(),run=h.storage.saveNativeFavorites(['local']);await p.entered.promise;h.switch();p.release.resolve();await run;
 assert.ok(h.writes.length>=2);assert.ok(h.writes.every(k=>k.includes(':user:A:')));
});
test('guest claim cannot write into account selected during migration',async()=>{
 const h=harness();h.db.set(h.key('alantil:16.1:favorites','guest'),JSON.stringify(['guest-word']));
 const p=h.pause(),run=h.cloud.claimNativeGuestStateToAccount();await p.entered.promise;h.switch();p.release.resolve();assert.equal(await run,false);
 assert.ok(h.writes.length);assert.ok(h.writes.every(k=>k.includes(':user:A:')));assert.deepEqual(JSON.parse(h.db.get(h.key('alantil:16.1:favorites','user:A'))),['guest-word']);
});
test('cloud merge keeps initial account after responses but before local read completes',async()=>{
 const h=harness(),p=h.pause(),run=h.cloud.pullNativeCloudState();await p.entered.promise;h.switch();p.release.resolve();assert.equal(await run,false);
 assert.ok(h.writes.length);assert.ok(h.writes.every(k=>k.includes(':user:A:')));assert.deepEqual(JSON.parse(h.db.get(h.key('alantil:16.1:favorites','user:A'))),['remote']);
});

for(const mode of ['Learn','Test','Match'])test(`${mode} result and activity keep initiating account`,async()=>{
 const h=harness(),p=h.pause(),run=h.prog[`recordNative${mode}Session`]({sessionId:'scope-session',words:[{word_id:'one',final_result:'known'}],answers:[{word_id:'one',result:'correct'}],accuracy:100,type:'station_test',stationKey:'station'});
 await p.entered.promise;h.switch();p.release.resolve();await run;
 assert.ok(h.writes.length>=2);assert.ok(h.writes.every(k=>k.includes(':user:A:')));
 assert.ok(JSON.parse(h.db.get(h.key('alantil:16.1:word-progress','user:A'))).processed_session_ids.includes('scope-session'));
});
