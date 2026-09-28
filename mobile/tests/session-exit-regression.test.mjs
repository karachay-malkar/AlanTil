import test from 'node:test';
import assert from 'node:assert/strict';
import {completeBeforeSessionExit,persistBeforeSessionExit} from '../../packages/alantil-core/session-exit.js';
import {getDisplayedSessionExitPhrase} from '../../packages/alantil-core/alan-display.js';

test('exit waits for the configured before-leave action before navigation',async()=>{
 const calls=[];let finish;
 const pending=completeBeforeSessionExit(()=>new Promise(resolve=>{calls.push('discarding');finish=resolve;}),()=>calls.push('left'));
 assert.deepEqual(calls,['discarding']);finish();await pending;assert.deepEqual(calls,['discarding','left']);
});

test('failed before-leave action keeps the session open for retry',async()=>{
 let left=false;
 await assert.rejects(completeBeforeSessionExit(async()=>{throw Error('storage failure');},()=>{left=true;}));
 assert.equal(left,false);
});

test('legacy helper remains compatible with older cached bundles',async()=>{
 const calls=[];
 await persistBeforeSessionExit(async()=>calls.push('before'),()=>calls.push('left'));
 assert.deepEqual(calls,['before','left']);
});

test('exit phrase follows the same Cyrillic/Turkic setting as Web',()=>{
 assert.equal(getDisplayedSessionExitPhrase({alan_script_code:'cyrillic'}),'Не болса да болсун!');
 assert.equal(getDisplayedSessionExitPhrase({alan_script_code:'turkic'}),'Ne bolsa da bolsun!');
});
