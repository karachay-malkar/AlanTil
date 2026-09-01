import assert from 'node:assert/strict';
import test from 'node:test';

import { legacyStructureNames, normalizeDictionaryScope } from '../src/mobile/dictionary-policy.ts';
import { STARTER_DICTIONARY } from '../src/mobile/starter-dictionary.ts';

function scopeOf(row) {
  return normalizeDictionaryScope({
    storyId: row.story_id,
    dictionaryId: row.dictionary_id,
    sectionId: row.section_id,
    setId: row.set_id,
    globalOrder: row.global_order,
  });
}

test('legacy starter level words map to permanent route identifiers', () => {
  assert.deepEqual(scopeOf(STARTER_DICTIONARY[0]), {
    legacy: true,
    storyId: 'oblivion',
    dictionaryId: 'beginner',
    sectionId: 'beginner-starter',
    setId: 'beginner-01',
  });
  assert.deepEqual(scopeOf(STARTER_DICTIONARY[20]), {
    legacy: true,
    storyId: 'ascent',
    dictionaryId: 'advanced',
    sectionId: 'advanced-advanced',
    setId: 'advanced-01',
  });
});

test('legacy thematic set numbers map to permanent set and section identifiers', () => {
  assert.deepEqual(scopeOf(STARTER_DICTIONARY[40]), {
    legacy: true,
    storyId: 'pathways',
    dictionaryId: 'universe',
    sectionId: 'universe-seasons',
    setId: 'universe-01',
  });
  assert.equal(scopeOf(STARTER_DICTIONARY.at(-1)).sectionId, 'universe-weekdays');
});

test('every bundled starter word belongs to a usable Path station', () => {
  const scopes = STARTER_DICTIONARY.map(scopeOf);
  assert.ok(scopes.every((scope) => scope.storyId && scope.dictionaryId && scope.sectionId && scope.setId));
  assert.deepEqual([...new Set(scopes.map((scope) => scope.storyId))], ['oblivion', 'ascent', 'pathways']);
});

test('starter route names are available in RU, EN and TR', () => {
  const names = legacyStructureNames(scopeOf(STARTER_DICTIONARY[0]));
  assert.equal(names?.story.ru, 'На пороге забвения');
  assert.equal(names?.story.en, 'On the Threshold of Oblivion');
  assert.equal(names?.story.tr, 'Unutuluşun Eşiğinde');
  assert.equal(names?.section.en, 'Starter');
});

test('modern dictionary identifiers remain unchanged', () => {
  assert.deepEqual(normalizeDictionaryScope({
    storyId: 'roots', dictionaryId: 'intermediate', sectionId: 'intermediate-intermediate', setId: 'intermediate-02', globalOrder: 920,
  }), {
    legacy: false,
    storyId: 'roots',
    dictionaryId: 'intermediate',
    sectionId: 'intermediate-intermediate',
    setId: 'intermediate-02',
  });
});
