import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {createDurableQueue} from '../packages/alantil-core/durable-queue.js';
import {
  enqueueProgressEntry,
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

test('queue ACK removes only the exact revision that was sent',()=>{
  let queue=[];
  ({queue}=enqueueProgressEntry(queue,'user_settings',{value:'old'},{id:'user_settings:current',replace:true,createdAt:'2026-09-29T00:00:00Z'}));
  const sent=queue[0];
  assert.equal(sent.revision,1);
  ({queue}=enqueueProgressEntry(queue,'user_settings',{value:'new'},{id:'user_settings:current',replace:true,createdAt:'2026-09-29T00:00:01Z'}));
  assert.equal(queue[0].revision,2);
  assert.notEqual(progressQueueRevisionToken(sent),progressQueueRevisionToken(queue[0]));
  const ack=removeProgressQueueEntry(queue,sent.id,sent.revision);
  assert.equal(ack.changed,false);
  assert.equal(ack.queue[0].payload.value,'new');
  const staleUpdate=updateProgressQueueEntry(queue,sent.id,{attempts:99},sent.revision);
  assert.equal(staleUpdate.changed,false);
  assert.notEqual(staleUpdate.queue[0].attempts,99);
});

test('durable queue ACK cannot delete a newer mobile revision',async()=>{
  let stored=[];
  const queue=createDurableQueue({
    read:async()=>stored,
    write:async(_key,value)=>{stored=value;},
  });
  await queue.mutate('k',(current)=>enqueueProgressEntry(current,'word_favorite',{is_active:true},{id:'word_favorite:one',replace:true}).queue);
  const sent=(await queue.read('k'))[0];
  await queue.mutate('k',(current)=>enqueueProgressEntry(current,'word_favorite',{is_active:false},{id:'word_favorite:one',replace:true}).queue);
  await queue.acknowledge('k',sent);
  const remaining=await queue.read('k');
  assert.equal(remaining.length,1);
  assert.equal(remaining[0].revision,2);
  assert.equal(remaining[0].payload.is_active,false);
});

test('Web guest claim is captured before account scope activation',()=>{
  const source=read('src/shared/progress/progress-sync.js');
  const activate=source.slice(source.indexOf('async function activateScopeForUser'));
  assert.ok(activate.indexOf('captureGuestClaimSnapshot(userId)')>=0);
  assert.ok(activate.indexOf('captureGuestClaimSnapshot(userId)')<activate.indexOf('setStorageScope(userId)'));
  assert.match(source,/clearGuestStorageValues\(\[/);
  assert.match(source,/removeProgressEntry\(entry\.id, scope, entry\.revision\)/);
  assert.match(source,/updateProgressEntry\([\s\S]*scope, entry\.revision\)/);
});

test('default settings are not materialized merely by changing scope',()=>{
  const store=read('src/shared/settings/user-settings-store.js');
  const sync=read('src/shared/progress/progress-sync.js');
  assert.match(store,/if \(stored\.hasStoredSettings\) writeScopedJson\(USER_SETTINGS_KEY, state\)/);
  assert.doesNotMatch(sync,/if \(state\.userSettings\)[\s\S]{0,180}else \{[\s\S]{0,180}enqueueProgress\("user_settings"/);
  assert.match(sync,/!cloudState\?\.userSettings && !guestClaim\?\.hasSettings && !pendingSettings/);
});

test('Mobile guest claim uses a guest owner lock and clears guest state only after revision ACKs',()=>{
  const source=read('mobile/platform/cloud-sync.js');
  assert.match(source,/GUEST_CLAIM_OWNER_KEY=scopedStorageKey\('migration\.guest-claim-owner',GUEST_STORAGE_SCOPE\)/);
  assert.match(source,/tokens=queued\.map\(revisionToken\)/);
  assert.match(source,/pending\.has\(revisionToken\(entry\)\)/);
  assert.match(source,/finalizeNativeGuestClaim\(context\)/);
  assert.match(source,/AsyncStorage\.removeItem\(scopedStorageKey\(base,GUEST_STORAGE_SCOPE\)\)/);
});

test('dictionary local storage uses stable non-versioned fallback keys and migrates every legacy generation',()=>{
  assert.equal(DICTIONARY_CACHE_KEY,'alantil_dictionary_cache');
  assert.equal(DICTIONARY_META_KEY,'alantil_dictionary_meta');
  assert.deepEqual(LEGACY_DICTIONARY_CACHE_KEYS,[
    'alantil_dictionary_cache_v5',
    'alantil_dictionary_cache_v4',
    'alantil_dictionary_cache_v3',
    'alantil_dictionary_cache_v2',
    'alantil_dictionary_cache_v1',
    'fc_words_cache_v30',
  ]);
  assert.deepEqual(LEGACY_DICTIONARY_META_KEYS,['alantil_dictionary_meta_v1']);
  const source=read('src/shared/data/word-repository.js');
  const local=source.slice(source.indexOf('async function loadLocalSnapshot'),source.indexOf('function restUrl'));
  assert.ok(local.indexOf('readDictionarySnapshot()')<local.indexOf('readLegacyDictionaryCache()'));
  assert.doesNotMatch(local,/^\s*clearLegacyDictionaryCaches\(\);[\s\S]*readDictionarySnapshot/m);
  assert.match(source,/clearLegacyDictionaryCaches\(\{ preserveFallback: true \}\)/);
});

test('email signup and recovery use explicit PKCE callback flows on Web and Mobile',()=>{
  const web=read('src/shared/auth/auth-service.js');
  const mobile=read('mobile/platform/auth.native.js');
  const config=read('src/config/supabase.js');
  const bootstrap=read('src/app/bootstrap.js');
  assert.match(web,/emailRedirectTo: getAuthRedirectUrl\("signup"\)/);
  assert.match(web,/redirectTo: getAuthRedirectUrl\("recovery"\)/);
  assert.match(web,/client\.auth\.exchangeCodeForSession\(callback\.code\)/);
  assert.match(config,/new URL\("\/auth\/callback", window\.location\.origin\)/);
  assert.match(bootstrap,/requiresProfileCompletion\(\)/);
  assert.match(mobile,/emailRedirectTo:nativeRedirectUrl\('signup'\)/);
  assert.match(mobile,/redirectTo:nativeRedirectUrl\('recovery'\)/);
  assert.match(mobile,/emailFlow=callbackFlow==='recovery'\|\|callbackFlow==='signup'/);
});
