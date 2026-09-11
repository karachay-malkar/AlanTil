import test from 'node:test';
import assert from 'node:assert/strict';
import {persistBeforeSessionExit} from '../../packages/alantil-core/session-exit.js';
import {getDisplayedSessionExitPhrase} from '../../packages/alantil-core/alan-display.js';
test('exit waits for the final snapshot write before navigation',async()=>{
 const calls=[];let finish;
 const pending=persistBeforeSessionExit(()=>new Promise(resolve=>{calls.push('saving');finish=resolve;}),()=>calls.push('left'));
 assert.deepEqual(calls,['saving']);finish();await pending;assert.deepEqual(calls,['saving','left']);
});
test('failed save leaves the session open for retry',async()=>{
 let left=false;await assert.rejects(persistBeforeSessionExit(async()=>{throw Error('disk full');},()=>{left=true;}));assert.equal(left,false);
});
test('exit phrase follows the same Cyrillic/Turkic setting as Web',()=>{
 assert.equal(getDisplayedSessionExitPhrase({alan_script_code:'cyrillic'}),'Не болса да болсун!');
 assert.equal(getDisplayedSessionExitPhrase({alan_script_code:'turkic'}),'Ne bolsa da bolsun!');
});
