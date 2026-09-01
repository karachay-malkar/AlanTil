import assert from 'node:assert/strict';
import test from 'node:test';

import { masteryMark, stationProblemWords, stationTestSummaries } from '../src/mobile/station-statistics.ts';

test('station summaries include matching completed tests and keep the newest first', () => {
  const history = [
    { id: 'old', type: 'station_test', status: 'completed', ended_at: '2026-01-01T00:00:00Z', words: [{ word_id: 'a', result: 'correct' }, { word_id: 'b', result: 'wrong' }] },
    { id: 'new', type: 'test', status: 'completed', ended_at: '2026-01-02T00:00:00Z', words: [{ word_id: 'a', result: 'correct' }] },
    { id: 'skip', type: 'station_test', status: 'interrupted', ended_at: '2026-01-03T00:00:00Z', words: [{ word_id: 'a', result: 'wrong' }] },
  ];
  const summaries = stationTestSummaries(history, ['a', 'b']);
  assert.deepEqual(summaries.map((row) => [row.id, row.percent]), [['new', 100], ['old', 50]]);
});

test('mastery signs follow the 80, 90 and 100 percent thresholds', () => {
  assert.equal(masteryMark(79).level, 0);
  assert.equal(masteryMark(80).label, 'I знак');
  assert.equal(masteryMark(90).label, 'II знак');
  assert.equal(masteryMark(100).label, 'III знак');
});

test('problem words combine learning and test errors and cap the result', () => {
  const words = [{ word_id: 'a' }, { word_id: 'b' }, { word_id: 'c' }];
  const rows = [
    { word_id: 'a', study_shown_count: 5, unknown_count: 2 },
    { word_id: 'b', learn_shows_total: 2, learn_left_swipes_total: 2 },
    { word_id: 'c', test_correct_total: 9, test_wrong_total: 1 },
  ];
  const problems = stationProblemWords(words, rows, 2);
  assert.deepEqual(problems.map((row) => row.word.word_id), ['b', 'a']);
  assert.equal(problems[0].difficulty, 100);
  assert.equal(problems.length, 2);
});
