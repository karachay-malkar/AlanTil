import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalStationStatus,
  createStationProgressRow,
  effectiveStationStatus,
  markStationCardsCompletedProgress,
  markStationStartedProgress,
  recordStationTestProgress,
  stationTestPhaseFromProgress,
  summarizeWordProgress,
} from '../packages/alantil-core/progress.js';

const station = {
  storyId: 'oblivion',
  dictionaryId: 'beginner',
  sectionId: 'beginner-starter',
  setId: 'beginner-01',
};

const startedAt = '2026-09-01T10:00:00.000Z';

test('15.0 shared station lifecycle uses the website review sequence', () => {
  const empty = createStationProgressRow(station, startedAt);
  assert.equal(canonicalStationStatus(empty), 'not_started');

  const started = markStationStartedProgress(empty, startedAt);
  assert.equal(started.status, 'studying');
  assert.equal(started.study_sessions_total, 1);
  assert.equal(canonicalStationStatus(started), 'learning');

  const ready = markStationCardsCompletedProgress(started, startedAt);
  assert.equal(ready.status, 'test_ready');
  assert.equal(stationTestPhaseFromProgress(ready), 'first_test');

  const first = recordStationTestProgress(ready, {
    accuracy: 90,
    passed: true,
    phase: 'first_test',
    completedAt: startedAt,
  });
  assert.equal(first.status, 'review_1_waiting');
  assert.equal(first.review_1_due_at, '2026-09-02T10:00:00.000Z');
  assert.equal(canonicalStationStatus(first, Date.parse('2026-09-01T11:00:00.000Z')), 'review');
  assert.equal(effectiveStationStatus(first, Date.parse('2026-09-02T10:00:00.000Z')), 'review_1_due');
  assert.equal(stationTestPhaseFromProgress(first, Date.parse('2026-09-02T10:00:00.000Z')), 'review_1');

  const review1 = recordStationTestProgress(first, {
    accuracy: 95,
    passed: true,
    phase: 'review_1',
    completedAt: '2026-09-02T10:00:00.000Z',
  });
  assert.equal(review1.status, 'review_2_waiting');
  assert.equal(review1.review_2_due_at, '2026-09-05T10:00:00.000Z');

  const mastered = recordStationTestProgress(review1, {
    accuracy: 100,
    passed: true,
    phase: 'review_2',
    completedAt: '2026-09-05T10:00:00.000Z',
  });
  assert.equal(mastered.status, 'mastered');
  assert.equal(mastered.mastered_at, '2026-09-05T10:00:00.000Z');
  assert.equal(canonicalStationStatus(mastered), 'mastered');
});

test('15.0 failed tests do not advance review phases', () => {
  const ready = markStationCardsCompletedProgress(createStationProgressRow(station, startedAt), startedAt);
  const failed = recordStationTestProgress(ready, {
    accuracy: 70,
    passed: false,
    phase: 'first_test',
    completedAt: startedAt,
  });
  assert.equal(failed.status, 'test_ready');
  assert.equal(failed.test_attempts_total, 1);
  assert.equal(failed.best_accuracy, 70);
  assert.equal(failed.first_test_completed_at, null);
});

test('15.0 word progress summaries treat review words as mastered progress', () => {
  const words = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];
  const map = new Map([
    ['1', { mastery_status: 'mastered' }],
    ['2', { mastery_status: 'review' }],
    ['3', { mastery_status: 'learning' }],
  ]);
  assert.deepEqual(summarizeWordProgress(words, map), {
    total: 4,
    mastered: 2,
    review: 1,
    percent: 50,
  });
});
