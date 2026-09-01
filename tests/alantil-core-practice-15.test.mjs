import assert from 'node:assert/strict';
import test from 'node:test';

import { combineNumberedExamples, parseExampleGroups } from '../packages/alantil-core/example-groups.js';
import { buildLearningRoute, resolveStationFromParams, stationPathParams } from '../packages/alantil-core/learning-route.js';
import {
  buildMatchRounds,
  buildScope,
  buildSelectedSources,
  buildTestOptions,
  buildTestWords,
  buildWordsByPOSRounds,
  dictsFrom,
  hasWordConflict,
  parseSynonyms,
  sectionsFrom,
  setsFrom,
  wordsForSet,
} from '../packages/alantil-core/practice.js';
import { createSlugMap, toSlug } from '../packages/alantil-core/slugs.js';
import { normalizeLegacyWordEntry, normalizeSupabaseWordEntry, permanentSectionId, storyIdForDictionary } from '../packages/alantil-core/word-normalizer.js';

function makeWords(count, posCycle = ['noun', 'verb', 'adjective', 'adverb']) {
  return Array.from({ length: count }, (_, index) => ({
    id: `w-${index + 1}`,
    word: `alan-${index + 1}`,
    trans: `translation-${index + 1}`,
    pos: posCycle[index % posCycle.length],
    synonyms: [],
  }));
}

test('15.0 shared test policy returns the requested 20/40/80 items when the pool is large enough', () => {
  const pool = makeWords(100);
  for (const limit of [20, 40, 80]) {
    const result = buildTestWords(pool, limit);
    assert.equal(result.items.length, limit);
    assert.equal(new Set(result.items.map((item) => item.id)).size, limit);
    assert.equal(result.complete, true);
  }
});

test('15.0 shared test options stay at four choices even when same-POS distractors are sparse', () => {
  const pool = [
    { id: 'n1', word: 'alan-1', trans: 'one', pos: 'noun', synonyms: [] },
    { id: 'n2', word: 'alan-2', trans: 'two', pos: 'noun', synonyms: [] },
    { id: 'v1', word: 'alan-3', trans: 'three', pos: 'verb', synonyms: [] },
    { id: 'a1', word: 'alan-4', trans: 'four', pos: 'adjective', synonyms: [] },
    { id: 'd1', word: 'alan-5', trans: 'five', pos: 'adverb', synonyms: [] },
  ];
  const options = buildTestOptions(pool[0], pool, 'kb', 4);
  assert.equal(options.length, 4);
  assert.equal(new Set(options.map((option) => option.text)).size, 4);
  assert.equal(options.filter((option) => option.id === 'n1').length, 1);
});

test('15.0 shared practice core fills sparse POS test rounds from other parts of speech', () => {
  const pool = [
    ...makeWords(2, ['noun']),
    ...makeWords(30, ['verb']).map((word, index) => ({ ...word, id: `v-${index}`, trans: `verb-${index}` })),
  ];
  const result = buildTestWords(pool, 20);
  assert.equal(result.items.length, 20);
  assert.equal(new Set(result.items.map((item) => item.id)).size, 20);
});

test('15.0 match policy preserves conflict filtering inside each round', () => {
  const pool = makeWords(25);
  pool[1].trans = pool[0].trans;
  assert.equal(hasWordConflict(pool[1], [pool[0]]), true);
  const result = buildMatchRounds(pool, 20);
  for (const round of result.rounds) {
    for (let index = 0; index < round.length; index += 1) {
      assert.equal(hasWordConflict(round[index], round.slice(0, index)), false);
    }
  }
});

test('15.0 low-level round builder still supports explicit conflict options', () => {
  const pool = makeWords(20);
  const result = buildWordsByPOSRounds(pool, 20, { requireConflictFree: false });
  assert.equal(result.items.length, 20);
  assert.equal(result.complete, true);
});

test('15.0 shared core owns dictionary, section and set traversal used by web', () => {
  const words = [
    { id: '1', dictionary_id: 'beginner', dictionary_name: 'Beginner', section_id: 'starter', section_name: 'Starter', set_id: 'beginner-01', global_order: 1 },
    { id: '2', dictionary_id: 'beginner', dictionary_name: 'Beginner', section_id: 'starter', section_name: 'Starter', set_id: 'beginner-02', global_order: 2 },
    { id: '3', dictionary_id: 'advanced', dictionary_name: 'Advanced', section_id: 'advanced', section_name: 'Advanced', set_id: 'advanced-01', global_order: 3 },
  ];
  assert.deepEqual(dictsFrom(words), ['beginner', 'advanced']);
  assert.deepEqual(sectionsFrom(words, 'beginner'), ['starter']);
  assert.deepEqual(setsFrom(words, 'beginner', 'starter'), ['beginner-01', 'beginner-02']);
  assert.deepEqual(wordsForSet(words, 'beginner', 'starter', 'beginner-02').map((word) => word.id), ['2']);
});

test('15.0 shared core owns practice scope and selected source contracts used by mobile', () => {
  const words = [
    { id: '1', dictionary_id: 'beginner', dictionary_name: 'Начальный', section_id: 'starter', section_name: 'Starter' },
    { id: '2', dictionary_id: 'beginner', dictionary_name: 'Начальный', section_id: 'starter', section_name: 'Starter' },
    { id: '3', dictionary_id: 'beginner', dictionary_name: 'Начальный', section_id: 'elementary', section_name: 'Elementary' },
  ];
  assert.deepEqual(buildScope(words), [{
    id: 'beginner',
    name: 'Начальный',
    count: 3,
    sections: [
      { id: 'starter', name: 'Starter', count: 2 },
      { id: 'elementary', name: 'Elementary', count: 1 },
    ],
  }]);
  assert.deepEqual(buildSelectedSources(words), [{ dictionary_id: 'beginner', section_ids: ['starter', 'elementary'] }]);
  assert.deepEqual(parseSynonyms(' Один, Два '), ['один', 'два']);
});

test('15.0 shared core owns stable route slugs', () => {
  assert.equal(toSlug('На вершине'), 'na-vershine');
  const map = createSlugMap(['Тест', 'Test', 'Test']);
  assert.equal(map.slugFor('Тест'), 'test');
  assert.equal(map.slugFor('Test'), 'test-2');
  assert.equal(map.valueFor('test-2'), 'Test');
});

test('15.0 shared core owns example grouping and pairing', () => {
  assert.equal(combineNumberedExamples('1.1 Бир\n1.2 Эки', '1.1 Один\n1.2 Два'), '1.1 Бир ✦ Один; 1.2 Эки ✦ Два');
  assert.deepEqual(parseExampleGroups('1.1 Бир; 1.2 Эки; 2.1 Юч'), [
    { index: 0, lines: ['Бир', 'Эки'] },
    { index: 1, lines: ['Юч'] },
  ]);
});

test('15.0 shared core owns legacy and Supabase word normalization', () => {
  assert.equal(storyIdForDictionary('beginner'), 'oblivion');
  assert.equal(permanentSectionId('beginner', 'beginner-16'), 'beginner-elementary');
  const legacy = normalizeLegacyWordEntry({ id: '7', section: '1', set: '1', word: 'Сёз', trans: 'Слово', global_order: 1 });
  assert.equal(legacy?.story_id, 'oblivion');
  assert.equal(legacy?.dictionary_id, 'beginner');
  assert.equal(legacy?.section_id, 'beginner-starter');
  const modern = normalizeSupabaseWordEntry({
    word_id: '8', global_order: 2, story_id: 'roots', dictionary_id: 'intermediate', section_id: 'intermediate-intermediate', set_id: 'intermediate-01',
    word_alan_cyrillic: 'Тил', translation_ru: 'Язык', dictionary_name_ru: 'Средний', section_name_ru: 'Intermediate', set_name_ru: '01', used_in_test: true,
  });
  assert.equal(modern?.word_id, '8');
  assert.equal(modern?.story_id, 'roots');
  assert.equal(modern?.usedInTest, true);
});

test('15.0 shared core builds and resolves the same learning route for every client', () => {
  const base = {
    story_id: 'oblivion', story_name: 'На пороге забвения', dictionary_id: 'beginner', dictionary_name: 'Начальный', section_id: 'beginner-starter', section_name: 'Starter',
  };
  const words = [
    { ...base, id: 'w1', set_id: 'beginner-01', set_name: '', global_order: 1 },
    { ...base, id: 'w2', set_id: 'beginner-01', set_name: '', global_order: 2 },
    { ...base, id: 'w3', set_id: 'beginner-02', set_name: '', global_order: 3 },
  ];
  const route = buildLearningRoute(words);
  assert.deepEqual(route.storyOrder, ['oblivion']);
  assert.equal(route.stories.oblivion.stationCount, 2);
  const station = route.stories.oblivion.stations[1];
  const params = stationPathParams(route, station);
  assert.equal(resolveStationFromParams(route, params)?.key, station.key);
});
