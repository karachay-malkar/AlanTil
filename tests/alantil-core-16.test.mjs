import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWordsByPOSRounds } from '../packages/alantil-core/word-selection.js';
import { buildTestOptions, initializeTestState, applyTestAnswer, testSessionPayload } from '../packages/alantil-core/test.js';
import { initializeMatchState, markMatchSolved, recordMatchMismatch, matchSessionPayload } from '../packages/alantil-core/match.js';
import { initializeLearnState, exposeCurrentLearnCard, decideLearnCard, undoLearnDecision, learnSessionPayload } from '../packages/alantil-core/learning.js';
import { recordStationTestProgress, transitionStationCardsCompleted, transitionStationStarted } from '../packages/alantil-core/progress.js';
import { normalizeUserSettings, isLearningSetupDraftComplete } from '../packages/alantil-core/settings.js';

function word(id, pos = 'noun', trans = `t${id}`) {
  return { id: String(id), word: `w${id}`, trans, pos, synonyms: [], dictionary_id: 'd', section_id: 's', set_id: 'set' };
}

function learnState() {
  return {
    currentDict: 'd', currentSection: 's', currentSet: 'set', currentStudyMode: 'kb',
    mainQueue: [], repeatQueue: [], round: 'main', totalPlanned: 0, currentStudyId: '',
    swipeHistory: [], analyticsActions: [], analyticsFlushed: false, sessionFailMap: {},
    studySession: { inProgress: false, completed: false, wordsPool: [], progressData: {}, wordStats: {}, metadata: {} },
  };
}

test('16.0 word selection preserves frozen Web 13.15.12 conflict behavior', () => {
  const pool = [word(1, 'noun', 'same'), word(2, 'noun', 'same'), word(3, 'verb'), word(4, 'verb')];
  const built = buildWordsByPOSRounds(pool, 20);
  assert.ok(built.items.length <= pool.length);
  assert.ok(Array.isArray(built.rounds));
});

test('16.0 test state and answer payload use shared core', () => {
  const state = { session: {} };
  const pool = Array.from({ length: 20 }, (_, i) => word(i + 1));
  initializeTestState(state, pool, 'kb', 20, {}, pool);
  const options = buildTestOptions(state, state.items[0]);
  assert.ok(options.length >= 1 && options.length <= 4);
  const correct = options.find((entry) => entry.id === state.items[0].id);
  assert.ok(correct);
  assert.ok(applyTestAnswer(state, correct));
  assert.equal(testSessionPayload(state).questions_answered, 1);
});

test('16.0 match mutations and payload are shared', () => {
  const state = { session: {} };
  const pool = Array.from({ length: 10 }, (_, i) => word(i + 1));
  initializeMatchState(state, pool, 20, {});
  state.shown.add('1'); state.shown.add('2');
  assert.equal(markMatchSolved(state, '1'), '1');
  recordMatchMismatch(state, '2', '3');
  const payload = matchSessionPayload(state);
  assert.equal(payload.errors_total, 1);
  assert.ok(payload.words.some((row) => row.word_id === '1' && row.matched));
});

test('16.0 learn decision and undo preserve Web queue semantics', () => {
  const state = learnState();
  initializeLearnState(state, [word(1), word(2)], 'kb');
  const first = exposeCurrentLearnCard(state);
  assert.ok(first.item);
  const firstId = first.item.id;
  decideLearnCard(state, false, { word_id: firstId });
  assert.equal(state.studySession.progressData.unknown, 1);
  assert.ok(state.repeatQueue.some((item) => item.id === firstId));
  assert.ok(undoLearnDecision(state));
  assert.equal(state.studySession.progressData.undo, 1);
  assert.equal(learnSessionPayload(state).left_swipes_total, 0);
});

test('16.0 station lifecycle preserves frozen Web review schedule', () => {
  const base = { dictionary_id: 'd', group_id: 's', set_id: 'set', story_type: 'story', status: 'available' };
  const started = transitionStationStarted(base, '2026-01-01T00:00:00.000Z');
  assert.equal(started.changed, true);
  assert.equal(started.row.status, 'studying');
  const ready = transitionStationCardsCompleted(started.row, '2026-01-01T00:01:00.000Z');
  assert.equal(ready.row.status, 'test_ready');
  const tested = recordStationTestProgress(ready.row, { accuracy: 80, passed: true, phase: 'first_test', completedAt: '2026-01-01T00:02:00.000Z' });
  assert.equal(tested.status, 'review_1_waiting');
  assert.equal(tested.review_1_due_at, '2026-01-02T00:02:00.000Z');
});

test('16.0 settings preserve Web normalization', () => {
  const settings = normalizeUserSettings({ interface_language_code: 'tu', alan_script_code: 'turkic', alan_dialect_code: 'balkar', text_size_code: 'large' });
  assert.equal(settings.interface_language_code, 'tr');
  assert.equal(settings.translation_language_code, 'tr');
  assert.equal(settings.alan_script_code, 'turkic');
  assert.equal(settings.text_size_code, 'large');
  assert.equal(isLearningSetupDraftComplete({ interface_language_code: 'ru', alan_script_code: 'cyrillic', alan_dialect_code: 'karachay' }), true);
});
