import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Mobile Test delegates state, answers, summaries and restore to shared core', async () => {
  const source = await read('src/mobile/practice/test.tsx');
  assert.match(source, /practice-session\.js/);
  for (const symbol of ['createTestSessionState', 'buildTestSessionOptions', 'submitTestAnswer', 'testSessionPayload', 'testSessionSummary', 'restoreTestSessionState', 'restartTestSessionState']) {
    assert.match(source, new RegExp(symbol));
  }
  assert.doesNotMatch(source, /function\s+optionsFor|function\s+sessionPayload|percentage\s*>=\s*100|wrongWordId:\s*isCorrect/);
});

test('Mobile Match delegates pair mutations, round advancement, restore and summary to shared core', async () => {
  const source = await read('src/mobile/practice/match.tsx');
  assert.match(source, /practice-session\.js/);
  for (const symbol of ['createMatchSessionState', 'applyMatchPair', 'advanceMatchRound', 'matchSessionPayload', 'restoreMatchSessionState', 'matchSessionSummary']) {
    assert.match(source, new RegExp(symbol));
  }
  assert.doesNotMatch(source, /failMap\[[^\]]+\]\s*=|errorPairs\[[^\]]+\]\s*=|errorsCount:\s*session\.errorsCount\s*\+\s*1/);
});

test('station test cannot bypass the shared option and session builders', async () => {
  const source = await read('src/mobile/learn/station-test.tsx');
  for (const symbol of ['buildStationTestOptions', 'createStationTestState', 'restoreStationTestState', 'submitStationTestAnswer', 'stationTestSessionPayload']) {
    assert.match(source, new RegExp(symbol));
  }
  assert.doesNotMatch(source, /stationTestDistractors|function\s+optionsFor|shuffle\s*\(\s*\[\s*item/);
});

test('Mobile Learn delegates initialization, selection, restore and payload to shared core', async () => {
  const source = await read('src/mobile/learn/engine.tsx');
  for (const symbol of ['createLearnState', 'filterLearnWordsBySelection', 'restoreLearnState', 'learningSessionPayload']) {
    assert.match(source, new RegExp(symbol));
  }
  assert.doesNotMatch(source, /function\s+shuffled|savedIds\.every|unique_words_shown:\s*entries\.length/);
});

test('Mobile Path is built from the same learning route and route-progress core as Web', async () => {
  const [mobile, webPath, webProgress] = await Promise.all([
    read('src/mobile/path.tsx'),
    read('../src/features/path/feature.js'),
    read('../src/shared/domain/route-progress.js'),
  ]);
  assert.match(mobile, /buildLearningRoute/);
  assert.match(mobile, /routeStationStatus/);
  assert.match(mobile, /summarizeWordProgress/);
  assert.doesNotMatch(mobile, /function\s+buildRoute\s*\(/);
  assert.match(webPath, /buildLearningRoute/);
  assert.match(webProgress, /routeStationStatus/);
  assert.match(webProgress, /allRouteStoryProgress/);
});

test('Web Test and Match use the same shared practice-session core as Mobile', async () => {
  const [testSource, matchSource] = await Promise.all([
    read('../src/features/test/engine.js'),
    read('../src/features/match/engine.js'),
  ]);
  assert.match(testSource, /shared\/domain\/practice-session\.js/);
  assert.match(matchSource, /shared\/domain\/practice-session\.js/);
  assert.match(testSource, /submitTestAnswer/);
  assert.match(matchSource, /applyMatchPair/);
});
