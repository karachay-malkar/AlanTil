import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceMatchRound,
  applyMatchPair,
  buildTestSessionOptions,
  createMatchSessionState,
  createTestSessionState,
  matchSessionPayload,
  restoreMatchSessionState,
  restoreTestSessionState,
  submitTestAnswer,
  testSessionPayload,
} from '../packages/alantil-core/practice-session.js';
import {
  buildStationTestOptions,
  createStationTestState,
  restoreStationTestState,
  stationTestSessionPayload,
  submitStationTestAnswer,
} from '../packages/alantil-core/station-test.js';
import { createLearnState, filterLearnWordsBySelection, learningSessionPayload, restoreLearnState } from '../packages/alantil-core/learning.js';

const words = Array.from({ length: 100 }, (_, index) => ({
  id: `w${index + 1}`,
  word: `alan-${index + 1}`,
  trans: `translation-${index + 1}`,
  pos: ['noun', 'verb', 'adjective', 'adverb'][index % 4],
  dictionary_id: 'beginner',
  section_id: 'section-1',
  set_id: `set-${Math.floor(index / 20) + 1}`,
  global_order: index + 1,
}));

test('shared Test core produces exact 20/40/80 sessions and four unique answers', () => {
  for (const limit of [20, 40, 80]) {
    const state = createTestSessionState({ pool: words, optionPool: words, limit, mode: 'kb' });
    assert.equal(state.items.length, limit);
    for (const item of state.items.slice(0, Math.min(10, state.items.length))) {
      const options = buildTestSessionOptions(state, item, 4);
      assert.equal(options.length, 4);
      assert.equal(new Set(options.map((option) => option.text)).size, 4);
      assert.equal(options.filter((option) => option.id === item.id).length, 1);
    }
  }
});

test('shared Test transition and snapshot restore are client-independent', () => {
  const initial = createTestSessionState({ pool: words, optionPool: words, limit: 20, mode: 'kb' });
  const item = initial.items[0];
  const options = buildTestSessionOptions(initial, item, 4);
  const correct = options.find((option) => option.id === item.id);
  assert.ok(correct);
  const transition = submitTestAnswer(initial, correct);
  assert.ok(transition);
  assert.equal(transition.state.index, 1);
  assert.equal(transition.state.correct, 1);
  const payload = testSessionPayload(transition.state);
  const restored = restoreTestSessionState({ id: 'runtime' }, payload.session_snapshot, words);
  assert.ok(restored);
  assert.equal(restored.index, transition.state.index);
  assert.equal(restored.correct, transition.state.correct);
  assert.deepEqual(restored.results, transition.state.results);
});

test('shared Match transition owns failures, pair errors and round advancement', () => {
  const state = createMatchSessionState({ pool: words, limit: 20 });
  assert.equal(state.items.length, 20);
  const round = state.rounds[0];
  assert.ok(round.length >= 2);
  const wrong = applyMatchPair(state, round[0].id, round[1].id);
  assert.ok(wrong && !wrong.correct);
  assert.equal(wrong.state.errorsCount, 1);
  assert.equal(wrong.state.failMap[round[0].id], 1);
  assert.equal(wrong.state.failMap[round[1].id], 1);
  assert.equal(Object.values(wrong.state.errorPairs)[0].error_count, 1);

  let solvedState = wrong.state;
  for (const word of round) {
    solvedState = applyMatchPair(solvedState, word.id, word.id).state;
  }
  const advanced = advanceMatchRound(solvedState);
  assert.ok(advanced.advanced || advanced.completed);
  const payload = matchSessionPayload(advanced.state);
  const restored = restoreMatchSessionState({ id: 'runtime' }, payload.session_snapshot, words);
  assert.ok(restored);
  assert.equal(restored.errorsCount, advanced.state.errorsCount);
  assert.deepEqual([...restored.solved].sort(), [...advanced.state.solved].sort());
});

test('station Test uses the shared four-option fallback and shared state transitions', () => {
  const item = words[0];
  const options = buildStationTestOptions(item, words, 'alan_ru', 3);
  assert.equal(options.length, 4);
  assert.equal(new Set(options.map((option) => option.text)).size, 4);
  let state = createStationTestState(words.slice(0, 20), 'alan_ru', 'first_test');
  const currentId = state.ids[0];
  const transition = submitStationTestAnswer(state, currentId, currentId);
  assert.ok(transition);
  state = transition.state;
  const payload = stationTestSessionPayload(state, { storyId: 'oblivion', dictionaryId: 'beginner', sectionId: 'section-1', setId: 'set-1' }, 80);
  assert.equal(payload.questions_total, 20);
  assert.equal(payload.questions_answered, 1);
  const restored = restoreStationTestState(state, words.slice(0, 20));
  assert.ok(restored);
  assert.equal(restored.index, 1);
});

test('Learn initialization, filtering, restore and payload live in the shared core', () => {
  const selected = filterLearnWordsBySelection(words.slice(0, 20), 'w1,w2,w3');
  assert.deepEqual(selected.map((word) => word.id), ['w1', 'w2', 'w3']);
  const initial = createLearnState(selected, { source: 'station', direction: 'ru_alan', randomize: false });
  assert.deepEqual(initial.ids, ['w1', 'w2', 'w3']);
  const restored = restoreLearnState(initial, selected, { source: 'station' });
  assert.ok(restored);
  const payload = learningSessionPayload(restored, { dictionaryId: 'beginner', sectionId: 'section-1', setId: 'set-1' });
  assert.equal(payload.words_planned, 3);
  assert.equal(payload.dictionary_id, 'beginner');
});
