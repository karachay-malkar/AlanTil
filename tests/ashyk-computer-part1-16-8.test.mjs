import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DIFFICULTIES, ONLINE_RULES } from '../packages/ashyk-game/constants.js';
import { ashykAccessForUser } from '../packages/alantil-core/ashyk-access.js';

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('guest can enter Ashyk computer mode but not multiplayer',()=>{
  const guest=ashykAccessForUser('');
  assert.equal(guest.locked,false);
  assert.deepEqual([...guest.modes],['computer']);
  const registered=ashykAccessForUser('user-1');
  assert.ok(registered.modes.includes('computer'));
  assert.ok(registered.modes.includes('online'));
  const bootstrap=read('src/app/bootstrap.js');
  assert.match(bootstrap,/!isAshykModeAllowed\('online',\{userId\}\)/);
});

test('all Ashyk modes use 20 seconds per shot and 15 seconds per answer',()=>{
  for(const level of Object.values(DIFFICULTIES)){
    assert.equal(level.humanShotSeconds,20,level.id);
    assert.equal(level.humanQuestionSeconds,15,level.id);
  }
  assert.deepEqual(ONLINE_RULES,{humanShotSeconds:20,humanQuestionSeconds:15});
});

test('difficulty changes computer accuracy only',()=>{
  assert.deepEqual(
    Object.values(DIFFICULTIES).map(({computerShotAccuracy,computerAnswerAccuracy})=>[computerShotAccuracy,computerAnswerAccuracy]),
    [[.70,.50],[.85,.70],[1,1]],
  );
  const timing=Object.values(DIFFICULTIES).map(({humanShotSeconds,humanQuestionSeconds})=>[humanShotSeconds,humanQuestionSeconds]);
  assert.deepEqual(new Set(timing.map(JSON.stringify)).size,1);
});

test('Web setup reserves a live difficulty explanation and shared segmented style is high contrast',()=>{
  const game=read('packages/ashyk-game/web/Game.jsx');
  const css=read('src/shared/styles/segmented-control.css');
  assert.match(game,/ashykDifficultyHint/);
  assert.match(game,/difficultyDescription\(/);
  assert.match(css,/input:checked\+.*box-shadow:/s);
  assert.match(css,/var\(--line-strong\)/);
});

test('Mobile Ashyk uses the shared segmented control and reserves difficulty explanation space',()=>{
  const screen=read('mobile/screens/ashyk.js');
  const components=read('mobile/ui/components.js');
  assert.match(screen,/SegmentedControl.*from['"]\.\.\/ui\/components\.js['"]/);
  assert.doesNotMatch(screen,/function SegmentedControl\(/);
  assert.match(screen,/difficultyHint/);
  assert.match(components,/segmentedItemActive/);
  assert.match(components,/C\.lineStrong/);
});

test('latest online timer migration enforces 20-second shots and 15-second answers',()=>{
  const sql=read('supabase/migrations/20261001045947_alantil_16_8_ashyk_part4_server_alignment.sql');
  assert.match(sql,/p_phase='bonus-question'\s+then 15\s+else 20/);
});
