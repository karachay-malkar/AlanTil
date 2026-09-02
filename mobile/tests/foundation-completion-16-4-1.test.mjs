import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { GUEST_STORAGE_SCOPE, scopedStorageKey, storageScopeForUser, storageScopeUserId } from '../../packages/alantil-core/storage-scope.js';
const read=(path)=>fs.readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');

test('shared storage scopes isolate guest and users deterministically',()=>{
  assert.equal(storageScopeForUser(''),GUEST_STORAGE_SCOPE);assert.equal(storageScopeForUser('abc'),'user:abc');assert.equal(storageScopeUserId('user:abc'),'abc');
  assert.notEqual(scopedStorageKey('progress','guest'),scopedStorageKey('progress','user:a'));assert.notEqual(scopedStorageKey('progress','user:a'),scopedStorageKey('progress','user:b'));
});

test('mobile persisted state uses scoped storage keys and legacy data migrates only to guest',()=>{
  for(const file of ['mobile/platform/storage.js','mobile/platform/progress.js','mobile/platform/session-store.js','mobile/platform/cloud-sync.js']){const source=read(file);assert.match(source,/nativeScopedStorageKey|scopedStorageKey/);}
  const scope=read('mobile/platform/storage-scope.js');assert.match(scope,/migrateLegacyNativeValueToGuest/);assert.match(scope,/GUEST_STORAGE_SCOPE/);assert.match(scope,/AsyncStorage\.removeItem\(baseKey\)/);
});

test('auth refreshes near expiry, on foreground, and retries a 401 once',()=>{
  const source=read('mobile/platform/auth.js');assert.match(source,/AppState\.addEventListener/);assert.match(source,/refreshNativeAuthSession/);assert.match(source,/response\.status===401/);assert.match(source,/await refreshNativeAuthSession\(\)/);assert.match(source,/setNativeStorageScope/);assert.match(source,/alantil:\/\/auth\/callback/);
});

test('guest state has an explicit one-time account claim path',()=>{
  const source=read('mobile/platform/cloud-sync.js');assert.match(source,/claimNativeGuestStateToAccount/);assert.match(source,/guest-claim:/);assert.match(source,/GUEST_STORAGE_SCOPE/);assert.match(source,/synchronizeNativeAccount/);
});

test('cloud queue is scoped and failed entries are not removed',()=>{
  const source=read('mobile/platform/cloud-sync.js');assert.match(source,/nativeScopedStorageKey\(QUEUE_BASE\)/);assert.match(source,/if\(!response\.ok\)\{ok=false;continue;\}/);assert.match(source,/removeProgressQueueEntry/);
});

test('bundled dictionary is full and bootstrap selects it before starter emergency fallback',()=>{
  const snapshot=JSON.parse(read('mobile/data/dictionary-snapshot.json'));assert.ok(snapshot.version);assert.ok(snapshot.words.length>=2500);assert.equal(snapshot.word_count,snapshot.words.length);assert.equal(new Set(snapshot.words.map((row)=>String(row.word_id))).size,snapshot.words.length);
  const source=read('mobile/platform/dictionary.js');const bootstrap=source.slice(source.indexOf('export async function bootstrapNativeDictionary'),source.indexOf('export async function refreshNativeDictionary'));assert.ok(bootstrap.indexOf('const bundled=bundledSnapshot()')>=0);assert.ok(bootstrap.indexOf('const bundled=bundledSnapshot()')<bootstrap.indexOf('starterSnapshot()'));assert.match(source,/source:'bundled-snapshot'/);assert.match(source,/source:'starter-emergency'/);
});
