import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterFavoriteItems,
  mergeFavoriteStates,
  normalizeFavoriteIds,
  setFavoriteActive,
  toggleFavorite,
} from '../packages/alantil-core/favorites.js';
import {
  buildProfileStatistics,
  buildProblemWordRows,
  summarizeActivityHistory,
} from '../packages/alantil-core/statistics.js';

test('15.0 favorites use one normalized mutation contract', () => {
  assert.deepEqual(normalizeFavoriteIds([' a ', 'a', '', 'б']), ['a', 'б']);
  const added = setFavoriteActive(['a'], ' b ', true);
  assert.deepEqual(added, { ids: ['a', 'b'], active: true, changed: true });
  const toggled = toggleFavorite(added.ids, 'a');
  assert.deepEqual(toggled, { ids: ['b'], active: false, changed: true });
  assert.deepEqual(filterFavoriteItems([{ id: 'a' }, { id: 'b' }], toggled.ids), [{ id: 'b' }]);
});

test('15.0 favorite merge keeps the newest active state', () => {
  const local = [{ word_id: 'a', is_active: true, updated_at: '2026-09-01T10:00:00Z' }];
  const remote = [
    { word_id: 'a', is_active: false, updated_at: '2026-09-01T11:00:00Z' },
    { word_id: 'b', is_active: true, updated_at: '2026-09-01T11:00:00Z' },
  ];
  assert.deepEqual(mergeFavoriteStates(local, remote), ['b']);
});

test('15.0 activity summary matches the website statistics contract', () => {
  const rows = [
    { id: 'l1', type: 'learn', status: 'completed', active_duration_sec: 60, left_swipes_total: 1, words: [{ word_id: 'w1', left_swipe_count: 1 }] },
    { id: 't1', type: 'test', status: 'completed', active_duration_sec: 30, correct_total: 8, wrong_total: 2, words: [{ word_id: 'w2', result: 'wrong' }] },
  ];
  const summary = summarizeActivityHistory(rows);
  assert.equal(summary.sessionsTotal, 2);
  assert.equal(summary.learnSessions, 1);
  assert.equal(summary.testAttempts, 1);
  assert.equal(summary.sessionsCompleted, 2);
  assert.equal(summary.activeSeconds, 90);
  assert.equal(summary.accuracy, 80);
  assert.deepEqual(summary.problemWordIds, ['w1', 'w2']);
});

test('15.0 profile statistics use website mastery and problem-word rules', () => {
  const words = [
    { word_id: 'w1', story_id: 'oblivion', dictionary_id: 'beginner' },
    { word_id: 'w2', story_id: 'oblivion', dictionary_id: 'beginner' },
  ];
  const progress = [
    { word_id: 'w1', mastery_status: 'mastered', study_shown_count: 10, unknown_count: 2, test_wrong_count: 1 },
    { word_id: 'w2', mastery_status: 'review', study_shown_count: 5, unknown_count: 0, test_wrong_count: 0 },
  ];
  const history = [{ type: 'learn', status: 'completed', active_duration_sec: 120 }];
  const stats = buildProfileStatistics(words, progress, history);
  assert.equal(stats.masteredWords, 2);
  assert.equal(stats.completedDictionaries, 1);
  assert.equal(stats.reviewWords, 1);
  assert.equal(stats.activeSeconds, 120);
  assert.equal(stats.learnSessions, 1);
  assert.equal(stats.problemWords[0].word.word_id, 'w1');
  assert.equal(stats.problemWords[0].shows, 10);
  assert.equal(stats.problemWords[0].errors, 3);
  assert.equal(stats.problemWords[0].difficulty, 20);
  assert.deepEqual(buildProblemWordRows(words, progress, 12).map((entry) => entry.word.word_id), ['w1']);
});
