import test from 'node:test';
import assert from 'node:assert/strict';
import {createPathWindow,stationInWindow} from '../../packages/alantil-ui/path-window.js';

test('window bounds native station content on a long route and preserves guide targets',()=>{
 const store=createPathWindow('story-a');store.update(12000,800,'story-a');const w=store.getSnapshot();
 const mounted=Array.from({length:1000},(_,i)=>i*120).filter(y=>stationInWindow(y,w));
 assert.ok(mounted.length<30);assert.ok(stationInWindow(12000,w));assert.ok(!stationInWindow(0,w));assert.ok(stationInWindow(0,w,true));assert.ok(!stationInWindow(undefined,w));
});

test('small scrolls do not notify, jumps and resize do; unsubscribe cleans up',()=>{
 const store=createPathWindow('story-a');let calls=0;const off=store.subscribe(()=>calls++);
 store.update(0,800,'story-a');store.update(100,800,'story-a');assert.equal(calls,1);
 store.update(12000,800,'story-a');assert.equal(calls,2);store.update(12000,400,'story-a');assert.equal(calls,3);
 off();store.update(0,400,'story-a');assert.equal(calls,3);assert.equal(store.getSnapshot().offset,0);
});

test('unready and reset windows keep stations mounted until current story geometry is measured',()=>{
 const store=createPathWindow('story-a');
 assert.equal(store.getSnapshot().ready,false);
 assert.equal(stationInWindow(undefined,store.getSnapshot()),true);
 assert.equal(stationInWindow(0,store.getSnapshot()),true);
 store.update(12000,800,'story-a');
 assert.equal(store.getSnapshot().ready,true);
 assert.equal(stationInWindow(undefined,store.getSnapshot()),false);
 assert.equal(stationInWindow(12000,store.getSnapshot()),true);
 store.reset('story-b');
 assert.equal(store.getSnapshot().ready,false);
 assert.equal(store.getSnapshot().scope,'story-b');
 assert.equal(stationInWindow(0,store.getSnapshot()),true);
});

test('stale story updates cannot initialize a reset path window',()=>{
 const store=createPathWindow('story-a');store.update(9000,700,'story-a');const revision=store.getSnapshot().revision;
 store.reset('story-b');
 const resetRevision=store.getSnapshot().revision;assert.equal(resetRevision,revision+1);
 store.update(9000,700,'story-a');assert.equal(store.getSnapshot().ready,false);assert.equal(store.getSnapshot().scope,'story-b');
 store.update(300,700,'story-b');assert.equal(store.getSnapshot().ready,true);assert.equal(store.getSnapshot().offset,300);
});
