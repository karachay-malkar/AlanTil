import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('legacy dictionary snapshot migrates to IndexedDB before the LocalStorage copy is removed', async () => {
  const source = await read('src/shared/data/word-repository.js');
  const indexed = source.indexOf('const indexed = await readDictionarySnapshot()');
  const legacy = source.indexOf('const legacy = readLegacyDictionaryCache()');
  assert.ok(indexed >= 0 && legacy > indexed);
  assert.match(source, /if \(legacy\) \{[\s\S]*await persistSnapshot\(legacy\)/);
  assert.match(source, /if \(stored\) \{[\s\S]*writeDictionaryMeta\(snapshot\.version\);[\s\S]*removeLegacyCurrentCache\(\)/);
});

test('LocalStorage remains a safe fallback when IndexedDB is unavailable', async () => {
  const source = await read('src/shared/data/word-repository.js');
  assert.match(source, /const fallback = writeJson\(DICTIONARY_CACHE_KEY, \{ version: snapshot\.version, words: snapshot\.words \}\)/);
  assert.match(source, /if \(fallback\) writeDictionaryMeta\(snapshot\.version\)/);
});

test('dictionary meta is only the synchronous version pointer while words live in IndexedDB', async () => {
  const [repository, store] = await Promise.all([
    read('src/shared/data/word-repository.js'),
    read('src/shared/data/dictionary-store.js'),
  ]);
  assert.match(repository, /const DICTIONARY_META_KEY = "alantil_dictionary_meta_v1"/);
  assert.match(repository, /return installedVersion \|\| readDictionaryMeta\(\)\?\.version/);
  assert.match(store, /const STORE_NAME = 'dictionary'/);
  assert.match(store, /word_count: words\.length/);
});
