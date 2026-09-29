import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  enqueueProgressEntry,
  normalizeProgressQueue,
  removeProgressQueueEntry,
  updateProgressQueueEntry,
  progressQueueRevisionToken,
} from '../packages/alantil-core/sync-policy.js';
import {
  DICTIONARY_CACHE_KEY,
  DICTIONARY_META_KEY,
  LEGACY_DICTIONARY_CACHE_KEYS,
  LEGACY_DICTIONARY_META_KEYS,
} from '../packages/alantil-core/dictionary-contract.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('guest state is captured before account scope activation',()=>{
  const source=read('src/shared/progress/progress-sync.js');
  const start=source.indexOf('async function activateScopeForUser');
  const end=source.indexOf('function bindSynchronizationEvents',start);
  const block=source.slice(start,end);
  assert.ok(block.indexOf('captureGuestClaimSnapshot(userId)')>=0);
  assert.ok(block.indexOf('captureGuestClaimSnapshot(userId)')<block.indexOf('setStorageScope(userId)'));
  assert.match(source,/claimGuestData\(userId, guestClaim\)/);
  assert.match(source,/removeGuestScopedValueAfterClaim/);
});

test('cloud-empty settings are queued only after guest claim has been applied',()=>{
  const source=read('src/shared/progress/progress-sync.js');
  const applyStart=source.indexOf('async function applyCloudState');
  const applyEnd=source.indexOf('async function applyQueueEntryLocally',applyStart);
  const applyBlock=source.slice(applyStart,applyEnd);
  assert.doesNotMatch(applyBlock,/enqueueProgress\("user_settings"/);
  const syncStart=source.indexOf('async function synchronizeActiveScope');
  const syncEnd=source.indexOf('async function activateScopeForUser',syncStart);
  const block=source.slice(syncStart,syncEnd);
  assert.ok(block.indexOf('await claimGuestData(userId, guestClaim)')<block.indexOf('enqueueProgress("user_settings"'));
  assert.match(block,/!cloudHasSettings/);
});

test('Mobile cloud sync pulls first, claims guest locally, then flushes and clears guest',()=>{
  const source=read('mobile/platform/cloud-sync.js');
  const start=source.indexOf('export async function synchronizeNativeAccount');
  const block=source.slice(start);
  const pull=block.indexOf('pullNativeCloudState({queueAfterPull:false})');
  const claim=block.indexOf('claimNativeGuestStateToAccount({queueAfterClaim:false})');
  const queue=block.indexOf('queueNativeWordProgressSnapshot(progress,context)');
  const flush=block.indexOf('flushNativeCloudQueue()');
  const cleanup=block.indexOf('finalizeNativeGuestClaim(context)');
  assert.ok(pull>=0&&pull<claim&&claim<queue&&queue<flush&&flush<cleanup);
  assert.match(source,/applyNativeFavoriteSyncRows\('word'/);
  assert.match(source,/applyNativeFavoriteSyncRows\('song'/);
});

test('old ACK cannot remove or mutate a newer revision of the same operation',()=>{
  let queue=[];
  ({queue}=enqueueProgressEntry(queue,'user_settings',{value:'old'},{id:'user_settings:current',createdAt:'2026-09-29T00:00:00.000Z'}));
  const sent=queue[0];
  assert.equal(sent.revision,1);
  ({queue}=enqueueProgressEntry(queue,'user_settings',{value:'new'},{id:'user_settings:current',createdAt:'2026-09-29T00:00:01.000Z'}));
  assert.equal(queue[0].revision,2);
  assert.notEqual(progressQueueRevisionToken(queue[0]),progressQueueRevisionToken(sent));

  const removed=removeProgressQueueEntry(queue,sent.id,sent.revision);
  assert.equal(removed.changed,false);
  assert.equal(removed.queue[0].payload.value,'new');

  const updated=updateProgressQueueEntry(queue,sent.id,{attempts:99},sent.revision);
  assert.equal(updated.changed,false);
  assert.equal(updated.queue[0].attempts,0);
});

test('legacy queue entries get a stable revision zero and become revision one on replace',()=>{
  const normalized=normalizeProgressQueue([{id:'word_favorite:1',type:'word_favorite',payload:{word_id:'1'}}]);
  assert.equal(normalized[0].revision,0);
  const result=enqueueProgressEntry(normalized,'word_favorite',{word_id:'1',is_active:false},{id:'word_favorite:1'});
  assert.equal(result.entry.revision,1);
});

test('dictionary storage uses semantic active keys and treats numbered keys as migration-only',()=>{
  assert.equal(DICTIONARY_CACHE_KEY,'alantil_dictionary_cache');
  assert.equal(DICTIONARY_META_KEY,'alantil_dictionary_meta');
  assert.ok(LEGACY_DICTIONARY_CACHE_KEYS.includes('alantil_dictionary_cache_v5'));
  assert.ok(LEGACY_DICTIONARY_CACHE_KEYS.includes('fc_words_cache_v30'));
  assert.deepEqual([...LEGACY_DICTIONARY_META_KEYS],['alantil_dictionary_meta_v1']);

  const source=read('src/shared/data/word-repository.js');
  const loadStart=source.indexOf('async function loadLocalSnapshot');
  const loadBlock=source.slice(loadStart,source.indexOf('function restUrl',loadStart));
  assert.ok(loadBlock.indexOf('readDictionarySnapshot()')<loadBlock.indexOf('readLegacyDictionaryCache()'));
  assert.doesNotMatch(loadBlock,/clearLegacyDictionaryCaches/);
  assert.match(source,/clearDictionaryCacheKeys\(\{ includeFallback: true \}\)/);
  assert.match(source,/source: key === DICTIONARY_CACHE_KEY \? "localstorage-fallback" : "localstorage-migration"/);
});

test('signup and recovery callbacks preserve PKCE flow through the GitHub Pages fallback',()=>{
  const config=read('src/config/supabase.js');
  const auth=read('src/shared/auth/auth-service.js');
  const fallback=read('404.html');
  const bootstrap=read('src/app/bootstrap.js');

  assert.match(config,/new URL\("\/auth\/callback", window\.location\.origin\)/);
  assert.match(auth,/getAuthRedirectUrl\("signup"\)/);
  assert.match(auth,/getAuthRedirectUrl\("recovery"\)/);
  assert.equal((auth.match(/exchangeCodeForSession\(/g)||[]).length,1);
  assert.match(fallback,/window\.location\.pathname/);
  assert.match(fallback,/window\.location\.search/);
  assert.match(fallback,/window\.location\.hash/);
  assert.match(fallback,/__alantil_route/);
  assert.ok(bootstrap.indexOf('restoreFallbackRoute();')<bootstrap.indexOf('const callbackVisit = hasAuthCallback()'));
});
