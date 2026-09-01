import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('favorites persist a study selection and learning direction', async () => {
  const [favorites, preferences] = await Promise.all([
    read('src/mobile/practice/favorites.tsx'),
    read('src/mobile/station-preferences.ts'),
  ]);
  assert.match(favorites, /loadStationSelection/);
  assert.match(favorites, /saveStationSelection/);
  assert.match(favorites, /loadStationDirection/);
  assert.match(favorites, /saveStationDirection/);
  assert.match(favorites, /FAVORITES_CONTEXT/);
  assert.match(favorites, /favorites\.show_all/);
  assert.match(favorites, /favorites\.hide_all/);
  assert.match(preferences, /STORAGE_KEYS\.hiddenWords/);
  assert.match(preferences, /enqueueSync\('hidden_word'/);
});

test('favorites pass the selected words and direction to the full learning engine', async () => {
  const [favorites, engine] = await Promise.all([
    read('src/mobile/practice/favorites.tsx'),
    read('src/mobile/learn/engine.tsx'),
  ]);
  assert.match(favorites, /source: 'favorites'/);
  assert.match(favorites, /selectedIds: Array\.from\(selected\)\.join\(','\)/);
  assert.match(favorites, /direction,/);
  assert.match(engine, /if \(selectedIds\.size\) words = words\.filter/);
  assert.match(favorites, /<OverflowMarquee/);
  assert.doesNotMatch(favorites, /export function FavoritesStudyScreen/);
  assert.doesNotMatch(favorites, /export function SongsBridgeScreen/);
});
