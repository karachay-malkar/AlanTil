import assert from 'node:assert/strict';
import test from 'node:test';

import { DIRECTIONS, EVENTS, directionFromMode, sanitizeAnalyticsParameters } from '../packages/alantil-core/analytics.js';

test('analytics event and direction contracts are shared', () => {
  assert.equal(EVENTS.WORD_RESULT, 'word_result');
  assert.equal(directionFromMode('kb'), DIRECTIONS.ALAN_RU);
  assert.equal(directionFromMode('ru'), DIRECTIONS.RU_ALAN);
  assert.equal(directionFromMode('other'), DIRECTIONS.NONE);
});

test('analytics sanitizer removes personal/free-text fields', () => {
  assert.deepEqual(sanitizeAnalyticsParameters({
    dictionary_id: 'beginner',
    email: 'hidden@example.com',
    word: 'secret',
    accuracy: 90,
    active: true,
  }), { dictionary_id: 'beginner', accuracy: 90, active: true });
});

test('mobile sanitizer contract normalizes and bounds parameters', () => {
  const result = sanitizeAnalyticsParameters({
    'bad-key!': 'abcdefghij',
    safe: '0123456789',
    query: 'private',
  }, { maxEntries: 32, keyMaxLength: 5, stringMaxLength: 4, normalizeKeys: true });
  assert.deepEqual(result, { badke: 'abcd', safe: '0123' });
});
