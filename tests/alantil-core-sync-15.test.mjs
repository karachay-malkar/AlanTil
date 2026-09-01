import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildActiveHiddenWordMap,
  claimableFavoriteIds,
  claimableHiddenWordMap,
  claimableRows,
  entryRevision,
  hiddenWordKey,
  mergeActivityHistoryRows,
  mergeFavoriteIds,
  mergeHiddenWordMaps,
  mergeLatestRows,
  mergeWordProgressRows,
  nextReadyEntry,
  preferredSettingsSource,
  remoteSupersedes,
  retryDelayMs,
  setProgressKey,
  stationProgressKey,
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

test('sync keys are stable across platform adapters', () => {
  assert.equal(stationProgressKey({ dictionary_id: 'd', catalog_id: 'd', group_id: 's', set_id: 'x' }), 'd::d::s::x');
  assert.equal(setProgressKey({ dictionary_id: 'd', section_id: 's', set_id: 'x' }), 'd::s::x');
  assert.equal(hiddenWordKey({ dictionary_id: 'd', section_id: 's', set_id: 'x', word_id: 'w' }), 'd::s::x::w');
});

test('favorite and hidden cache merges are unique and deterministic', () => {
  assert.deepEqual(mergeFavoriteIds([' a ', 'b'], ['b', 'c', '']), ['a', 'b', 'c']);
  assert.deepEqual(mergeHiddenWordMaps(
    { 'd::s::x': ['w1', 'w2'] },
    { 'd::s::x': ['w2', 'w3'], 'd::s::y': ['w4'] },
  ), {
    'd::s::x': ['w1', 'w2', 'w3'],
    'd::s::y': ['w4'],
  });
  assert.deepEqual(buildActiveHiddenWordMap([
    { dictionary_id: 'd', section_id: 's', set_id: 'x', word_id: 'w1', is_hidden: true },
    { dictionary_id: 'd', section_id: 's', set_id: 'x', word_id: 'w2', is_hidden: false },
  ]), { 'd::s::x': ['w1'] });
});

test('activity history merge preserves local overlay and recency order', () => {
  const merged = mergeActivityHistoryRows(
    [{ id: 'a', type: 'test', correct_total: 4, ended_at: '2026-08-01T10:00:00Z' }],
    [{ id: 'a', exit_reason: 'completed' }, { id: 'b', type: 'learn', ended_at: '2026-08-02T10:00:00Z' }],
  );
  assert.deepEqual(merged.map((row) => row.id), ['b', 'a']);
  assert.equal(merged[1].correct_total, 4);
  assert.equal(merged[1].exit_reason, 'completed');
});

test('guest claim keeps only values not superseded by account cloud state', () => {
  const localSets = [
    { dictionary_id: 'd', section_id: 's', set_id: 'x', updated_at: '2026-08-03T00:00:00Z' },
    { dictionary_id: 'd', section_id: 's', set_id: 'y', updated_at: '2026-08-01T00:00:00Z' },
  ];
  const remoteSets = [
    { dictionary_id: 'd', section_id: 's', set_id: 'x', updated_at: '2026-08-02T00:00:00Z' },
    { dictionary_id: 'd', section_id: 's', set_id: 'y', updated_at: '2026-08-04T00:00:00Z' },
  ];
  assert.deepEqual(claimableRows(localSets, remoteSets, setProgressKey).map((row) => row.set_id), ['x']);
  assert.deepEqual(claimableFavoriteIds(['w1', 'w2'], [
    { word_id: 'w2', is_active: true },
    { word_id: 'w3', is_active: true },
  ], 'word_id'), ['w1']);
  assert.deepEqual(claimableHiddenWordMap(
    { 'd::s::x': ['w1', 'w2'] },
    [{ dictionary_id: 'd', section_id: 's', set_id: 'x', word_id: 'w2', is_hidden: true }],
  ), { 'd::s::x': ['w1'] });
});

test('retry policy is bounded and does not retry the same revision twice per flush', () => {
  assert.equal(retryDelayMs(1), 5_000);
  assert.equal(retryDelayMs(99), 15 * 60_000);
  const entry = { id: 'x', revision: 'r1', next_attempt_at: '2026-08-01T00:00:00Z' };
  assert.equal(entryRevision(entry), 'r1');
  assert.equal(nextReadyEntry([entry], new Set(), Date.parse('2026-08-02T00:00:00Z')), entry);
  assert.equal(nextReadyEntry([entry], new Set(['r1']), Date.parse('2026-08-02T00:00:00Z')), undefined);
});
