import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  canonicalStorageBaseKey,
  isKnownStorageBaseKey,
  legacyStorageBaseKeys,
  parseScopedStorageKey,
  scopedStorageKey,
} from '../packages/alantil-core/storage-scope.js';
import {normalizeSocialUser} from '../packages/alantil-core/social.js';
import {hasCompleteProfile,normalizeProfileGender} from '../packages/alantil-core/profile.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('legacy storage bases resolve to versionless semantic keys',()=>{
  assert.equal(canonicalStorageBaseKey('alantil_word_progress_v13_5'),'progress.words');
  assert.equal(canonicalStorageBaseKey('alantil:16.1:word-progress'),'progress.words');
  assert.equal(canonicalStorageBaseKey('fc_favorites_v1'),'favorites.words');
  assert.equal(canonicalStorageBaseKey('alantil:16.1:session:test:favorites'),'sessions.active.test:favorites');
  assert.equal(scopedStorageKey('alantil_user_settings_v1','user:abc'),'alantil_scope_v1:user:abc:settings');
  assert.ok(legacyStorageBaseKeys('progress.words').includes('alantil_word_progress_v13_5'));
  assert.equal(isKnownStorageBaseKey('alantil_auth_session_v1'),false);
  assert.equal(isKnownStorageBaseKey('alantil_analytics_visitor_id_v1'),false);
});

test('scoped storage parser preserves guest and user scopes',()=>{
  assert.deepEqual(parseScopedStorageKey('alantil_scope_v1:guest:fc_favorites_v1'),{scope:'guest',baseKey:'fc_favorites_v1'});
  assert.deepEqual(parseScopedStorageKey('alantil_scope_v1:user:abc-123:alantil_word_progress_v13_5'),{scope:'user:abc-123',baseKey:'alantil_word_progress_v13_5'});
  assert.equal(parseScopedStorageKey('alantil_auth_session_v1'),null);
});

test('startup performs complete semantic storage migration on Web and Mobile',()=>{
  const web=read('src/app/bootstrap.js');
  const webScope=read('src/shared/progress/storage-scope.js');
  const mobile=read('mobile/AppRoot.js');
  const mobileScope=read('mobile/platform/storage-scope.js');
  assert.match(web,/migrateAllStorageKeys\(\)/);
  assert.match(webScope,/export function migrateAllStorageKeys\(\)/);
  assert.match(mobile,/migrateAllNativeStorageKeys\(\)/);
  assert.match(mobileScope,/export async function migrateAllNativeStorageKeys\(\)/);
  assert.match(webScope,/localStorage\.removeItem\(source\)/);
  assert.match(mobileScope,/AsyncStorage\.removeItem\(source\)/);
});

test('missing social gender stays neutral instead of becoming male',()=>{
  assert.equal(normalizeSocialUser({avatar_gender:null}).avatar_gender,'');
  assert.equal(normalizeSocialUser({avatar_gender:'male'}).avatar_gender,'male');
  assert.equal(normalizeSocialUser({avatar_gender:'female'}).avatar_gender,'female');
});

test('profile gender accepts only supported explicit values',()=>{
  assert.equal(normalizeProfileGender('male'),'male');
  assert.equal(normalizeProfileGender('female'),'female');
  assert.equal(normalizeProfileGender('unknown'),'');
});

test('profile completion requires nickname and an explicit avatar gender',()=>{
  assert.equal(hasCompleteProfile({nickname:'alan_user',avatar_gender:null}),false);
  assert.equal(hasCompleteProfile({nickname:'alan_user',avatar_gender:''}),false);
  assert.equal(hasCompleteProfile({nickname:'alan_user',avatar_gender:'male'}),true);
  assert.equal(hasCompleteProfile({nickname:'alan_user',avatar_gender:'female'}),true);
});

test('authenticated incomplete profile is a blocking gate before the learning path',()=>{
  const web=read('src/app/bootstrap.js');
  const router=read('src/app/router.js');
  const account=read('src/features/account/index.js');
  const accountView=read('src/features/account/profile.js');
  const accountStyles=read('src/features/account/account.css');
  const mobile=read('mobile/AppRoot.js');
  const mobileAccount=read('mobile/screens/profile.js');
  assert.match(web,/requiresProfileCompletion/);
  assert.match(web,/\/profile\/account/);
  assert.match(account,/let profileCompletionRequired = false/);
  assert.match(account,/let pendingAuthSuccess = false/);
  assert.match(account,/let pendingPasswordReady = false/);
  assert.match(account,/pendingPasswordReady = true;[\s\S]{0,160}await updateCurrentUserPassword\(password\)/);
  assert.doesNotMatch(account,/await updateCurrentUserPassword\(password\);[\s\S]{0,400}context\.router\.replace/);
  assert.match(account,/const profileIncomplete = !hasCompleteProfile\(profile\)/);
  assert.match(account,/if \(pendingAuthSuccess \|\| pendingPasswordReady\)/);
  assert.match(account,/pendingPasswordReady \? "password_ready" : "auth_success"/);
  assert.match(account,/export function requestLeave\(\) \{\s*return !profileCompletionRequired;\s*\}/);
  assert.match(account,/export function canLeave\(\) \{\s*return !profileCompletionRequired;\s*\}/);
  assert.match(account,/setBackVisible\?\.\(!profileCompletionRequired\)/);
  assert.match(account,/profileCompletionLock/);
  assert.match(account,/bottomNav/);
  assert.ok(router.indexOf('currentModule?.requestLeave')>=0);
  assert.ok(router.indexOf('currentModule?.requestLeave')<router.indexOf('modal.confirm'));
  assert.doesNotMatch(account,/getProfile\(nextUserId\)/);
  assert.match(account,/reason: "profile_completed"/);
  assert.match(accountView,/segmentControl settingsSegments accountGenderOptions/);
  assert.match(accountView,/settingsChoice accountGenderOption/);
  assert.match(accountView,/settingsChoiceBody/);
  assert.doesNotMatch(accountStyles,/accountGenderOption\.active/);
  assert.match(mobile,/profileCompletionRequired&&authUserKey/);
  assert.match(mobile,/nativeProfileCompletionRequired/);
  assert.match(mobileAccount,/onProfileCompleted/);
});

test('mobile dictionary replaces in-memory words after background refresh',()=>{
  const dictionary=read('mobile/platform/dictionary.js');
  const app=read('mobile/AppRoot.js');
  assert.match(dictionary,/subscribeNativeDictionary/);
  assert.match(dictionary,/emitDictionaryUpdate\(snapshot\)/);
  assert.match(app,/subscribeNativeDictionary/);
  assert.match(app,/setWords\(snapshot\.words\)/);
});

test('dictionary release migration forces every client to see a newer production version',()=>{
  const migration=read('supabase/migrations/20260928223100_alantil_16_8_dictionary_version_20260928.sql');
  assert.match(migration,/dictionary_metadata/);
  assert.match(migration,/2026\.09\.28\.1/);
  assert.match(migration,/on conflict \(dictionary_key\) do update/i);
});

test('mobile technical visits are recorded before optional analytics consent is checked',()=>{
  const source=read('mobile/platform/analytics.js');
  const functionStart=source.indexOf('export async function trackNativeScreen');
  const visit=source.indexOf('recordScreenVisit(',functionStart);
  const optionalGate=source.indexOf('if(!await analyticsEnabled())',functionStart);
  assert.ok(functionStart>=0&&visit>functionStart&&optionalGate>visit);
  assert.doesNotMatch(source,/setNativeAnalyticsRuntimeEnabled[\s\S]{0,400}removeItem\(VISITOR_KEY\)/);
});
