import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../platform/session-store.js',import.meta.url),'utf8');
async function harness(){
 let scope='guest',unblock;const barrier=new Promise(r=>unblock=r),data=new Map(),events=[];
 const AsyncStorage={getItem:async key=>data.get(key)||null,setItem:async(key,value)=>{events.push('write');data.set(key,value);},removeItem:async key=>{events.push('remove');data.delete(key);}};
 const body=source.replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const api=new Function('AsyncStorage','migrateLegacyNativeValueToGuest','nativeScopedStorageKey',body+';return {saveNativeSessionSnapshot,loadNativeSessionSnapshot,clearNativeSessionSnapshot,setNativeSessionNamespace};')(AsyncStorage,()=>barrier,base=>scope+':'+base);
 return {api,data,events,unblock,scope:value=>{scope=value;}};
}
test('a pending guest save cannot migrate into the next signed-in user',async()=>{
 const h=await harness();const write=h.api.saveNativeSessionSnapshot('test',{index:3});h.scope('user-b');h.unblock();await write;
 assert.equal(h.data.size,1);assert.ok([...h.data.keys()][0].startsWith('guest:'));
});
test('completion clear runs after pending saves and cannot resurrect a session',async()=>{
 const h=await harness();const one=h.api.saveNativeSessionSnapshot('test',{index:1}),two=h.api.saveNativeSessionSnapshot('test',{index:2}),clear=h.api.clearNativeSessionSnapshot('test');h.unblock();await Promise.all([one,two,clear]);assert.equal(h.data.size,0);assert.deepEqual(h.events,['write','write','remove']);
});
test('snapshot captures state and namespace at invocation; restore waits for its save',async()=>{
 const h=await harness();h.api.setNativeSessionNamespace('test','favorites');const snapshot={index:2};const write=h.api.saveNativeSessionSnapshot('test',snapshot),read=h.api.loadNativeSessionSnapshot('test');snapshot.index=9;h.api.setNativeSessionNamespace('test','general');h.unblock();await write;assert.deepEqual(await read,{index:2});assert.ok([...h.data.keys()][0].endsWith(':favorites'));
});
