import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWordsByPOSRounds, hasWordConflict } from '../packages/alantil-core/practice.js';

function makeWords(count, posCycle = ['noun', 'verb', 'adjective', 'adverb']) {
  return Array.from({ length: count }, (_, index) => ({
    id: `w-${index + 1}`,
    word: `alan-${index + 1}`,
    trans: `translation-${index + 1}`,
    pos: posCycle[index % posCycle.length],
    synonyms: [],
  }));
}

test('15.0 shared practice core returns the requested 20/40/80 test items when the pool is large enough', () => {
  const pool = makeWords(100);
  for (const limit of [20, 40, 80]) {
    const result = buildWordsByPOSRounds(pool, limit, { requireConflictFree: false });
    assert.equal(result.items.length, limit);
    assert.equal(new Set(result.items.map((item) => item.id)).size, limit);
    assert.equal(result.complete, true);
  }
});

test('15.0 shared practice core fills sparse POS rounds from other parts of speech', () => {
  const pool = [
    ...makeWords(2, ['noun']),
    ...makeWords(30, ['verb']).map((word, index) => ({ ...word, id: `v-${index}`, trans: `verb-${index}` })),
  ];
  const result = buildWordsByPOSRounds(pool, 20, { requireConflictFree: false });
  assert.equal(result.items.length, 20);
  assert.equal(new Set(result.items.map((item) => item.id)).size, 20);
});

test('15.0 match-safe selection preserves conflict filtering inside each round', () => {
  const pool = makeWords(25);
  pool[1].trans = pool[0].trans;
  assert.equal(hasWordConflict(pool[1], [pool[0]]), true);
  const result = buildWordsByPOSRounds(pool, 20);
  for (const round of result.rounds) {
    for (let index = 0; index < round.length; index += 1) {
      assert.equal(hasWordConflict(round[index], round.slice(0, index)), false);
    }
  }
});
