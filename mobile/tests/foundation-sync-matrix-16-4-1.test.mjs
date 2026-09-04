import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { normalizeAvatarGender, validateNicknameRule } from '../../packages/alantil-core/profile.js';
import { resolveFavoriteSyncRows } from '../../packages/alantil-core/favorites.js';
import { masteryLevelForPercent } from '../../packages/alantil-core/mastery.js';
import { initializeMatchState, matchStateSnapshot, restoreMatchStateSnapshot } from '../../packages/alantil-core/match.js';
import { buildPracticeScope, practiceScopeKey, practiceSelectedPool } from '../../packages/alantil-core/practice-scope.js';
import { resolveTimestampedUserSettings } from '../../packages/alantil-core/settings.js';
import { enqueueProgressEntry, mergeProgressQueueEntries, removeProgressQueueEntry, updateProgressQueueEntry } from '../../packages/alantil-core/sync-policy.js';
import { initializeTestState, restoreTestStateSnapshot, testStateSnapshot } from '../../packages/alantil-core/test.js';
import { mergeCloudWordProgressState, normalizeWordProgressState } from '../../packages/alantil-core/word-progress.js';
import { captureLearnActionSnapshot, initializeLearnState, restoreLearnActionSnapshot } from '../../packages/alantil-core/learning.js';
import { scopedStorageKey, storageScopeForUser } from '../../packages/alantil-core/storage-scope.js';

const read=(path)=>fs.readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
const t=(hour)=>`2026-09-02T${String(hour).padStart(2,'0')}:00:00.000Z`;

function resolveRows(localActive,cloudActive,localTime,cloudTime){
  return resolveFavoriteSyncRows([{id:'x',is_active:localActive,updated_at:localTime}],[{id:'x',is_active:cloudActive,updated_at:cloudTime}])[0];
}

for(const kind of ['word favorites','song favorites','hidden words']){
  test(`${kind}: local newer / cloud older`,()=>assert.equal(resolveRows(false,true,t(12),t(11)).is_active,false));
  test(`${kind}: cloud newer / local older`,()=>assert.equal(resolveRows(true,false,t(10),t(11)).is_active,false));
  test(`${kind}: equal timestamp is deterministic cloud tie-break`,()=>assert.equal(resolveRows(true,false,t(11),t(11)).is_active,false));
  test(`${kind}: delete/tombstone survives merge`,()=>assert.equal(resolveRows(true,false,t(10),t(12)).is_active,false));
}

test('settings: local/cloud/equal timestamp conflict matrix',()=>{
  const local={interface_language_code:'ru',alan_script_code:'cyrillic',alan_dialect_code:'canonical',text_size_code:'large'};
  const cloud={interface_language_code:'en',alan_script_code:'turkic',alan_dialect_code:'canonical'};
  assert.equal(resolveTimestampedUserSettings({localSettings:local,localUpdatedAt:t(12),cloudSettings:cloud,cloudUpdatedAt:t(11)}).source,'local');
  const newer=resolveTimestampedUserSettings({localSettings:local,localUpdatedAt:t(10),cloudSettings:cloud,cloudUpdatedAt:t(11)});assert.equal(newer.source,'cloud');assert.equal(newer.settings.text_size_code,'large');
  assert.equal(resolveTimestampedUserSettings({localSettings:local,localUpdatedAt:t(11),cloudSettings:cloud,cloudUpdatedAt:t(11)}).source,'cloud');
});

test('progress: merge is monotonic for local newer/cloud older and cloud newer/local older',()=>{
  const local=normalizeWordProgressState({rows:{x:{word_id:'x',known_count:5,last_seen_at:t(12),mastery_status:'mastered'}}});
  mergeCloudWordProgressState(local,[{word_id:'x',known_count:2,last_seen_at:t(11),mastery_status:'learning'}]);
  assert.equal(local.rows.x.known_count,5);assert.equal(local.rows.x.last_seen_at,t(12));assert.equal(local.rows.x.mastery_status,'mastered');
  mergeCloudWordProgressState(local,[{word_id:'x',known_count:7,last_seen_at:t(13),mastery_status:'review',last_mode:'test',last_result:'wrong'}]);
  assert.equal(local.rows.x.known_count,7);assert.equal(local.rows.x.last_seen_at,t(13));assert.equal(local.rows.x.mastery_status,'review');assert.equal(local.rows.x.last_result,'wrong');
});

test('cloud queue: duplicate stable entry replaces payload without duplicating',()=>{
  let queue=[];({queue}=enqueueProgressEntry(queue,'word_favorite',{is_active:true},{id:'word_favorite:x',createdAt:t(10)}));({queue}=enqueueProgressEntry(queue,'word_favorite',{is_active:false},{id:'word_favorite:x',createdAt:t(11)}));
  assert.equal(queue.length,1);assert.equal(queue[0].payload.is_active,false);assert.equal(queue[0].created_at,t(10));
});

test('cloud queue: failed request state can be retained, attempts updated, then removed on retry success',()=>{
  let queue=[];({queue}=enqueueProgressEntry(queue,'user_settings',{value:1},{id:'user_settings:current',createdAt:t(10)}));
  let updated=updateProgressQueueEntry(queue,'user_settings:current',{attempts:1,last_error:'503'});assert.equal(updated.queue.length,1);assert.equal(updated.queue[0].attempts,1);
  const removed=removeProgressQueueEntry(updated.queue,'user_settings:current');assert.equal(removed.changed,true);assert.equal(removed.queue.length,0);
  const source=read('mobile/platform/cloud-sync.js');assert.match(source,/if\(!response\.ok\)\{ok=false;continue;\}/);assert.match(source,/removeProgressQueueEntry\(queue,entry\.id\)/);
});

test('guest -> account queue merge deduplicates and labels claimed entries',()=>{
  const account=[{id:'word_favorite:x',type:'word_favorite',payload:{is_active:false},created_at:t(12),attempts:0}];
  const guest=[{id:'word_favorite:x',type:'word_favorite',payload:{is_active:true},created_at:t(10),attempts:0},{id:'word_favorite:y',type:'word_favorite',payload:{is_active:true},created_at:t(10),attempts:0}];
  const merged=mergeProgressQueueEntries(account,guest,{claimId:'claim-1'});assert.equal(merged.length,2);assert.equal(merged.find((x)=>x.id==='word_favorite:x').payload.is_active,false);assert.equal(merged.find((x)=>x.id==='word_favorite:y').claim_id,'claim-1');
});

test('user A -> logout -> user B storage keys cannot collide',()=>{
  const guest=storageScopeForUser(''),a=storageScopeForUser('A'),b=storageScopeForUser('B');
  assert.equal(guest,'guest');assert.notEqual(a,b);assert.notEqual(scopedStorageKey('progress',a),scopedStorageKey('progress',b));assert.notEqual(scopedStorageKey('session:test',a),scopedStorageKey('session:test',b));
  const auth=read('mobile/platform/auth.native.js');assert.match(auth,/persist\(null\)/);assert.match(auth,/setNativeStorageScope\(currentSession\?\.user\?\.id\|\|''\)/);
});

test('restart offline keeps scoped Test/Match snapshots fully restorable',()=>{
  const words=Array.from({length:20},(_,i)=>({id:String(i+1),word:`w${i+1}`,trans:`t${i+1}`,pos:'noun'}));
  const testState={session:{id:'test-offline',startedAt:t(10)}};initializeTestState(testState,words,'kb',20,{},words);testState.index=3;testState.correct=2;testState.results=[{id:'1',isCorrect:true},{id:'2',isCorrect:false},{id:'3',isCorrect:true}];
  const testRestored=restoreTestStateSnapshot(JSON.parse(JSON.stringify(testStateSnapshot(testState))),words,words);assert.equal(testRestored.index,3);assert.equal(testRestored.correct,2);assert.equal(testRestored.items.length,20);assert.equal(testRestored.results.length,3);
  const matchState={session:{id:'match-offline',startedAt:t(10)}};initializeMatchState(matchState,words,20,{});matchState.roundIndex=1;matchState.solved.add(String(matchState.rounds[0][0].id));matchState.shown.add(String(matchState.rounds[0][0].id));matchState.solvedCount=1;matchState.errorsCount=2;matchState.failMap.x=2;
  const matchRestored=restoreMatchStateSnapshot(JSON.parse(JSON.stringify(matchStateSnapshot(matchState))),words);assert.equal(matchRestored.roundIndex,1);assert.equal(matchRestored.solvedCount,1);assert.equal(matchRestored.errorsCount,2);assert.equal(matchRestored.rounds.flat().length,20);assert.equal(matchRestored.solved.size,1);
});

test('Learn state snapshot data survives JSON restart and shared action restoration',()=>{
  const words=[{id:'1',word:'w1',trans:'t1'},{id:'2',word:'w2',trans:'t2'}],state={currentDict:'d',currentSection:'s',currentSet:'1',mainQueue:[],repeatQueue:[],round:'main',totalPlanned:0,currentStudyId:'',swipeHistory:[],analyticsActions:[],sessionFailMap:{},studySession:{inProgress:false,completed:false,wordsPool:[],progressData:{},wordStats:{},metadata:{}}};
  initializeLearnState(state,words,'kb',{});state.currentStudyId='1';state.sessionFailMap['1']=1;state.studySession.progressData.known=1;state.studySession.wordStats['1']={word_id:'1',show_count:1,left_swipe_count:1,final_result:'unfinished',first_position:1};
  const snap=captureLearnActionSnapshot(state),json=JSON.parse(JSON.stringify(snap));state.mainQueue=[];state.repeatQueue=[];restoreLearnActionSnapshot(state,json);assert.equal(state.mainQueue.length,2);assert.equal(state.currentStudyId,'1');assert.equal(state.sessionFailMap['1'],1);assert.equal(state.studySession.wordStats['1'].show_count,1);
  const mobile=read('mobile/screens/learn.js');assert.match(mobile,/saveNativeSessionSnapshot\('learn'/);assert.match(mobile,/loadNativeSessionSnapshot\('learn'\)/);
});

test('mastery boundary contract is exact',()=>{
  for(const [percent,level] of [[0,0],[79,0],[80,1],[89,1],[90,2],[99,2],[100,3]])assert.equal(masteryLevelForPercent(percent),level);
});

test('account profile fixtures cover nickname rules and avatar gender normalization',()=>{
  assert.equal(validateNicknameRule('ab').valid,false);assert.equal(validateNicknameRule('abc').valid,true);assert.equal(validateNicknameRule('abc_123').valid,true);assert.equal(validateNicknameRule('абв').valid,false);
  assert.equal(normalizeAvatarGender('male'),'male');assert.equal(normalizeAvatarGender('female'),'female');assert.equal(normalizeAvatarGender('other'),'');
  const api=read('mobile/platform/profile-api.js');assert.match(api,/is_nickname_available/);assert.match(api,/createNativeProfile/);assert.match(api,/loadNativeProfile/);assert.match(api,/normalizeAvatarGender/);
});

test('auth fixture contract covers restore, expiry refresh, 401 retry, logout and scope switching',()=>{
  const source=read('mobile/platform/auth.native.js');
  assert.match(source,/AsyncStorage\.getItem\(SESSION_KEY\)/);assert.match(source,/expires_at<=Date\.now\(\)\+60000/);assert.match(source,/refreshNativeAuthSession/);assert.match(source,/response\.status===401/);assert.match(source,/response=await authorizedRequest\(path,options,currentSession\)/);assert.match(source,/signOutNative/);assert.match(source,/AsyncStorage\.removeItem\(SESSION_KEY\)/);assert.match(source,/setNativeStorageScope/);assert.match(source,/alantil:\/\/auth\/callback/);
  const cloud=read('mobile/platform/cloud-sync.js');assert.match(cloud,/claimNativeGuestStateToAccount/);assert.match(cloud,/guest-claim:/);assert.match(cloud,/synchronizeNativeAccount/);
});

test('first launch offline bundled snapshot builds complete Practice scope',()=>{
  const snapshot=JSON.parse(read('mobile/data/dictionary-snapshot.json'));assert.ok(snapshot.word_count>=2500);assert.equal(snapshot.words.length,snapshot.word_count);
  const scope=buildPracticeScope(snapshot.words);const count=scope.reduce((sum,d)=>sum+d.count,0);assert.equal(count,snapshot.word_count);
  const keys=new Set(scope.flatMap((d)=>d.sections.map((s)=>practiceScopeKey(d.id,s.id))));assert.equal(practiceSelectedPool(snapshot.words,keys).length,snapshot.word_count);
  const bootstrap=read('mobile/platform/dictionary.js');const start=bootstrap.indexOf('export async function bootstrapNativeDictionary');const end=bootstrap.indexOf('export async function refreshNativeDictionary');const body=bootstrap.slice(start,end);assert.ok(body.indexOf('bundledSnapshot()')<body.indexOf('starterSnapshot()'));
});
