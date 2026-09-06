import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { bootstrapDictionaryRuntime } from '../../packages/alantil-core/dictionary-bootstrap.js';
import { resolveFavoriteSyncRows } from '../../packages/alantil-core/favorites.js';
import { initializeMatchState, matchStateSnapshot, restoreMatchStateSnapshot } from '../../packages/alantil-core/match.js';
import { buildPracticeScope, practiceScopeKey, practiceSelectedPool } from '../../packages/alantil-core/practice-scope.js';
import { resolveTimestampedUserSettings } from '../../packages/alantil-core/settings.js';
import { GUEST_STORAGE_SCOPE, scopedStorageKey, storageScopeForUser, storageScopeUserId } from '../../packages/alantil-core/storage-scope.js';
import { initializeTestState, restoreTestStateSnapshot, testStateSnapshot } from '../../packages/alantil-core/test.js';
const read=(path)=>fs.readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');

test('shared storage scopes isolate guest and users deterministically',()=>{
  assert.equal(storageScopeForUser(''),GUEST_STORAGE_SCOPE);assert.equal(storageScopeForUser('abc'),'user:abc');assert.equal(storageScopeUserId('user:abc'),'abc');
  assert.notEqual(scopedStorageKey('progress','guest'),scopedStorageKey('progress','user:a'));assert.notEqual(scopedStorageKey('progress','user:a'),scopedStorageKey('progress','user:b'));
});

test('mobile persisted state uses scoped storage keys and legacy data migrates only to guest',()=>{
  for(const file of ['mobile/platform/storage.js','mobile/platform/progress.js','mobile/platform/session-store.js','mobile/platform/cloud-sync.js','mobile/platform/hidden-words.js']){const source=read(file);assert.match(source,/nativeScopedStorageKey|scopedStorageKey|async function key\(base\)/);}
  const scope=read('mobile/platform/storage-scope.js');assert.match(scope,/migrateLegacyNativeValueToGuest/);assert.match(scope,/GUEST_STORAGE_SCOPE/);assert.match(scope,/AsyncStorage\.removeItem\(baseKey\)/);
});

test('auth refreshes near expiry, on foreground, and retries a 401 once',()=>{
  const source=read('mobile/platform/auth.native.js');assert.match(source,/AppState\.addEventListener/);assert.match(source,/refreshNativeAuthSession/);assert.match(source,/response\.status===401/);assert.match(source,/await refreshNativeAuthSession\(\)/);assert.match(source,/setNativeStorageScope/);assert.match(source,/alantil:\/\/auth\/callback/);
});

test('guest state has an explicit one-time account claim path',()=>{
  const source=read('mobile/platform/cloud-sync.js');assert.match(source,/claimNativeGuestStateToAccount/);assert.match(source,/guest-claim:/);assert.match(source,/GUEST_STORAGE_SCOPE/);assert.match(source,/synchronizeNativeAccount/);
});

test('cloud queue is scoped and failed entries are not removed',()=>{
  const source=read('mobile/platform/cloud-sync.js');assert.match(source,/nativeScopedStorageKey\(QUEUE_BASE\)/);assert.match(source,/if\(!response\.ok\)\{ok=false;continue;\}/);assert.match(source,/removeProgressQueueEntry/);
});

test('favorite conflicts use updated_at and preserve tombstones',()=>{
  const local=[{id:'1',is_active:false,updated_at:'2026-09-02T10:00:00.000Z'},{id:'2',is_active:true,updated_at:'2026-09-02T08:00:00.000Z'}];
  const cloud=[{id:'1',is_active:true,updated_at:'2026-09-02T09:00:00.000Z'},{id:'2',is_active:false,updated_at:'2026-09-02T11:00:00.000Z'}];
  const resolved=resolveFavoriteSyncRows(local,cloud),byId=new Map(resolved.map((row)=>[row.id,row]));
  assert.equal(byId.get('1').is_active,false);assert.equal(byId.get('2').is_active,false);
  const equal=resolveFavoriteSyncRows([{id:'3',is_active:true,updated_at:'2026-09-02T12:00:00.000Z'}],[{id:'3',is_active:false,updated_at:'2026-09-02T12:00:00.000Z'}]);assert.equal(equal[0].is_active,false);
  const source=read('mobile/platform/cloud-sync.js');assert.match(source,/select=word_id,is_active,updated_at/);assert.doesNotMatch(source,/user_word_favorites\?is_active=eq\.true/);
});

test('hidden words are scoped and resolve active/inactive rows by updated_at',()=>{
  const source=read('mobile/platform/hidden-words.js');assert.match(source,/SYNC_KEY='alantil:16\.4\.1:hidden-words-sync'/);assert.match(source,/nativeScopedStorageKey/);assert.match(source,/select=word_id,is_hidden,updated_at/);assert.match(source,/resolveFavoriteSyncRows/);assert.doesNotMatch(source,/is_hidden=eq\.true/);
});

test('settings conflicts use updated_at and retain device-local text size',()=>{
  const local={interface_language_code:'ru',alan_script_code:'cyrillic',alan_dialect_code:'canonical',text_size_code:'large'};
  const cloud={interface_language_code:'en',alan_script_code:'turkic',alan_dialect_code:'canonical'};
  const localWins=resolveTimestampedUserSettings({localSettings:local,localUpdatedAt:'2026-09-02T12:00:00.000Z',cloudSettings:cloud,cloudUpdatedAt:'2026-09-02T11:00:00.000Z'});assert.equal(localWins.source,'local');assert.equal(localWins.settings.interface_language_code,'ru');
  const cloudWins=resolveTimestampedUserSettings({localSettings:local,localUpdatedAt:'2026-09-02T10:00:00.000Z',cloudSettings:cloud,cloudUpdatedAt:'2026-09-02T11:00:00.000Z'});assert.equal(cloudWins.source,'cloud');assert.equal(cloudWins.settings.interface_language_code,'en');assert.equal(cloudWins.settings.text_size_code,'large');
  const source=read('mobile/platform/cloud-sync.js');assert.match(source,/loadNativeSettingsSyncTimestamp/);assert.match(source,/resolveTimestampedUserSettings/);assert.match(source,/updated_at:settingsTimestamp/);
});

test('shared practice scope produces the same dictionary-section pool contract',()=>{
  const words=[{id:'1',dictionary_id:'d1',dictionary_name:'D1',section_id:'s1',section_name:'S1'},{id:'2',dictionary_id:'d1',dictionary_name:'D1',section_id:'s2',section_name:'S2'},{id:'3',dictionary_id:'d2',dictionary_name:'D2',section_id:'s3',section_name:'S3'}];
  const scope=buildPracticeScope(words);assert.equal(scope.length,2);assert.equal(scope[0].count,2);assert.equal(scope[0].sections.length,2);const selected=new Set([practiceScopeKey('d1','s2')]);assert.deepEqual(practiceSelectedPool(words,selected).map((word)=>word.id),['2']);
});

test('shared test and match snapshot contracts round-trip resumable state',()=>{
  const words=Array.from({length:20},(_,index)=>({id:String(index+1),word:`w${index+1}`,trans:`t${index+1}`,pos:'noun'}));
  const testState={session:{id:'test-1',startedAt:'2026-09-02T10:00:00.000Z'}};initializeTestState(testState,words,'kb',20,{},words);testState.index=2;testState.correct=1;testState.results=[{id:'1',isCorrect:true},{id:'2',isCorrect:false}];const restoredTest=restoreTestStateSnapshot(testStateSnapshot(testState),words,words);assert.equal(restoredTest.index,2);assert.equal(restoredTest.correct,1);assert.equal(restoredTest.session.id,'test-1');
  const matchState={session:{id:'match-1',startedAt:'2026-09-02T10:00:00.000Z'}};initializeMatchState(matchState,words,20,{});matchState.roundIndex=1;matchState.solved.add(String(matchState.rounds[0][0].id));matchState.solvedCount=1;const restoredMatch=restoreMatchStateSnapshot(matchStateSnapshot(matchState),words);assert.equal(restoredMatch.roundIndex,1);assert.equal(restoredMatch.solvedCount,1);assert.ok(restoredMatch.solved.size===1);
});

test('bundled dictionary is full and bootstrap selects it before starter emergency fallback',async()=>{
  const snapshot=JSON.parse(read('mobile/data/dictionary-snapshot.json'));assert.equal(snapshot.version,'2026.08.30.1');assert.equal(snapshot.words.length,2976);assert.equal(snapshot.word_count,snapshot.words.length);assert.equal(new Set(snapshot.words.map((row)=>String(row.word_id))).size,snapshot.words.length);
  let downloaded=false,starterUsed=false;
  const bundled={version:snapshot.version,words:snapshot.words,source:'bundled-snapshot'};
  const runtime=await bootstrapDictionaryRuntime({readCache:async()=>null,bundledSnapshot:()=>bundled,downloadSnapshot:async()=>{downloaded=true;throw new Error('offline');},starterSnapshot:()=>{starterUsed=true;return{version:'starter',words:[]};},persistSnapshot:async()=>false,refreshSnapshot:async()=>null});
  assert.equal(runtime,bundled);assert.equal(downloaded,false);assert.equal(starterUsed,false);
  const source=read('mobile/platform/dictionary.js');assert.match(source,/bootstrapDictionaryRuntime/);assert.match(source,/source:'bundled-snapshot'/);assert.match(source,/source:'starter-emergency'/);
});
