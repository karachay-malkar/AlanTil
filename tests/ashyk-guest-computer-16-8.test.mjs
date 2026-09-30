import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ASHYK_FEATURE_FLAGS,ashykAccessForUser,ashykModeOptionsForUser,isAshykModeAllowed} from '../packages/alantil-core/ashyk-access.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('guest Ashyk access is computer-only while registered users keep friend mode',()=>{
  assert.equal(ASHYK_FEATURE_FLAGS.allowGuests,true);
  assert.deepEqual([...ashykAccessForUser('').modes],['computer']);
  assert.equal(ashykAccessForUser('').locked,false);
  assert.equal(isAshykModeAllowed('computer',{userId:''}),true);
  assert.equal(isAshykModeAllowed('online',{userId:''}),false);
  assert.deepEqual([...ashykAccessForUser('registered-user').modes],['computer','online']);
});

test('shared segmented controls use the high-contrast selected-state contract',()=>{
  const web=read('src/shared/styles/segmented-control.css');
  const mobile=read('mobile/ui/components.js');
  const ashykMobile=read('mobile/screens/ashyk.js');
  assert.match(web,/input:checked\+(?:\.settingsChoiceBody|span)[\s\S]*background:var\(--surface-0\)/);
  assert.match(web,/input:checked\+(?:\.settingsChoiceBody|span)[\s\S]*color:var\(--accent-strong\)/);
  assert.match(web,/input:checked\+(?:\.settingsChoiceBody|span)[\s\S]*var\(--line-strong\)/);
  assert.match(mobile,/segmentedItemActive:\{backgroundColor:C\.surface0,borderWidth:1,borderColor:C\.lineStrong/);
  assert.match(mobile,/segmentedLabelActive:\{color:C\.accentStrong,fontWeight:'800'\}/);
  assert.match(ashykMobile,/segmentedItemActive:\{backgroundColor:C\.surface0,borderWidth:1,borderColor:C\.lineStrong/);
  assert.match(ashykMobile,/segmentedLabelActive:\{color:C\.accentStrong,fontWeight:'800'\}/);
});

test('difficulty chooser has a reserved explanation area driven by selected computer difficulty',()=>{
  const web=read('packages/ashyk-game/web/Game.jsx');
  const mobile=read('mobile/screens/ashyk.js');
  assert.match(web,/ashykDifficultyHint/);
  assert.match(web,/computerShotAccuracy\*100/);
  assert.match(web,/computerAnswerAccuracy\*100/);
  assert.match(mobile,/difficultyHint/);
  assert.match(mobile,/computerShotAccuracy\*100/);
  assert.match(mobile,/computerAnswerAccuracy\*100/);
});


test('friend mode stays visible to guests but remains registration-gated by the shared access contract',()=>{
  assert.deepEqual(ashykModeOptionsForUser('').map(({id,allowed,requiresRegistration})=>({id,allowed,requiresRegistration})),[
    {id:'computer',allowed:true,requiresRegistration:false},
    {id:'online',allowed:false,requiresRegistration:true},
  ]);
  assert.deepEqual(ashykModeOptionsForUser('registered-user').filter(({allowed})=>allowed).map(({id})=>id),['computer','online']);
  assert.equal(isAshykModeAllowed('online',{userId:''}),false);
});

test('Web and Native show the guest friend gate without opening an online adapter',()=>{
  const web=read('packages/ashyk-game/web/Game.jsx');
  const feature=read('src/features/ashyk/index.js');
  const mobile=read('mobile/screens/ashyk.js');
  const social=read('packages/alantil-core/social-i18n.js');
  assert.match(web,/ashykModeOptionsForUser/);
  assert.match(web,/lockedMode/);
  assert.match(web,/ashykModeLock/);
  assert.match(web,/onAuthRequired/);
  assert.match(web,/supabaseClient&&userId\?createAshykOnlineAdapter/);
  assert.match(feature,/onAuthRequired\(\)\{void context\.router\.navigate\('account\.home'\);\}/);
  assert.match(mobile,/ashykModeOptionsForUser/);
  assert.match(mobile,/lockedMode/);
  assert.match(mobile,/onAuthRequired/);
  assert.match(mobile,/supabaseClient&&userId\?createAshykOnlineAdapter/);
  assert.match(social,/signInOrCreateAccount/);
  assert.match(social,/friendModeRegisteredOnly/);
});
