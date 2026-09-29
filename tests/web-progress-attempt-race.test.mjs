import test from 'node:test';
import assert from 'node:assert/strict';
import { nextUnattemptedProgressEntry, progressQueueAttemptKey } from '../src/shared/progress/progress-sync-policy.js';

test('a replacement revision is eligible after the previous revision was attempted', () => {
  const first = { id: 'word_favorite:one', type: 'word_favorite', revision: 1 };
  const second = { id: 'word_favorite:one', type: 'word_favorite', revision: 2 };
  const attempted = new Set([progressQueueAttemptKey(first)]);
  assert.equal(nextUnattemptedProgressEntry([second], attempted), second);
});

test('legacy attempted id remains supported', () => {
  const entry = { id: 'word_favorite:one', type: 'word_favorite' };
  assert.equal(nextUnattemptedProgressEntry([entry], new Set([entry.id])), null);
});
