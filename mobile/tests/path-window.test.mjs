import test from 'node:test';
import assert from 'node:assert/strict';
import {createPathWindow,stationInWindow} from '../../packages/alantil-ui/path-window.js';
test('window bounds native station content on a long route and preserves guide targets',()=>{
 const store=createPathWindow();store.update(12000,800);const w=store.getSnapshot();
 const mounted=Array.from({length:1000},(_,i)=>i*120).filter(y=>stationInWindow(y,w));
 assert.ok(mounted.length<30);assert.ok(stationInWindow(12000,w));assert.ok(!stationInWindow(0,w));assert.ok(stationInWindow(0,w,true));assert.ok(!stationInWindow(undefined,w));
});
test('small scrolls do not notify, jumps and resize do; unsubscribe cleans up',()=>{
 const store=createPathWindow();let calls=0;const off=store.subscribe(()=>calls++);
 store.update(0,800);store.update(100,800);assert.equal(calls,1);
 store.update(12000,800);assert.equal(calls,2);store.update(12000,400);assert.equal(calls,3);
 off();store.update(0,400);assert.equal(calls,3);assert.equal(store.getSnapshot().offset,0);
});

test('initial geometry pass mounts no station content before measurement',()=>{
 const store=createPathWindow();
 assert.equal(stationInWindow(undefined,store.getSnapshot()),false);
 assert.equal(stationInWindow(0,store.getSnapshot()),false);
 store.update(12000,800);
 assert.equal(stationInWindow(undefined,store.getSnapshot()),false);
 assert.equal(stationInWindow(12000,store.getSnapshot()),true);
});
