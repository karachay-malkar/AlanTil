import test from 'node:test';
import assert from 'node:assert/strict';
import {toggleBatchSelection,retainBatchSelection} from '../src/features/tower/batch-delete-selection.mjs';
const blocks=[{id:'a'},{id:'b'},{id:'c'},{id:'d'}];
test('three sections can be selected; second tap removes just the tapped one',()=>{
 let selection=new Set();
 for(const id of ['a','b','c'])selection=toggleBatchSelection(selection,id,blocks);
 assert.deepEqual([...selection],['a','b','c']);
 const after=toggleBatchSelection(selection,'b',blocks);
 assert.deepEqual([...after],['a','c']);
 assert.deepEqual([...selection],['a','b','c'],'never mutate original selection');
 assert.deepEqual([...toggleBatchSelection(after,'b',blocks)],['a','c','b']);
});
test('unknown or empty IDs are ignored and stale IDs removed on snapshot refresh',()=>{
 const current=new Set(['a','b']);
 assert.deepEqual([...toggleBatchSelection(current,'missing',blocks)],['a','b']);
 assert.deepEqual([...toggleBatchSelection(current,null,blocks)],['a','b']);
 assert.deepEqual([...retainBatchSelection(new Set(['a','b','c']),[{id:'a'},{id:'c'}])],['a','c']);
 assert.deepEqual([...current],['a','b']);
});
