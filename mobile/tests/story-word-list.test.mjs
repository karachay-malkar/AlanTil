import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('story word list has a header search with localized accessibility state', async () => {
  const [pathSource, headerSource] = await Promise.all([
    read('src/mobile/path.tsx'),
    read('src/mobile/practice/common.tsx'),
  ]);
  assert.match(headerSource, /action\?: ReactNode/);
  assert.match(pathSource, /WORD_LIST_COPY/);
  assert.match(pathSource, /accessibilityState=\{\{ expanded: searchOpen \}\}/);
  assert.match(pathSource, /requestAnimationFrame\(\(\) => searchRef\.current\?\.focus\(\)\)/);
  assert.match(pathSource, /normalizedSearch/);
});

test('story word list preserves local numbering, removes duplicates and limits section titles to thematic catalogs', async () => {
  const source = await read('src/mobile/path.tsx');
  assert.match(source, /const seen = new Set<string>\(\)/);
  assert.match(source, /seen\.has\(id\)/);
  assert.match(source, /ordinal: \+\+ordinal/);
  assert.match(source, /thematicCatalog\(catalog\) && section\.name/);
  assert.doesNotMatch(source, /word\.global_order \?\? ''/);
});

test('story favorites are scoped, offline-first and use the common overflow marquee', async () => {
  const [pathSource, storageSource, repositorySource, marqueeSource] = await Promise.all([
    read('src/mobile/path.tsx'),
    read('src/mobile/storage.ts'),
    read('src/mobile/practice/repository.ts'),
    read('src/mobile/overflow-marquee.tsx'),
  ]);
  assert.match(pathSource, /loadFavoriteIds/);
  assert.match(pathSource, /setFavorite/);
  assert.match(pathSource, /subscribeScopedValue\(STORAGE_KEYS\.wordFavorites/);
  assert.match(pathSource, /<OverflowMarquee/);
  assert.match(storageSource, /export async function updateScopedJson/);
  assert.match(repositorySource, /updateScopedJson<unknown\[]>\(STORAGE_KEYS\.wordFavorites/);
  assert.match(marqueeSource, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(marqueeSource, /Animated\.loop/);
});
