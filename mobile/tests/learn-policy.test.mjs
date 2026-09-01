import assert from 'node:assert/strict';
import test from 'node:test';

import { applyLearnDecision, learnQueue, splitMeaningGroups, undoLearnDecision } from '../src/mobile/learn/policy.ts';

function state(ids = ['a', 'b']) {
  return { source: 'station', ids, index: 0, repeatIds: [], entries: {}, direction: 'alan_ru' };
}

test('unknown words move to the repeat queue and known words leave it', () => {
  const first = applyLearnDecision(state(), 'a', false);
  assert.deepEqual(learnQueue(first), ['b', 'a']);
  const second = applyLearnDecision(first, 'b', true);
  assert.deepEqual(learnQueue(second), ['a']);
  const third = applyLearnDecision(second, 'a', true);
  assert.deepEqual(learnQueue(third), []);
  assert.equal(third.entries.a.show_count, 2);
  assert.equal(third.entries.a.left_swipe_count, 1);
  assert.equal(third.entries.a.final_result, 'known');
});

test('undo restores the exact queue and counters from before the last decision', () => {
  const before = state(['a']);
  const decided = applyLearnDecision(before, 'a', false);
  const restored = undoLearnDecision(decided);
  assert.ok(restored);
  assert.deepEqual(learnQueue(restored), ['a']);
  assert.deepEqual(restored.entries, {});
  assert.equal(restored.undo_count, 1);
  assert.equal(restored.undo, null);
});

test('translation groups accept semicolons, new lines and numbered values', () => {
  assert.deepEqual(splitMeaningGroups('1. один; 2) два\n3 — три'), ['один', 'два', 'три']);
});
