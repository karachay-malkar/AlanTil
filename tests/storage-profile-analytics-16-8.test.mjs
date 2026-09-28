import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalStorageBaseKey,legacyStorageBaseKeys,scopedStorageKey} from '../packages/alantil-core/storage-scope.js';
import {normalizeSocialUser} from '../packages/alantil-core/social.js';
import {normalizeProfileGender} from '../packages/alantil-core/profile.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('legacy storage bases resolve to versionless semantic keys',()=>{
  assert.equal(canonicalStorageBaseKey('alantil_word_progress_v13_5'),'progress.words');
  assert.equal(canonicalStorageBaseKey('alantil:16.1:word-progress'),'progress.words');
  assert.equal(canonicalStorageBaseKey('fc_favorites_v1'),'favorites.words');
  assert.equal(canonicalStorageBaseKey('alantil:16.1:session:test:favorites'),'sessions.active.test:favorites');
  assert.equal(scopedStorageKey('alantil_user_settings_v1','user:abc'),'alantil_scope_v1:user:abc:settings');
  assert.ok(legacyStorageBaseKeys('progress.words').includes('alantil_word_progress_v13_5'));
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

test('mobile technical visits are recorded before optional analytics consent is checked',()=>{
  const source=read('mobile/platform/analytics.js');
  const functionStart=source.indexOf('export async function trackNativeScreen');
  const visit=source.indexOf('recordScreenVisit(',functionStart);
  const optionalGate=source.indexOf('if(!await analyticsEnabled())',functionStart);
  assert.ok(functionStart>=0&&visit>functionStart&&optionalGate>visit);
  assert.doesNotMatch(source,/setNativeAnalyticsRuntimeEnabled[\s\S]{0,400}removeItem\(VISITOR_KEY\)/);
});
