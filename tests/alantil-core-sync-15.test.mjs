import assert from 'node:assert/strict';
import test from 'node:test';

import {
  entryRevision,
  mergeLatestRows,
  mergeWordProgressRows,
  nextReadyEntry,
  preferredSettingsSource,
  remoteSupersedes,
  retryDelayMs,
} from '../packages/alantil-core/sync-policy.js';

test('word progress merge keeps strongest counters and status', () => {
  const [row] = mergeWordProgressRows(
    [{ word_id: 'w1', mastery_status: 'learning', test_correct_count: 3, updated_at: '2026-08-01T00:00:00Z' }],
    [{ word_id: 'w1', mastery_status: 'review', test_correct_count: 2, test_wrong_count: 4, updated_at: '2026-08-02T00:00:00Z' }],
  );
  assert.equal(row.word_id, 'w1');
  assert.equal(row.mastery_status, 'review');
  assert.equal(row.test_correct_count, 3);
  assert.equal(row.test_wrong_count, 4);
  assert.equal(row.updated_at, '2026-08-02T00:00:00Z');
});

test('latest-row merge and settings preference use updated_at deterministically', () => {
  const rows = mergeLatestRows([
    [{ id: 'a', updated_at: '2026-08-01T00:00:00Z' }],
    [{ id: 'a', updated_at: '2026-08-02T00:00:00Z' }],
  ], (row) => String(row.id));
  assert.equal(rows[0].updated_at, '2026-08-02T00:00:00Z');
  assert.equal(preferredSettingsSource(
    { updated_at: '2026-08-01T00:00:00Z' },
    { updated_at: '2026-08-02T00:00:00Z' },
  ), 'guest');
  assert.equal(remoteSupersedes(
    { updated_at: '2026-08-01T00:00:00Z' },
    { updated_at: '2026-08-02T00:00:00Z' },
  ), true);
});

test('retry policy is bounded and does not retry the same revision twice per flush', () => {
  assert.equal(retryDelayMs(1), 5_000);
  assert.equal(retryDelayMs(99), 15 * 60_000);
  const entry = { id: 'x', revision: 'r1', next_attempt_at: '2026-08-01T00:00:00Z' };
  assert.equal(entryRevision(entry), 'r1');
  assert.equal(nextReadyEntry([entry], new Set(), Date.parse('2026-08-02T00:00:00Z')), entry);
  assert.equal(nextReadyEntry([entry], new Set(['r1']), Date.parse('2026-08-02T00:00:00Z')), undefined);
});
