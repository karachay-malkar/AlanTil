import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('Web station test participates in the existing router leave contract',()=>{
  const pathFeature=read('src/features/path/index.js');
  assert.match(pathFeature,/let activeStationTest = null/);
  assert.match(pathFeature,/export function canLeave\(\)/);
  assert.match(pathFeature,/stationTestInProgress\(\)/);
  assert.match(pathFeature,/export function getLeaveMessage\(\)/);
  assert.match(pathFeature,/vy_tochno_hotite_vyyti_popytka_budet_sbrosena/);
  assert.match(pathFeature,/discardStationTestSession\(activeStationTest\)/);
});

test('Web station test is ephemeral and cannot resume an interrupted attempt',()=>{
  const source=read('src/features/path/station-test.js');
  assert.match(source,/interrupted: null/);
  assert.match(source,/removeScopedValue\(LEGACY_ACTIVE_KEY\)/);
  assert.doesNotMatch(source,/getInterruptedStationTest/);
  assert.doesNotMatch(source,/stationTestActiveSnapshot/);
  assert.doesNotMatch(source,/writeScopedJson/);
});

test('Mobile station test discards stale snapshots and uses the same confirmation phrase model',()=>{
  const screen=read('mobile/screens/station-test.js');
  const exit=read('mobile/ui/session-exit.js');
  assert.match(screen,/clearNativeSessionSnapshot\('station-test'\)/);
  assert.match(screen,/beforeLeave:\(\)=>clearNativeSessionSnapshot\('station-test'\)/);
  assert.match(screen,/vy_tochno_hotite_vyyti_popytka_budet_sbrosena/);
  assert.doesNotMatch(screen,/loadNativeSessionSnapshot/);
  assert.doesNotMatch(screen,/saveNativeSessionSnapshot/);
  assert.doesNotMatch(screen,/stationTestActiveSnapshot/);
  assert.match(exit,/getDisplayedSessionExitPhrase\(settings\)/);
});

test('discard confirmation copy states that the current attempt is reset',()=>{
  const messages=read('src/shared/i18n/messages.js');
  assert.match(messages,/Текущая попытка будет сброшена/);
  assert.match(messages,/The current attempt will be reset/);
  assert.match(messages,/Mevcut deneme sıfırlanacak/);
});
