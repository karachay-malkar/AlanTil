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
} from '../src/mobile/sync-policy.ts';

test('word progress merge never reduces counters or mastery', () => {
  const older = {
    word_id: 'w1',
    sessions_total: 8,
    known_count: 5,
    mastery_status: 'mastered',
    mastered_at: '2026-01-02T00:00:00.000Z',
    last_seen_at: '2026-01-03T00:00:00.000Z',
    last_mode: 'learn',
  };
  const newer = {
    word_id: 'w1',
    sessions_total: 3,
    known_count: 7,
    test_correct_total: 9,
    mastery_status: 'review',
    mastered_at: '2026-01-01T00:00:00.000Z',
    last_seen_at: '2026-01-04T00:00:00.000Z',
    last_mode: 'test',
  };
  const [merged] = mergeWordProgressRows([older], [newer]);
  assert.equal(merged.sessions_total, 8);
  assert.equal(merged.known_count, 7);
  assert.equal(merged.test_correct_total, 9);
  assert.equal(merged.mastery_status, 'review');
  assert.equal(merged.mastered_at, '2026-01-01T00:00:00.000Z');
  assert.equal(merged.last_mode, 'test');
});

test('equal last-seen timestamps keep the established result', () => {
  const timestamp = '2026-01-04T00:00:00.000Z';
  const [merged] = mergeWordProgressRows(
    [{ word_id: 'w1', last_seen_at: timestamp, last_mode: 'learn', last_result: 'known' }],
    [{ word_id: 'w1', last_seen_at: timestamp, last_mode: 'test', last_result: 'wrong' }],
  );
  assert.equal(merged.last_mode, 'learn');
  assert.equal(merged.last_result, 'known');
});

test('latest-row merge uses timestamps and keeps the first row on a tie', () => {
  const key = (row) => String(row.id);
  const rows = mergeLatestRows([
    [{ id: 'same', value: 'account', updated_at: '2026-01-02T00:00:00.000Z' }],
    [
      { id: 'same', value: 'guest-tie', updated_at: '2026-01-02T00:00:00.000Z' },
      { id: 'newer', value: 'guest', updated_at: '2026-01-03T00:00:00.000Z' },
    ],
  ], key);
  assert.equal(rows.find((row) => row.id === 'same')?.value, 'account');
  assert.equal(rows.find((row) => row.id === 'newer')?.value, 'guest');
});

test('guest settings cannot replace an account value without a newer timestamp', () => {
  const account = { updated_at: '2026-02-02T00:00:00.000Z' };
  assert.equal(preferredSettingsSource(account, { updated_at: '2026-02-01T00:00:00.000Z' }), 'account');
  assert.equal(preferredSettingsSource(account, { updated_at: '2026-02-03T00:00:00.000Z' }), 'guest');
  assert.equal(preferredSettingsSource(account, { interface_language_code: 'en' }), 'account');
  assert.equal(preferredSettingsSource(null, { interface_language_code: 'en' }), 'guest');
});

test('remote state supersedes only missing or older local state', () => {
  const remote = { updated_at: '2026-03-02T00:00:00.000Z' };
  assert.equal(remoteSupersedes({ updated_at: '2026-03-01T00:00:00.000Z' }, remote), true);
  assert.equal(remoteSupersedes({}, remote), true);
  assert.equal(remoteSupersedes({ updated_at: '2026-03-03T00:00:00.000Z' }, remote), false);
});

test('retry delay grows exponentially and is capped', () => {
  assert.equal(retryDelayMs(1), 5_000);
  assert.equal(retryDelayMs(2), 10_000);
  assert.equal(retryDelayMs(99), 15 * 60_000);
});

test('queue selection respects retry time and revision replacement', () => {
  const now = Date.parse('2026-04-01T00:00:00.000Z');
  const waiting = { id: 'same', revision: 'r1', next_attempt_at: '2026-04-01T00:01:00.000Z' };
  const ready = { id: 'ready', revision: 'r2' };
  assert.equal(nextReadyEntry([waiting, ready], new Set(), now)?.id, 'ready');
  assert.equal(nextReadyEntry([waiting], new Set(), now), undefined);
  assert.equal(nextReadyEntry([waiting], new Set(), now, true)?.id, 'same');
  assert.equal(nextReadyEntry([{ ...waiting, revision: 'r3' }], new Set([entryRevision(waiting)]), now, true)?.revision, 'r3');
});
