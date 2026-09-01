import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Web word domain modules are thin core adapters', async () => {
  for (const path of ['src/shared/domain/word-selection.js', 'src/shared/domain/word-normalizer.js', 'src/shared/domain/slugs.js', 'src/shared/domain/example-groups.js', 'src/shared/domain/learning-route.js']) {
    const source = await read(path);
    assert.match(source, /packages\/alantil-core/);
  }
});

test('Web Test delegates business decisions to core', async () => {
  const source = await read('src/features/test/engine.js');
  for (const symbol of ['initializeTestState', 'buildTestOptions', 'applyTestAnswer', 'testSessionPayload', 'testCompletionSummary']) assert.match(source, new RegExp(symbol));
  assert.doesNotMatch(source, /function\s+pickOptions[\s\S]*normalizePos/);
});

test('Web Match delegates mutations to core', async () => {
  const source = await read('src/features/match/engine.js');
  for (const symbol of ['initializeMatchState', 'takeNextMatchRound', 'markMatchSolved', 'recordMatchMismatch', 'matchSessionPayload']) assert.match(source, new RegExp(symbol));
  assert.doesNotMatch(source, /failMap\[[^\]]+\]\s*=/);
  assert.doesNotMatch(source, /errorPairs\[[^\]]+\]\s*=/);
});

test('Web Learn delegates queues decisions undo and results to core', async () => {
  const [study, results, history] = await Promise.all([
    read('src/features/learn/study.js'),
    read('src/features/learn/results.js'),
    read('src/features/learn/action-history.js'),
  ]);
  for (const symbol of ['initializeLearnState', 'exposeCurrentLearnCard', 'decideLearnCard', 'undoLearnDecision', 'learnSessionPayload']) assert.match(study, new RegExp(symbol));
  assert.match(results, /buildLearnResultSummary/);
  assert.match(history, /packages\/alantil-core\/learning\.js/);
});

test('Web progress and settings keep platform IO outside core', async () => {
  const [station, words, settings, route] = await Promise.all([
    read('src/shared/progress/station-progress-store.js'),
    read('src/shared/progress/word-progress-store.js'),
    read('src/shared/settings/user-settings-store.js'),
    read('src/shared/domain/route-progress.js'),
  ]);
  assert.match(station, /packages\/alantil-core\/progress\.js/);
  assert.match(words, /packages\/alantil-core\/word-progress\.js/);
  assert.match(settings, /packages\/alantil-core\/settings\.js/);
  assert.match(route, /packages\/alantil-core\/route-progress\.js/);
});

test('Web Station Test delegates selection session and result rules to core', async () => {
  const source = await read('src/features/path/station-test.js');
  for (const symbol of ['stationTestDistractors', 'buildStationTestSessionState', 'applyStationTestAnswer', 'stationTestPayload', 'stationTestResult']) assert.match(source, new RegExp(symbol));
  assert.doesNotMatch(source, /function\s+isAmbiguous/);
  assert.doesNotMatch(source, /function\s+buildQuestion/);
});
