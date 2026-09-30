import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ASHYK_FEATURE_FLAGS,ashykAccessForUser,isAshykModeAllowed} from '../packages/alantil-core/ashyk-access.js';

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
