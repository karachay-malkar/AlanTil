import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DICTIONARY_CONTENT_TABLE,
  DICTIONARY_METADATA_TABLE,
  DICTIONARY_STORIES_TABLE,
  DICTIONARY_PAGE_SIZE,
  dictionaryRestParameters,
  storiesByDictionary,
} from '../../packages/alantil-core/dictionary-contract.js';
import { normalizeSupabaseWordEntry } from '../../packages/alantil-core/word-normalizer.js';
import { enqueueProgressEntry, mergeProgressQueueEntries } from '../../packages/alantil-core/sync-policy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const provenance = JSON.parse(read('docs/WEB_ORIGIN_16_4.json'));

test('16.4 provenance contains no mobile business reimplementation', () => {
  assert.ok(provenance.entries.length >= 15);
  assert.equal(provenance.entries.filter((entry) => entry.status === 'MOBILE_REIMPLEMENTATION').length, 0);
  for (const entry of provenance.entries) assert.ok(['EXACT', 'ADAPTED', 'PLATFORM_ONLY'].includes(entry.status), entry.function);
});

test('literal Web-origin core files remain byte-identifiable in the shared package', () => {
  const pairs = [
    ['src/shared/domain/example-groups.js', 'packages/alantil-core/example-groups.js'],
    ['src/shared/domain/slugs.js', 'packages/alantil-core/slugs.js'],
  ];
  for (const [web, shared] of pairs) {
    const webSource = read(web);
    if (webSource.trim().startsWith('export * from')) {
      assert.match(webSource, new RegExp(shared.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split('/').slice(1).join('/')));
    } else {
      assert.equal(webSource, read(shared));
    }
  }
  assert.match(read('src/shared/domain/word-normalizer.js'), /packages\/alantil-core\/word-normalizer\.js/);
  assert.match(read('src/shared/domain/learning-route.js'), /packages\/alantil-core\/learning-route\.js/);
  assert.match(read('src/shared/domain/word-selection.js'), /packages\/alantil-core\/word-selection\.js/);
});

test('Web Test and Match use the exact shared engines consumed by Mobile', () => {
  assert.match(read('src/features/test/engine.js'), /packages\/alantil-core\/test\.js/);
  assert.match(read('src/features/match/engine.js'), /packages\/alantil-core\/match\.js/);
  const mobile = read('mobile/screens/practice-games.js');
  assert.match(mobile, /packages\/alantil-core\/test\.js/);
  assert.match(mobile, /packages\/alantil-core\/match\.js/);
});

test('Mobile root no longer constructs runtime words from STARTER_DICTIONARY', () => {
  const source = read('mobile/AppRoot.js');
  assert.doesNotMatch(source, /STARTER_DICTIONARY/);
  assert.doesNotMatch(source, /const\s+WORDS\s*=/);
  assert.doesNotMatch(source, /const\s+ROUTE\s*=/);
  assert.match(source, /bootstrapNativeDictionary/);
  assert.match(source, /getDisplayedWordCollection\(words,settings\)/);
  assert.match(source, /buildLearningRoute\(displayWords\)/);
});

test('Web and Mobile dictionary contracts resolve to the same resources', () => {
  assert.equal(DICTIONARY_CONTENT_TABLE, 'v_words_app');
  assert.equal(DICTIONARY_STORIES_TABLE, 'content_stories');
  assert.equal(DICTIONARY_METADATA_TABLE, 'dictionary_metadata');
  assert.equal(DICTIONARY_PAGE_SIZE, 1000);
  assert.deepEqual(dictionaryRestParameters('words', { offset: 1000 }), { select: '*', order: 'global_order.asc', offset: 1000, limit: 1000 });
  assert.deepEqual(dictionaryRestParameters('stories'), { select: '*', order: 'story_order.asc' });
  assert.deepEqual(dictionaryRestParameters('version'), { select: 'current_version', dictionary_key: 'eq.main', limit: 1 });
  assert.match(read('src/config/words.js'), /packages\/alantil-core\/dictionary-contract\.js/);
  assert.match(read('mobile/platform/dictionary.js'), /packages\/alantil-core\/dictionary-contract\.js/);
});

test('Supabase normalization is deterministic for the Web contract fixture', () => {
  const story = { story_id: 'roots', story_order: 2, dictionary_ids: ['beginner'], name_ru: 'Возвращение к истокам' };
  const mapped = storiesByDictionary([story]);
  assert.equal(mapped.get('beginner'), story);
  const word = normalizeSupabaseWordEntry({
    word_id: 'fixture-1', global_order: 1, dictionary_id: 'beginner', section_id: 'beginner-starter', set_id: 'beginner-01',
    word_alan_cyrillic: 'алан', word_alan_turkic: 'alan', translation_ru: 'алан', translation_en: 'alan', translation_tr: 'alan', pos: 'noun', synonyms: '',
  }, mapped.get('beginner'));
  assert.equal(word.id, 'fixture-1');
  assert.equal(word.story_id, 'roots');
  assert.equal(word.dictionary_id, 'beginner');
  assert.equal(word.section_id, 'beginner-starter');
  assert.equal(word.set_id, 'beginner-01');
  assert.equal(word.translationRu, 'алан');
});

test('progress queue policy preserves Web replace and guest-merge rules', () => {
  const first = enqueueProgressEntry([], 'word_progress_snapshot', { words: [1] }, { id: 'word_progress_snapshot:current', createdAt: '2026-01-01T00:00:00.000Z' });
  const replaced = enqueueProgressEntry(first.queue, 'word_progress_snapshot', { words: [2] }, { id: 'word_progress_snapshot:current', createdAt: '2026-01-02T00:00:00.000Z' });
  assert.equal(replaced.queue.length, 1);
  assert.deepEqual(replaced.queue[0].payload.words, [2]);
  assert.equal(replaced.queue[0].created_at, '2026-01-01T00:00:00.000Z');
  const merged = mergeProgressQueueEntries(replaced.queue, [{ id: 'favorite:1', type: 'word_favorite', payload: { word_id: '1' }, created_at: 'x' }], { claimId: 'account-1' });
  assert.equal(merged.length, 2);
  assert.equal(merged.find((entry) => entry.id === 'favorite:1').claim_id, 'account-1');
});

test('platform-only modules do not own Test, Match, Learn or route algorithms', () => {
  const platformFiles = fs.readdirSync(path.join(root, 'mobile/platform')).filter((name) => name.endsWith('.js'));
  for (const name of platformFiles) {
    const source = read(`mobile/platform/${name}`);
    assert.doesNotMatch(source, /function\s+(initializeTestState|initializeMatchState|initializeLearnState|buildLearningRoute)\b/, name);
  }
});
