import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyLearnDecision,
  captureLearnActionSnapshot,
  learnQueue,
  learningSessionPayload,
  learningSessionSummary,
  restoreLearnActionSnapshot,
  splitMeaningGroups,
  undoLearnDecision,
} from '../packages/alantil-core/learning.js';

function state() {
  return {
    source: 'station', ids: ['w1', 'w2'], index: 0, repeatIds: [], entries: {}, direction: 'alan_ru', undo: null, undo_count: 0,
  };
}

test('learning decisions repeat unknown words until they are known', () => {
  let current = state();
  current = applyLearnDecision(current, 'w1', false);
  assert.deepEqual(learnQueue(current), ['w2', 'w1']);
  current = applyLearnDecision(current, 'w2', true);
  assert.deepEqual(learnQueue(current), ['w1']);
  current = applyLearnDecision(current, 'w1', true);
  assert.deepEqual(learnQueue(current), []);
  assert.equal(current.entries.w1.show_count, 2);
  assert.equal(current.entries.w1.left_swipe_count, 1);
  assert.equal(current.entries.w1.final_result, 'known');
});

test('learning undo restores queue and counters without losing undo count', () => {
  const decided = applyLearnDecision(state(), 'w1', false);
  const restored = undoLearnDecision(decided);
  assert.ok(restored);
  assert.equal(restored.index, 0);
  assert.deepEqual(restored.repeatIds, []);
  assert.deepEqual(restored.entries, {});
  assert.equal(restored.undo_count, 1);
});

test('web action snapshot contract remains reversible in shared core', () => {
  const webState = {
    mainQueue: [{ id: '1' }], repeatQueue: [{ id: '2' }], round: 'main', currentStudyId: '1', sessionFailMap: { 1: 2 }, analyticsActions: [{ id: 1 }],
    studySession: { progressData: { known: 2 }, wordStats: { 1: { show_count: 1 } } },
  };
  const snapshot = captureLearnActionSnapshot(webState);
  webState.mainQueue = [];
  webState.studySession.progressData.known = 9;
  restoreLearnActionSnapshot(webState, snapshot);
  assert.equal(webState.mainQueue[0].id, '1');
  assert.equal(webState.studySession.progressData.known, 2);
});

test('learning result and payload calculations are shared and deterministic', () => {
  const entries = {
    w1: { word_id: 'w1', show_count: 2, left_swipe_count: 1, final_result: 'known', first_position: 1 },
    w2: { word_id: 'w2', show_count: 1, left_swipe_count: 0, final_result: 'known', first_position: 2 },
  };
  const summary = learningSessionSummary(entries, [{ id: 'w1', word: 'A' }, { id: 'w2', word: 'B' }]);
  assert.equal(summary.studiedTotal, 2);
  assert.equal(summary.unknownTotal, 1);
  assert.equal(summary.leftSwipesTotal, 1);
  assert.equal(summary.problemWords[0].id, 'w1');
  const payload = learningSessionPayload({ ...state(), ids: ['w1', 'w2'], entries, undo_count: 1 }, { dictionaryId: 'd', sectionId: 's', setId: 'x' });
  assert.equal(payload.questions_planned, undefined);
  assert.equal(payload.words_planned, 2);
  assert.equal(payload.card_shows_total, 3);
  assert.equal(payload.known_words_total, 2);
  assert.equal(payload.undo_count, 1);
});

test('meaning grouping follows the existing card contract', () => {
  assert.deepEqual(splitMeaningGroups('1. Один; 2. Два\n3. Три'), ['Один', 'Два', 'Три']);
});
