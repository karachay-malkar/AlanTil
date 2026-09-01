import assert from 'node:assert/strict';
import test from 'node:test';

import {
  approximateStem,
  buildStationTestOptions,
  normalizedLexeme,
  stationTestCandidateIsAmbiguous,
  stationTestResult,
} from '../packages/alantil-core/station-test.js';

const words = [
  { id: '1', word: 'къала', trans: 'город', pos: 'noun', synonyms: [] },
  { id: '2', word: 'тау', trans: 'гора', pos: 'noun', synonyms: [] },
  { id: '3', word: 'суу', trans: 'вода', pos: 'noun', synonyms: [] },
  { id: '4', word: 'юй', trans: 'дом', pos: 'noun', synonyms: [] },
  { id: '5', word: 'къала-сы', trans: 'город', pos: 'noun', synonyms: [] },
];

test('station test normalization and ambiguity follow web rules', () => {
  assert.equal(normalizedLexeme("Къала-сы!"), 'къаласы');
  assert.equal(approximateStem('abcdefgh'), 'abcde');
  assert.equal(stationTestCandidateIsAmbiguous(words[4], words[0], []), true);
});

test('station test options preserve one correct answer and safe distractors', () => {
  const options = buildStationTestOptions(words[0], words, 'kb', 3);
  assert.equal(options.filter((option) => option.id === '1').length, 1);
  assert.ok(options.length >= 1 && options.length <= 4);
  const distractors = options.filter((option) => option.id !== '1').map((option) => option.word);
  distractors.forEach((candidate, index) => {
    assert.equal(stationTestCandidateIsAmbiguous(candidate, words[0], distractors.slice(0, index)), false);
  });
});

test('station test result owns common 80/90/100 mastery thresholds', () => {
  const answers = Array.from({ length: 10 }, (_, index) => ({ result: index < 9 ? 'correct' : 'wrong' }));
  assert.deepEqual(stationTestResult(answers, 80, 10), { accuracy: 90, required: 80, passed: true, masteryLevel: 2 });
  assert.equal(stationTestResult(answers, 95, 10).passed, false);
});
