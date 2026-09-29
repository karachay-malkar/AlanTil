import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enqueueProgressEntry,
  mergeProgressQueueEntries,
  removeProgressQueueEntry,
  updateProgressQueueEntry,
} from '../packages/alantil-core/sync-policy.js';

test('replacement receives a new revision', () => {
  const first = enqueueProgressEntry([], 'word_favorite', { word_id: 'one', is_active: true }, { id: 'word_favorite:one', createdAt: '2026-01-01T00:00:00Z' });
  const second = enqueueProgressEntry(first.queue, 'word_favorite', { word_id: 'one', is_active: false }, { id: 'word_favorite:one', createdAt: '2026-01-02T00:00:00Z' });
  assert.equal(first.queue[0].revision, 1);
  assert.equal(second.queue[0].revision, 2);
});

test('acknowledging an older revision preserves a newer replacement', () => {
  const first = enqueueProgressEntry([], 'word_favorite', { word_id: 'one', is_active: true }, { id: 'word_favorite:one' });
  const sent = first.queue[0];
  const second = enqueueProgressEntry(first.queue, 'word_favorite', { word_id: 'one', is_active: false }, { id: 'word_favorite:one' });
  const ack = removeProgressQueueEntry(second.queue, sent.id, { revision: sent.revision });
  assert.equal(ack.changed, false);
  assert.equal(ack.queue[0].payload.is_active, false);
});

test('failure metadata from an older request cannot mutate a newer revision', () => {
  const first = enqueueProgressEntry([], 'word_favorite', { word_id: 'one', is_active: true }, { id: 'word_favorite:one' });
  const sent = first.queue[0];
  const second = enqueueProgressEntry(first.queue, 'word_favorite', { word_id: 'one', is_active: false }, { id: 'word_favorite:one' });
  const updated = updateProgressQueueEntry(second.queue, sent.id, { attempts: 9 }, { revision: sent.revision });
  assert.equal(updated.changed, false);
  assert.equal(updated.queue[0].attempts, 0);
});

test('guest settings replacing account defaults receive a new revision', () => {
  const account = [{ id: 'user_settings:current', type: 'user_settings', payload: { learning_setup_completed_at: null, alan_script_code: 'cyrillic' }, revision: 4 }];
  const guest = [{ id: 'user_settings:current', type: 'user_settings', payload: { learning_setup_completed_at: null, alan_script_code: 'turkic' } }];
  const merged = mergeProgressQueueEntries(account, guest, { claimId: 'claim:A' });
  assert.equal(merged[0].payload.alan_script_code, 'turkic');
  assert.equal(merged[0].revision, 5);
});
